// Pure logic for the Branch8 Jira mod: no engine calls here, so it is
// unit-testable. register.tsx wires these into the engine.
import type { Node, Ticket, TodoItem } from '../types'

const EDIT_TOOLS = new Set(['Edit', 'Write', 'MultiEdit', 'NotebookEdit'])
const SKIP_FLAGS = /(^|\s)(--help|-h|--dry-run)(\s|$)/

// Blank out quoted strings so `echo "gh pr create"` does not count.
function unquoted(cmd: string): string {
  return cmd.replace(/"[^"]*"|'[^']*'/g, ' ')
}

// Which of the three workflow points a tool call marks, if any.
export function detectNode(tool: string, input: Record<string, unknown>): Node | null {
  if (EDIT_TOOLS.has(tool)) return 'start'
  if (/__create_pull_request$/.test(tool)) return 'pr'
  if (/__merge_pull_request$/.test(tool)) return 'merge'
  if (tool !== 'Bash' || typeof input.command !== 'string') return null
  // A heredoc body (commit message, file content) is data, not commands.
  const command = input.command.split('<<')[0] ?? ''
  for (const part of unquoted(command).split(/&&|\|\||;|\n/)) {
    const p = part.trim()
    if (SKIP_FLAGS.test(p)) continue
    if (/^gh\s+pr\s+create\b/.test(p)) return 'pr'
    // Only a merge that lands the PR now. `git merge` is left out: it is as
    // often syncing main into a feature branch as landing work, and `--auto`
    // only queues the merge.
    if (/^gh\s+pr\s+merge\b/.test(p) && !/(^|\s)--auto(\s|$)/.test(p)) return 'merge'
  }
  return null
}

const NODE_TEXT: Record<Node, string> = {
  start: 'work on it has started (first file change)',
  pr: 'a pull request was just opened',
  merge: 'a merge just happened',
}

// The reminder Claude reads after the tool result, once per ticket and point.
// `mark` is what gets recorded so the same reminder is not repeated.
export function reminderFor(
  node: Node,
  ticket: Ticket | null,
  asked: readonly string[],
): { text: string; mark: string } | null {
  if (!ticket) {
    if (node !== 'start' || asked.includes('none:resolve')) return null
    return {
      mark: 'none:resolve',
      text: 'Branch8 Jira: files are being changed but no Jira ticket is set for this task. Use the jira-workflow skill to resolve the ticket now (question card), unless the user already declined one this session.',
    }
  }
  const mark = `${ticket.key}:${node}`
  if (asked.includes(mark)) return null
  return {
    mark,
    text: `Branch8 Jira: ${NODE_TEXT[node]} for ${ticket.key} (status: ${ticket.status}). Use the jira-workflow skill to decide whether to offer a status transition for the "${node}" point (question card, never move it without the user confirming).`,
  }
}

// Terminal columns a string takes: wide (CJK, fullwidth, emoji) counts 2.
export function displayWidth(text: string): number {
  let w = 0
  for (const ch of text) w += isWide(ch) ? 2 : 1
  return w
}

function isWide(ch: string): boolean {
  const c = ch.codePointAt(0) ?? 0
  return (
    (c >= 0x1100 && c <= 0x115f) ||
    (c >= 0x2e80 && c <= 0xa4cf) ||
    (c >= 0xac00 && c <= 0xd7a3) ||
    (c >= 0xf900 && c <= 0xfaff) ||
    (c >= 0xfe30 && c <= 0xfe4f) ||
    (c >= 0xff00 && c <= 0xff60) ||
    (c >= 0xffe0 && c <= 0xffe6) ||
    (c >= 0x1f300 && c <= 0x1faff) ||
    (c >= 0x20000 && c <= 0x3fffd)
  )
}

// Cut to `max` columns on code-point boundaries, never splitting an emoji.
function fitWidth(text: string, max: number): string {
  if (displayWidth(text) <= max) return text
  let out = ''
  let w = 0
  for (const ch of text) {
    const cw = isWide(ch) ? 2 : 1
    if (w + cw > max - 1) break
    out += ch
    w += cw
  }
  return out + '…'
}

// Columns the whole band may take; fits an 80-column terminal.
const BAND_WIDTH = 78

// One line above the prompt. `width` is the column budget for the whole line.
export function formatBand(ticket: Ticket, width = BAND_WIDTH): string {
  const status = ticket.status || '查詢中'
  const head = `🎫 ${ticket.key}`
  const tail = ` · ${fitWidth(status, 24)}`
  const room = width - displayWidth(head) - displayWidth(tail) - 1
  const summary = ticket.summary && room > 3 ? ` ${fitWidth(ticket.summary, room)}` : ''
  return `${head}${summary}${tail}`
}

// The system prompt section: rules plus the current ticket, so they survive
// compaction and apply to every turn, not only the first message.
export function rulesSection(ticket: Ticket | null, asked: readonly string[]): string {
  const lines = [
    'Branch8 Jira workflow (branch8-jira-mod): use the jira-workflow skill whenever the user starts a new unit of work, when work on it starts, when a pull request is opened, and when it is merged. Ask with question cards; never move a Jira status without the user confirming.',
    'After resolving or creating a ticket call mcp__branch8-jira-mod__set_ticket; after asking about a transition at a point call mcp__branch8-jira-mod__mark_asked with "<KEY>:<start|pr|merge>".',
  ]
  if (ticket) {
    const mine = asked
      .filter(a => a.startsWith(`${ticket.key}:`))
      .map(a => a.slice(ticket.key.length + 1))
    lines.push(
      `Current ticket: ${ticket.key}. Points already asked: ${mine.length ? mine.join(', ') : 'none'}. Its summary and live status: mcp__branch8-jira-mod__get_ticket.`,
    )
  } else {
    lines.push('Current ticket: none set yet.')
  }
  return lines.join('\n')
}

type Content = readonly { type: string; text?: string }[]

function firstJson(content: Content): unknown {
  const text = content.find(c => c.type === 'text' && typeof c.text === 'string')?.text
  if (!text) return null
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

// Summary and status from a getJiraIssue result; null when unreadable.
export function parseIssueStatus(content: Content): { summary?: string; status?: string } | null {
  const json = firstJson(content) as { data?: unknown } | null
  if (!json) return null
  const issue = (json.data ?? json) as { fields?: { summary?: unknown; status?: { name?: unknown } } }
  const status = issue?.fields?.status?.name
  if (typeof status !== 'string') return null
  const summary = issue.fields?.summary
  return typeof summary === 'string' ? { summary, status } : { status }
}

// Open tickets assigned to the person, for the /jira-todo pane.
export const TODO_JQL = 'assignee = currentUser() AND statusCategory != Done ORDER BY updated DESC'

// Items from a searchJiraIssuesUsingJql result; null when unreadable.
export function parseIssueList(content: Content): TodoItem[] | null {
  const json = firstJson(content) as { data?: unknown } | null
  if (!json) return null
  const issues = ((json.data ?? json) as { issues?: unknown }).issues
  if (!Array.isArray(issues)) return null
  const items: TodoItem[] = []
  for (const raw of issues) {
    const i = raw as { key?: unknown; fields?: { summary?: unknown; status?: { name?: unknown } } }
    if (typeof i?.key !== 'string') continue
    items.push({
      key: i.key,
      summary: typeof i.fields?.summary === 'string' ? i.fields.summary : '',
      status: typeof i.fields?.status?.name === 'string' ? i.fields.status.name : '',
    })
  }
  return items
}
