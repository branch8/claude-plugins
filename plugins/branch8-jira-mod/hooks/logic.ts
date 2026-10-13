// Pure logic for the Branch8 Jira mod: no engine calls here, so it is
// unit-testable. register.tsx wires these into the engine.
import type { Node, Ticket, TodoItem } from '../types'

const EDIT_TOOLS = new Set(['Edit', 'Write', 'MultiEdit', 'NotebookEdit'])
const SKIP_FLAGS = /(^|\s)(--help|-h|--dry-run|--abort|--continue|--quit)(\s|$)/

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
  for (const part of unquoted(input.command).split(/&&|\|\||;|\n/)) {
    const p = part.trim()
    if (SKIP_FLAGS.test(p)) continue
    if (/^gh\s+pr\s+create\b/.test(p)) return 'pr'
    if (/^gh\s+pr\s+merge\b/.test(p)) return 'merge'
    if (/^git\s+merge(\s|$)/.test(p)) return 'merge'
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

const SUMMARY_MAX = 50

// One line above the prompt.
export function formatBand(ticket: Ticket, max = SUMMARY_MAX): string {
  const s =
    ticket.summary.length > max
      ? ticket.summary.slice(0, max - 1) + '…'
      : ticket.summary
  // Before the first Jira refresh the summary and status may still be empty.
  return `🎫 ${ticket.key}${s ? ` ${s}` : ''} · ${ticket.status || '查詢中'}`
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
      `Current ticket: ${ticket.key} "${ticket.summary}" (${ticket.status}). Points already asked: ${mine.length ? mine.join(', ') : 'none'}.`,
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
