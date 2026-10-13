import { test, expect } from 'claude-code/testing'
import type { On } from 'claude-code'

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
