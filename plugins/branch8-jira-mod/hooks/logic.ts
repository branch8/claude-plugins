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
export function formatBand(ticket: Ticket, width = BAND_WIDTH, str: Strings = STRINGS['zh-TW']): string {
  const status = ticket.status || str.loading
  const head = `🎫 ${ticket.key}`
  const tail = ` · ${fitWidth(status, 24)}`
  const room = width - displayWidth(head) - displayWidth(tail) - 1
  const summary = ticket.summary && room > 3 ? ` ${fitWidth(ticket.summary, room)}` : ''
  return `${head}${summary}${tail}`
}

// The whole line above the prompt: the ticket, plus the open-ticket count
// once /jira-todo has loaded it (so a closed pane still tells you how many).
// Null when there is nothing to show.
export function bandText(
  ticket: Ticket | null,
  todoCount: number | null,
  width = BAND_WIDTH,
  str: Strings = STRINGS['zh-TW'],
  hint = false,
): string | null {
  // hint: org account with the pane closed, so the line says how to open it.
  if (!ticket) {
    if (todoCount !== null) return str.bandNoTicket(todoCount)
    return hint ? str.bandHint : null
  }
  if (todoCount === null && !hint) return formatBand(ticket, width, str)
  const tail = (todoCount === null ? '' : str.bandTail(todoCount)) + (hint ? ' · /jira-todo' : '')
  return formatBand(ticket, width - displayWidth(tail), str) + tail
}

