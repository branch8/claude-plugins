import { test, expect } from 'claude-code/testing'
import type { On } from 'claude-code'
import { tellClaude } from './register'

const TICKET = { key: 'HS-1', summary: 'S', status: '待辦事項', cloudId: 'c' }

test('picking a ticket submits it as a prompt, so Claude starts on it at once', async ($, on) => {
  const submitted: string[] = []
  const appended: string[] = []
  on('prompt.submit', ($, e) => {
    submitted.push(e.text)
    return { text: e.text }
  })
  on('session.append', ($, e, next) => {
    appended.push('x')
    return next(e)
  })
  await tellClaude($ as never, TICKET as never)
  expect(submitted.length).toBe(1)
  expect(submitted[0]).toContain('HS-1')
  expect(appended.length).toBe(0)
})

test('a refused submit falls back to the quiet note; unselecting never starts a turn', async ($, on) => {
  const submitted: string[] = []
  const appended: string[] = []
  on('prompt.submit', ($, e) => {
    submitted.push(e.text)
    return { drop: 'refused in this test' }
  })
  on('session.append', ($, e, next) => {
    appended.push('x')
    return next(e)
  })
  await tellClaude($ as never, TICKET as never)
  expect(appended.length).toBe(1)
  submitted.length = 0
  appended.length = 0
  await tellClaude($ as never, null)
  expect(submitted.length).toBe(0)
  expect(appended.length).toBe(1)
})

const SET = 'mcp__branch8-jira-mod__set_ticket'
const GET = 'mcp__branch8-jira-mod__get_ticket'
const MARK = 'mcp__branch8-jira-mod__mark_asked'

// The test's own hooks sit beneath the plugin and stand for the engine's tools.
function fakeTools(on: On) {
  on('tool.call', { tool: 'Edit' }, () => ({ result: { filePath: 'a.ts' } as never }))
  on('tool.call', { tool: 'Bash' }, () => ({ result: { stdout: '', stderr: '', interrupted: false } as never }))
}

test('set_ticket then get_ticket returns it', async ($, on) => {
  fakeTools(on)
  await $.tool.call({ tool: SET, key: 'HS-1', summary: 'S', status: '待辦事項', cloudId: 'c' } as never)
  const got = await $.tool.call({ tool: GET } as never)
  expect(JSON.stringify(got).includes('HS-1')).toBe(true)
})

test('editing with no ticket reminds once', async ($, on) => {
  fakeTools(on)
  const first = await $.tool.call({ tool: 'Edit', file_path: 'a.ts', old_string: 'x', new_string: 'y' } as never)
  expect(JSON.stringify(first.context ?? []).includes('no Jira ticket')).toBe(true)
  const second = await $.tool.call({ tool: 'Edit', file_path: 'a.ts', old_string: 'x', new_string: 'y' } as never)
  expect((second.context ?? []).length).toBe(0)
})

test('opening a PR reminds about the current ticket once', async ($, on) => {
  fakeTools(on)
  await $.tool.call({ tool: SET, key: 'HS-7', summary: 'S', status: '進行中', cloudId: 'c' } as never)
  const pr = await $.tool.call({ tool: 'Bash', command: 'gh pr create -f' } as never)
  expect(JSON.stringify(pr.context ?? []).includes('HS-7')).toBe(true)
  const again = await $.tool.call({ tool: 'Bash', command: 'gh pr create -f' } as never)
  expect((again.context ?? []).length).toBe(0)
})

test('mark_asked suppresses the reminder', async ($, on) => {
  fakeTools(on)
  await $.tool.call({ tool: SET, key: 'HS-8', summary: 'S', status: '進行中', cloudId: 'c' } as never)
  await $.tool.call({ tool: MARK, mark: 'HS-8:merge' } as never)
  const m = await $.tool.call({ tool: 'Bash', command: 'gh pr merge 3' } as never)
  expect((m.context ?? []).length).toBe(0)
})

