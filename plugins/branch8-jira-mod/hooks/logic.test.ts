import { test, expect } from 'claude-code/testing'
import { detectNode, reminderFor, formatBand, rulesSection, parseIssueStatus } from './logic'

const T = { key: 'HS-1', summary: '修正請假審核通知', status: '待辦事項', cloudId: 'c' }

test('edits mark the start node', () => {
  expect(detectNode('Edit', { file_path: 'a.ts' })).toBe('start')
  expect(detectNode('Write', { file_path: 'a.ts' })).toBe('start')
  expect(detectNode('NotebookEdit', {})).toBe('start')
  expect(detectNode('Read', { file_path: 'a.ts' })).toBeNull()
})

test('bash PR and merge commands', () => {
  expect(detectNode('Bash', { command: 'gh pr create --title x --body y' })).toBe('pr')
  expect(detectNode('Bash', { command: 'git push -u origin b && gh pr create -f' })).toBe('pr')
  expect(detectNode('Bash', { command: 'gh pr merge 12 --squash' })).toBe('merge')
  expect(detectNode('Bash', { command: 'git merge feature/x' })).toBe('merge')
})

test('look-alikes do not trigger', () => {
  expect(detectNode('Bash', { command: 'gh pr create --help' })).toBeNull()
  expect(detectNode('Bash', { command: 'gh pr create --dry-run' })).toBeNull()
  expect(detectNode('Bash', { command: 'git merge --abort' })).toBeNull()
  expect(detectNode('Bash', { command: 'git merge-base main HEAD' })).toBeNull()
  expect(detectNode('Bash', { command: 'echo "gh pr create later"' })).toBeNull()
  expect(detectNode('Bash', { command: 'gh pr list' })).toBeNull()
})

test('github MCP tools', () => {
  expect(detectNode('mcp__plugin_github_github__create_pull_request', {})).toBe('pr')
  expect(detectNode('mcp__plugin_github_github__merge_pull_request', {})).toBe('merge')
})

test('reminder once per ticket and node', () => {
  const r = reminderFor('pr', T, [])
  expect(r?.mark).toBe('HS-1:pr')
  expect(reminderFor('pr', T, ['HS-1:pr'])).toBeNull()
  expect(reminderFor('pr', { ...T, key: 'HS-2' }, ['HS-1:pr'])?.mark).toBe('HS-2:pr')
})

test('no ticket yet: remind to resolve one, once', () => {
  expect(reminderFor('start', null, [])?.mark).toBe('none:resolve')
  expect(reminderFor('start', null, ['none:resolve'])).toBeNull()
  expect(reminderFor('pr', null, ['none:resolve'])).toBeNull()
})

test('band text', () => {
  expect(formatBand(T)).toBe('🎫 HS-1 修正請假審核通知 · 待辦事項')
  const long = formatBand({ ...T, summary: 'x'.repeat(200) })
  expect(long.length <= 90).toBe(true)
  expect(long.includes('…')).toBe(true)
})

test('band before Jira answers: no blank summary or status', () => {
  expect(formatBand({ ...T, summary: '', status: '' })).toBe('🎫 HS-1 · 查詢中')
})

test('rules section names the ticket and asked nodes', () => {
  expect(rulesSection(null, []).includes('jira-workflow')).toBe(true)
  const s = rulesSection(T, ['HS-1:start'])
  expect(s.includes('HS-1')).toBe(true)
  expect(s.includes('start')).toBe(true)
})

test('parse getJiraIssue output', () => {
  const ok = [{ type: 'text', text: JSON.stringify({ key: 'HS-1', fields: { summary: 'S', status: { name: '進行中' } } }) }]
  expect(parseIssueStatus(ok)).toEqual({ summary: 'S', status: '進行中' })
  const wrapped = [{ type: 'text', text: JSON.stringify({ data: { fields: { status: { name: 'Done' } } } }) }]
  expect(parseIssueStatus(wrapped)?.status).toBe('Done')
  expect(parseIssueStatus([{ type: 'text', text: 'not json' }])).toBeNull()
  expect(parseIssueStatus([])).toBeNull()
})