// The system prompt section: rules plus the current ticket, so they survive
// compaction and apply to every turn, not only the first message.
export function rulesSection(ticket: Ticket | null, asked: readonly string[]): string {
  const lines = [
    'Branch8 Jira workflow (branch8-jira-mod): use the jira-workflow skill whenever the user starts a new unit of work, when work on it starts, when a pull request is opened, and when it is merged. Ask with question cards; never move a Jira status without the user confirming.',
    'After resolving or creating a ticket call mcp__branch8-jira-mod__set_ticket; after asking about a transition at a point call mcp__branch8-jira-mod__mark_asked with "<KEY>:<start|pr|merge>".',
    'When the user asks about their Jira todos or tickets, also tell them that typing /jira-todo opens the todo pane.',
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
// Only what the pane and the band draw. The default fields carry each issue's
// description: 20 of them passed the MCP's size limit, which then answers a
// pointer to a saved file instead of the JSON (2026-10-16).
export const TODO_FIELDS = ['summary', 'status', 'issuetype']
export const ISSUE_FIELDS = ['summary', 'status']

// Items from a searchJiraIssuesUsingJql result; null when unreadable.
export function parseIssueList(content: Content): TodoItem[] | null {
  const json = firstJson(content) as { data?: unknown } | null
  if (!json) return null
  const found = ((json.data ?? json) as { issues?: unknown }).issues
  // An array, or { nodes: [...] } when the search names its fields.
  const issues = Array.isArray(found) ? found : (found as { nodes?: unknown } | undefined)?.nodes
  if (!Array.isArray(issues)) return null
  const items: TodoItem[] = []
  for (const raw of issues) {
    const i = raw as {
      key?: unknown
      fields?: { summary?: unknown; status?: { name?: unknown }; issuetype?: { name?: unknown } }
    }
    if (typeof i?.key !== 'string') continue
    const item: TodoItem = {
      key: i.key,
      summary: typeof i.fields?.summary === 'string' ? i.fields.summary : '',
      status: typeof i.fields?.status?.name === 'string' ? i.fields.status.name : '',
    }
    if (typeof i.fields?.issuetype?.name === 'string') item.type = i.fields.issuetype.name
    items.push(item)
  }
  return items
}

export type TodoGroup = {
  project: string
  count: number
  statuses: { status: string; items: TodoItem[] }[]
}

// Tree for the pane: project (key prefix), then status, both in the order
// they first appear (the list is newest-updated first).
export function groupTodos(items: readonly TodoItem[]): TodoGroup[] {
  const groups: TodoGroup[] = []
  for (const item of items) {
    const project = item.key.split('-')[0] ?? item.key
    let g = groups.find(x => x.project === project)
    if (!g) {
      g = { project, count: 0, statuses: [] }
      groups.push(g)
    }
    g.count += 1
    let s = g.statuses.find(x => x.status === item.status)
    if (!s) {
      s = { status: item.status, items: [] }
      g.statuses.push(s)
    }
    s.items.push(item)
  }
  return groups
}

// The issue's page on the Jira site.
export function issueUrl(site: string, key: string): string {
  return `${site.replace(/\/+$/, '')}/browse/${key}`
}

// One tree row: key and summary only (the status is the row's group).
export function todoRow(item: TodoItem, width: number): string {
  const room = width - displayWidth(item.key) - 1
  return room > 3 ? `${item.key} ${fitWidth(item.summary, room)}` : item.key
}

// --- Language ---

export type Lang = 'zh-TW' | 'zh-CN' | 'en'
export type LangPref = Lang | 'auto'

// Same mapping as the branch8-jira-check hook: a Claude Code "language"
// setting, else the locale; anything else is English.
export function langOf(setting: string | undefined, locale?: string): Lang {
  const v = (setting || locale || '').toLowerCase().replace(/_/g, '-')
  if (/简体|簡體|simplified|^zh-cn|^zh-sg|^zh-hans/.test(v)) return 'zh-CN'
  if (/中文|繁體|繁体|正體|台灣|臺灣|香港|chinese|^zh/.test(v)) return 'zh-TW'
  return 'en'
}

const PREF_CYCLE: LangPref[] = ['zh-TW', 'zh-CN', 'en', 'auto']

// The pane's language button: 繁中 → 简中 → English → auto → 繁中.
export function nextLangPref(pref: LangPref): LangPref {
  const i = PREF_CYCLE.indexOf(pref)
  return PREF_CYCLE[(i + 1) % PREF_CYCLE.length] ?? 'auto'
}

// A chosen language wins; "auto" (or anything unknown) follows Claude Code.
export function resolveLang(pref: unknown, setting: string | undefined, locale: string | undefined): Lang {
  return pref === 'zh-TW' || pref === 'zh-CN' || pref === 'en' ? pref : langOf(setting, locale)
}

export type Strings = {
  help: readonly [string, string]
  close: string
  language: string
  langNames: Record<LangPref, string>
  open: string
  openFailed: (url: string) => string
  loading: string
  refreshing: string
  statusUnknown: string
  empty: string
  noStatus: string
  noJira: string
  signedOut: string
  queryFailed: string
  todoCount: (n: number) => string
  closed: string
  current: (key: string) => string
  bandNoTicket: (n: number) => string
  bandTail: (n: number) => string
  folderLine: (dir: string, key: string, name: string) => string
  folderUnmapped: (dir: string) => string
  changeMapping: string
  setMapping: string
  thisFolderTag: string
  otherTag: string
  scope: string
  scopeNames: Record<'folder' | 'all', string>
  confirmOther: (key: string, folderProject: string) => string
  moveThere: string
  stayHere: string
  cancel: string
  moveHint: (dir: string) => string
  menuWork: string
  helpTitle: string
  autoOpen: (on: boolean) => string
  bandHint: string
  closedHint: string
  narrowHint: string
  menuOpen: string
  menuCancel: string
  clearTicket: (key: string) => string
  menuClear: string
  cleared: string
  noFocus: string
  settings: string
  settingsBack: string
}

const LANG_NAMES = { 'zh-TW': '繁中', 'zh-CN': '简中', en: 'English' }

export const STRINGS: Record<Lang, Strings> = {
  'zh-TW': {
    help: ['Ctrl+X Tab 進面板 · Esc 回輸入框', '↑↓ 移動 · Enter 選單／收合 · o 開啟 Jira'],
    close: '✕ 關閉 Jira 面板',
    settings: '⚙ 設定',
    settingsBack: '↩ 返回',
    language: '語言：',
    langNames: { ...LANG_NAMES, auto: '自動' },
    open: '開啟',
    openFailed: url => `無法開啟瀏覽器：${url}`,
    loading: '查詢中',
    refreshing: '更新中…',
    statusUnknown: '狀態無法取得',
    empty: '沒有指派給你、還沒完成的單。',
    noStatus: '（無狀態）',
    noJira: 'Jira 沒有連線（找不到 Atlassian MCP），請先跑 /jira-check',
    signedOut: 'Jira 查詢失敗：Atlassian 可能還沒登入，請跑 /jira-check',
    queryFailed: 'Jira 查詢失敗，請稍後再試',
    todoCount: n => `Jira 待辦：${n} 張。`,
    closed: 'Jira 待辦面板已關閉（再打 /jira-todo 打開）。',
    current: key => `目前的單：${key}`,
    bandNoTicket: n => `📋 Jira 待辦 ${n} 張 · /jira-todo`,
    bandTail: n => ` · 待辦 ${n}`,
    folderLine: (dir, key, name) => `📁 ${dir} ↔ Jira ${key}${name ? `（${name}）` : ''}`,
    folderUnmapped: dir => `📁 ${dir} ↔ （未對應 Jira 專案）`,
    changeMapping: '   改對應：/jira-board',
    setMapping: '   設定：/jira-board',
    thisFolderTag: '← 本資料夾的專案',
    otherTag: '← 其他專案（非本資料夾）',
    scope: '範圍：',
    scopeNames: { folder: '本資料夾', all: '全部專案' },
    confirmOther: (key, fp) => `${key} 不屬於本資料夾的專案（${fp}）`,
    moveThere: '到該專案資料夾開新 session（建議）',
    stayHere: '仍在這裡做',
    cancel: '取消',
    moveHint: dir => `在新終端機執行：cd ${dir} && claude`,
    menuWork: '▶ 設為目前的單並處理',
    helpTitle: '⌨ 操作說明',
    autoOpen: on => `開場自動開啟：${on ? '開' : '關'}`,
    bandHint: '📋 輸入 /jira-todo 開啟 Jira 待辦',
    closedHint: '已關閉，輸入 /jira-todo 可再打開',
    narrowHint: 'Jira 待辦面板需要較寬的視窗：拉寬視窗，或隨時輸入 /jira-todo',
    menuOpen: '🔗 開啟 Jira',
    menuCancel: '✕ 取消',
    clearTicket: key => `⏹ 取消選定 ${key}`,
    menuClear: '⏹ 取消選定此任務',
    cleared: '已取消選定任務：Claude 目前沒有綁定任何單',
    noFocus: '請先用 ↑↓ 把游標移到一張單上，再按 o',
  },
  'zh-CN': {
    help: ['Ctrl+X Tab 进面板 · Esc 回输入框', '↑↓ 移动 · Enter 菜单／收合 · o 打开 Jira'],
    close: '✕ 关闭 Jira 面板',
    settings: '⚙ 设置',
    settingsBack: '↩ 返回',
    language: '语言：',
    langNames: { ...LANG_NAMES, auto: '自动' },
    open: '打开',
    openFailed: url => `无法打开浏览器：${url}`,
    loading: '查询中',
    refreshing: '更新中…',
    statusUnknown: '无法取得状态',
    empty: '没有指派给你、尚未完成的单。',
    noStatus: '（无状态）',
    noJira: 'Jira 未连接（找不到 Atlassian MCP），请先运行 /jira-check',
    signedOut: 'Jira 查询失败：Atlassian 可能尚未登录，请运行 /jira-check',
    queryFailed: 'Jira 查询失败，请稍后再试',
    todoCount: n => `Jira 待办：${n} 张。`,
    closed: 'Jira 待办面板已关闭（再输入 /jira-todo 打开）。',
    current: key => `当前的单：${key}`,
    bandNoTicket: n => `📋 Jira 待办 ${n} 张 · /jira-todo`,
    bandTail: n => ` · 待办 ${n}`,
    folderLine: (dir, key, name) => `📁 ${dir} ↔ Jira ${key}${name ? `（${name}）` : ''}`,
    folderUnmapped: dir => `📁 ${dir} ↔ （未对应 Jira 项目）`,
    changeMapping: '   改对应：/jira-board',
    setMapping: '   设置：/jira-board',
    thisFolderTag: '← 本文件夹的项目',
    otherTag: '← 其他项目（非本文件夹）',
    scope: '范围：',
    scopeNames: { folder: '本文件夹', all: '全部项目' },
    confirmOther: (key, fp) => `${key} 不属于本文件夹的项目（${fp}）`,
    moveThere: '到该项目文件夹开新 session（建议）',
    stayHere: '仍在这里做',
    cancel: '取消',
    moveHint: dir => `在新终端运行：cd ${dir} && claude`,
    menuWork: '▶ 设为当前的单并处理',
    helpTitle: '⌨ 操作说明',
    autoOpen: on => `启动时自动打开：${on ? '开' : '关'}`,
    bandHint: '📋 输入 /jira-todo 打开 Jira 待办',
    closedHint: '已关闭，输入 /jira-todo 可再打开',
    narrowHint: 'Jira 待办面板需要较宽的窗口：拉宽窗口，或随时输入 /jira-todo',
    menuOpen: '🔗 打开 Jira',
    menuCancel: '✕ 取消',
    clearTicket: key => `⏹ 取消选定 ${key}`,
    menuClear: '⏹ 取消选定此任务',
    cleared: '已取消选定任务：Claude 当前没有绑定任何单',
    noFocus: '请先用 ↑↓ 把光标移到一张单上，再按 o',
  },
  en: {
    help: ['Ctrl+X Tab: into pane · Esc: back', '↑↓ move · Enter menu/fold · o open Jira'],
    close: '✕ Close the Jira pane',
    settings: '⚙ Settings',
    settingsBack: '↩ Back',
    language: 'Language: ',
    langNames: { ...LANG_NAMES, auto: 'Auto' },
    open: 'Open',
    openFailed: url => `Could not open a browser: ${url}`,
    loading: 'loading',
    refreshing: 'Refreshing…',
    statusUnknown: 'status unavailable',
    empty: 'No open tickets assigned to you.',
    noStatus: '(no status)',
    noJira: 'Jira is not connected (no Atlassian MCP). Run /jira-check',
    signedOut: 'Jira query failed: Atlassian may be signed out. Run /jira-check',
    queryFailed: 'Jira query failed, try again later',
    todoCount: n => `Jira: ${n} open tickets.`,
    closed: 'Jira pane closed (/jira-todo opens it again).',
    current: key => `Current ticket: ${key}`,
    bandNoTicket: n => `📋 Jira: ${n} open · /jira-todo`,
    bandTail: n => ` · ${n} open`,
    folderLine: (dir, key, name) => `📁 ${dir} ↔ Jira ${key}${name ? ` (${name})` : ''}`,
    folderUnmapped: dir => `📁 ${dir} ↔ (no Jira project)`,
    changeMapping: '   change: /jira-board',
    setMapping: '   set: /jira-board',
    thisFolderTag: "← this folder's project",
    otherTag: '← other project',
    scope: 'Scope: ',
    scopeNames: { folder: 'this folder', all: 'all projects' },
    confirmOther: (key, fp) => `${key} is not this folder's project (${fp})`,
    moveThere: "Open a session in its folder (recommended)",
    stayHere: 'Work on it here',
    cancel: 'Cancel',
    moveHint: dir => `In a new terminal: cd ${dir} && claude`,
    menuWork: '▶ Make it the current ticket',
    helpTitle: '⌨ Keys',
    autoOpen: on => `Open at start: ${on ? 'on' : 'off'}`,
    bandHint: '📋 Type /jira-todo for your Jira todos',
    closedHint: 'Closed. Type /jira-todo to open it again',
    narrowHint: 'The Jira pane needs a wider window: widen it, or type /jira-todo any time',
    menuOpen: '🔗 Open in Jira',
    menuCancel: '✕ Cancel',
    clearTicket: key => `⏹ Unselect ${key}`,
    menuClear: '⏹ Unselect this ticket',
    cleared: 'Ticket unselected: Claude has no current ticket',
    noFocus: 'Move to a ticket with ↑↓ first, then press o',
  },
}

// Kept for callers that want the default help lines.
export const TODO_HELP = STRINGS['zh-TW'].help

// --- Status colours ---

export type Tone = 'success' | 'warning' | 'error' | 'suggestion' | 'inactive' | 'subtle'

// Colour a status by what its name says; Jira's own categories are not
// reliable here (HS files 已取消 as in progress, HTGO2 files WIP as to do).
export function statusTone(status: string): Tone {
  // The [HOTFIX] tag names a lane, not a problem; drop it before matching "fix".
  const s = status.toLowerCase().replace(/hotfix/g, '')
  if (/取消|cancel|discard/.test(s)) return 'inactive'
  if (/fix|block|pending|hold|rca|root cause/.test(s)) return 'error'
  if (/qa done|deployed|完成|^done|ready to deploy|merged|release/.test(s)) return 'success'
  if (/進行中|进行中|wip|in progress|dev done|qa ?ing|qa to ?do|review|pr created/.test(s)) return 'warning'
  if (/待辦|待办|to ?do|backlog|discuss|open/.test(s)) return 'suggestion'
  return 'subtle'
}

// --- Folder ↔ Jira project: the records branch8-jira-check keeps ---

// File name of a folder's record, exactly as hooks/lib.sh computes it.
export function recordFileName(dir: string): string {
  const key = dir.replace(/[/\\: ]/g, '_').replace(/^_+/, '')
  return `${key || 'root'}.json`
}

// The folder itself, then each parent up to the root (POSIX or Windows).
export function ancestorDirs(dir: string): string[] {
  const sep = dir.includes('\\') ? '\\' : '/'
  const out: string[] = []
  let cur = dir.replace(/[/\\]+$/, '') || sep
  for (;;) {
    out.push(cur)
    const i = cur.lastIndexOf(sep)
    if (i < 0) break
    const parent = i === 0 ? sep : /^[A-Za-z]:$/.test(cur.slice(0, i)) ? cur.slice(0, i) + sep : cur.slice(0, i)
    if (parent === cur) break
    cur = parent
  }
  return out
}

export type FolderRecord = { kind: 'project'; key: string; name: string } | { kind: 'none' }

export function parseRecord(text: string): FolderRecord | null {
  try {
    const r = JSON.parse(text) as { projectKey?: unknown; projectName?: unknown; jira?: unknown; company?: unknown }
    if (typeof r.projectKey === 'string' && r.projectKey) {
      return { kind: 'project', key: r.projectKey, name: typeof r.projectName === 'string' ? r.projectName : '' }
    }
    if (r.jira === 'none' || r.company === false) return { kind: 'none' }
    return null
  } catch {
    return null
  }
}

export function projectOf(key: string): string {
  return key.split('-')[0] ?? key
}

// A ticket outside this folder's Jira project (false when the folder has none).
export function isOtherProject(key: string, folderProject: string | null): boolean {
  return !!folderProject && projectOf(key) !== folderProject
}

export type Scope = 'folder' | 'all'

// "auto" (or unknown) shows this folder's project when it has one.
export function effectiveScope(pref: unknown, folderProject: string | null): Scope {
  if (!folderProject) return 'all'
  return pref === 'all' ? 'all' : 'folder'
}

export function applyScope(items: readonly TodoItem[], scope: Scope, folderProject: string | null): TodoItem[] {
  return scope === 'folder' && folderProject ? items.filter(i => projectOf(i.key) === folderProject) : [...items]
}

// Folders recorded for a Jira project, for "open a session there".
export function foldersFor(records: readonly { dir: string; text: string }[], projectKey: string): string[] {
  return records.filter(r => {
    const rec = parseRecord(r.text)
    return rec?.kind === 'project' && rec.key === projectKey
  }).map(r => r.dir)
}

// Where branch8-jira-check suggests a new project folder.
export function suggestedFolder(workspaceRoot: string, projectKey: string): string {
  return `${workspaceRoot.replace(/[/\\]+$/, '')}/${projectKey}`
}

// Icon for a Jira issue type, by name (each project names its own types).
export function typeIcon(type: string | undefined): string {
  const t = (type ?? '').toLowerCase()
  if (/hotfix/.test(t)) return '🔥'
  if (/sub-?task|子任務|子任务/.test(t)) return '🔹'
  if (/bug|錯誤|错误|漏洞|defect/.test(t)) return '🐞'
  if (/epic|大型工作/.test(t)) return '⚡'
  if (/story|故事|功能|feature/.test(t)) return '✨'
  if (/task|任務|任务/.test(t)) return '✅'
  if (/inquire|詢問|询问|question/.test(t)) return '❓'
  return '📄'
}

// The ticket under the pane's cursor, from the focused element's key: a
// ticket row is keyed by its issue key; anything else (a button, a menu
// item) means no ticket, so a stale one is never reused.
export function focusedTicket(element: string | undefined): string | null {
  return element && /^[A-Z][A-Z0-9_]*-\d+$/.test(element) ? element : null
}

// Whether Claude Code is signed in to the Branch8 organisation, from the
// config dir's .claude.json (as branch8-jira-check's banner decides). An API
// key, token or cloud provider overrides that login, so it never counts.
export function isOrgAccount(claudeJson: string, orgId: string, hasLoginOverride: boolean): boolean {
  if (hasLoginOverride || !orgId) return false
  try {
    const j = JSON.parse(claudeJson) as { oauthAccount?: { organizationUuid?: unknown } }
    return j.oauthAccount?.organizationUuid === orgId
  } catch {
    return false
  }
}

// A tool call that may have written a branch8-jira-check folder record, so
// the pane's folder ↔ project line should be read again at once.
export function touchesFolderRecords(tool: string, input: Record<string, unknown>): boolean {
  const path = /branch8-jira[/\\]projects/
  if (tool === 'Write' || tool === 'Edit' || tool === 'MultiEdit') {
    return typeof input.file_path === 'string' && path.test(input.file_path)
  }
  if (tool === 'Bash') return typeof input.command === 'string' && path.test(input.command)
  return false
}