test('subagent tool calls neither remind nor use up the main session\'s point', async ($, on) => {
  fakeTools(on)
  await $.tool.call({ tool: SET, key: 'HS-9', summary: 'S', status: '進行中', cloudId: 'c' } as never)
  const sub = await $.tool.call({ tool: 'Bash', command: 'gh pr create -f', agentId: 'sub-1' } as never)
  expect((sub.context ?? []).length).toBe(0)
  const main = await $.tool.call({ tool: 'Bash', command: 'gh pr create -f' } as never)
  expect(JSON.stringify(main.context ?? []).includes('HS-9')).toBe(true)
})

test('set_ticket without cloudId falls back to the company site', async ($, on) => {
  fakeTools(on)
  await $.tool.call({ tool: SET, key: 'HS-10' } as never)
  const got = await $.tool.call({ tool: GET } as never)
  expect(JSON.stringify(got).includes('branch8.atlassian.net')).toBe(true)
})

test('clear_ticket leaves Claude with no current ticket', async ($, on) => {
  fakeTools(on)
  await $.tool.call({ tool: SET, key: 'HS-11', cloudId: 'c' } as never)
  await $.tool.call({ tool: 'mcp__branch8-jira-mod__clear_ticket' } as never)
  const got = (await $.tool.call({ tool: GET } as never)) as { result?: unknown; text?: string }
  const body = typeof got.result === 'string' ? got.result : (got.text ?? '')
  expect(JSON.parse(body).ticket).toBeNull()
})

test('the todo list reaches Atlassian under a server name only the tool list gives', async ($, on) => {
  // Claude Desktop: the claude.ai connector is named by UUID, so neither fixed
  // name connects (2026-11-03 "Jira is not connected (no Atlassian MCP)").
  const UUID = '18e7e7c3-0b1d-4c55-9a51-1f2e3d4c5b6a'
  on('tool.list', () => ({
    value: [
      { name: 'Read', description: '', mcp: false },
      { name: `mcp__${UUID}__searchJiraIssuesUsingJql`, description: '', mcp: true },
      { name: `mcp__${UUID}__getTransitionsForJiraIssue`, description: '', mcp: true },
    ],
  }))
  const asked: string[] = []
  on('mcp.call', ($, e) => {
    asked.push(`${e.server} ${e.tool}`)
    if (e.server !== UUID) throw new Error(`no connected MCP tool "${e.tool}" on a server named "${e.server}"`)
    if (e.tool !== 'searchJiraIssuesUsingJql') return { value: { content: [{ type: 'text', text: '{}' }], isError: false } }
    const issues = [{ key: 'HS-1', fields: { summary: 'S', status: { name: '進行中' }, issuetype: { name: 'Task' } } }]
    return { value: { content: [{ type: 'text', text: JSON.stringify({ issues, isLast: true }) }], isError: false } }
  })
  on('ui.open', () => ({ value: { isPlaced: true } }))
  const out = (await $.command.run({ command: 'jira-todo' } as never)) as { text?: string }
  expect(asked.some(a => a.startsWith(`${UUID} searchJiraIssuesUsingJql`))).toBe(true)
  expect(String(out.text)).not.toContain('Atlassian MCP')
})

test('/jira-todo only opens: run again with the pane open, it raises it and never closes it', async ($, on) => {
  const opened: { id: string; focus?: true }[] = []
  const closed: string[] = []
  on('ui.open', ($, e) => {
    opened.push({ id: e.id, focus: e.focus })
    return { value: { isPlaced: true } }
  })
  on('ui.close', ($, e) => {
    closed.push(e.id)
  })
  on('mcp.call', () => {
    throw new Error('not connected')
  })
  await $.command.run({ command: 'jira-todo' } as never)
  await $.command.run({ command: 'jira-todo' } as never)
  expect(closed).toEqual([])
  expect(opened.filter(o => o.id === 'branch8-jira-todo' && o.focus).length).toBe(2)
})
