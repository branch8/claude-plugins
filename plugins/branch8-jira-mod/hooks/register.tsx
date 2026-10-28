// Engine wiring for the Branch8 Jira mod. The judgment (which ticket, which
// transition) belongs to the jira-workflow skill; this module only keeps the
// current ticket, reminds Claude at the three points, puts the rules in the
// system prompt and draws the ticket above the prompt. It never writes Jira.
import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Ticket, Transition } from '../types'
import type { FolderRecord, Lang, LangPref, Scope, SignIn } from './logic'
import {
  STRINGS,
  isNoConnectedTool,
  parseGhStatus,
  ancestorDirs,
  applyScope,
  effectiveScope,
  isOtherProject,
  parseRecord,
  projectOf,
  recordFileName,
  suggestedFolder,
  typeIcon,
  focusedTicket,
  isOrgAccount,
  touchesFolderRecords,
  focusOrder,
  stepFocus,
  isArrowScroll,
  syncTicket,
  pickNote,
  manifestVersion,
  isNewer,
  updateOutcome,
  parseTransitions,
  moveNote,
  claudeAccount,
  parseJiraUser,
  jiraWarning,
  leftFrom,
  settingsValues,
  menuValues,
  todoJql,
  nextRange,
  parseIssuePage,
  DEFAULT_RANGE,
  TODO_FIELDS,
  ISSUE_FIELDS,
  detectNode,
  bandText,
  formatBand,
  groupTodos,
  issueUrl,
  nextLangPref,
  resolveLang,
  statusTone,
  parseIssueList,
  parseIssueStatus,
  reminderFor,
  rulesSection,
  todoRow,
} from './logic'

const P = 'branch8-jira-mod'
const ticketAtom = atom({ plugin: 'branch8-jira-mod', key: 'ticket' } as const, null)
const askedAtom = atom({ plugin: 'branch8-jira-mod', key: 'asked' } as const, [])
// The ticket whose unknown status was asked of Jira once; the band never polls.
const statusAskedAtom = atom({ plugin: 'branch8-jira-mod', key: 'statusAskedFor' } as const, null)
const todosAtom = atom({ plugin: 'branch8-jira-mod', key: 'todos' } as const, {
  items: [],
  error: null,
  isLoading: false,
  isLoaded: false,
  next: null,
})
// Only tickets updated within this many days (0: any age); kept in $.store.
const rangeAtom = atom({ plugin: 'branch8-jira-mod', key: 'range' } as const, DEFAULT_RANGE)
// Whether the /jira-todo pane is open. Closed works as collapsed: the list
// stays here, the band shows its count, /jira-todo reopens it at once.
const todoOpenAtom = atom({ plugin: 'branch8-jira-mod', key: 'todoOpen' } as const, false)
// Language of everything the mod draws: the pane's button picks it, kept in
// $.store across sessions; "auto" follows Claude Code's language setting.
const langPrefAtom = atom({ plugin: 'branch8-jira-mod', key: 'langPref' } as const, 'auto')
const langAtom = atom({ plugin: 'branch8-jira-mod', key: 'lang' } as const, 'en')
// Projects folded in the /jira-todo tree.
const todoFoldedAtom = atom({ plugin: 'branch8-jira-mod', key: 'todoFolded' } as const, [])
// Statuses folded in the tree, as "<PROJECT>/<status>".
const statusFoldedAtom = atom({ plugin: 'branch8-jira-mod', key: 'statusFolded' } as const, [])
// Scope of the list: "auto" (this folder's project when it has one), "folder" or "all".
const scopePrefAtom = atom({ plugin: 'branch8-jira-mod', key: 'scopePref' } as const, 'auto')
// This session's folder and the Jira project branch8-jira-check recorded for it.
const folderAtom = atom({ plugin: 'branch8-jira-mod', key: 'folder' } as const, { dir: '', project: null, name: '' })
// Open the pane by itself at session start on the organisation account.
const autoOpenAtom = atom({ plugin: 'branch8-jira-mod', key: 'autoOpen' } as const, true)
// Signed in to the Branch8 organisation: hints about /jira-todo while the pane is closed.
const orgAtom = atom({ plugin: 'branch8-jira-mod', key: 'isOrg' } as const, false)
// The row menu open under one ticket (Enter on a row), if any.
const menuAtom = atom({ plugin: 'branch8-jira-mod', key: 'menu' } as const, null)
// The settings popup under the toolbar's ⚙ button: null when closed.
// The account block at the top of the pane.
const accountAtom = atom({ plugin: 'branch8-jira-mod', key: 'account' } as const, {
  claude: null,
  jira: null,
  isJiraChecked: false,
  isJiraOut: false,
  github: null,
  devin: null,
})
const settingsAtom = atom({ plugin: 'branch8-jira-mod', key: 'settings' } as const, null)
// The ticket row the pane's focus ring is on, for the "o" hotkey.
const focusedAtom = atom({ plugin: 'branch8-jira-mod', key: 'focusedKey' } as const, null)
// The pane element the ring is on, of any kind: where the arrows step from.
const ringAtom = atom({ plugin: 'branch8-jira-mod', key: 'ring' } as const, null)
// This mod's version, from its plugin.json, so a person can tell which one runs.
const versionAtom = atom({ plugin: 'branch8-jira-mod', key: 'version' } as const, null)
// The version published on main, and whether an update the pane started runs.
const latestAtom = atom({ plugin: 'branch8-jira-mod', key: 'latest' } as const, { version: null, isUpdating: false })
// The published manifest: the repo is public, so no sign-in is needed.
const LATEST_URL = 'https://raw.githubusercontent.com/branch8/claude-plugins/main/plugins/branch8-jira-mod/.claude-plugin/plugin.json'
const PLUGIN_ID = 'branch8-jira-mod@branch8'

// The company Jira site, used when no ticket has given a cloudId yet.
const SITE = 'https://branch8.atlassian.net'
// Branch8's Claude organisation (as branch8-jira-check's config.env); BRANCH8_ORG_ID overrides.
const DEFAULT_ORG_ID = 'a4a2aa1a-21cd-467f-af54-8253e2ed15d8'
// Retries for the start-up load while the Atlassian MCP is still connecting.
const AUTO_RETRY_MS = [5_000, 15_000, 30_000]
const TODO_PANE = 'branch8-jira-todo'
const TODO_LIMIT = 20
// Columns a pane row may take; the pane is narrow and CJK titles wrap past it.
const PANE_WIDTH = 46
// A tree row: indent (4) and the Open button (6) come off the pane width.
const ROW_WIDTH = PANE_WIDTH - 10

// The Atlassian MCP under either name it is installed as.
const ATLASSIAN = ['plugin:atlassian:atlassian', 'claude.ai Atlassian Rovo']
// Devin's DeepWiki (branch8-deepwiki), and wiki tools it lists only once signed
// in - names differ by server version, so any one of them will do.
const DEVIN = 'plugin:branch8-deepwiki:devin'
const DEVIN_TOOLS = ['read_wiki_structure', 'ask_question', 'ask_wiki_question']

const str = (v: unknown) => (typeof v === 'string' ? v : '')

async function applyLang($: EngineInterface, pref: LangPref) {
  let setting: string | undefined
  try {
    const { language } = (await $.settings.read()) as { language?: unknown }
    setting = typeof language === 'string' ? language : undefined
  } catch {
    // Settings unreadable: fall back to the locale.
  }
  const lang: Lang = resolveLang(pref, setting, await $.env.get('LANG'))
  await update($, langPrefAtom, () => pref)
  await update($, langAtom, () => lang)
}

// Opens a URL in the person's browser: WSL hands it to Windows, macOS to
// `open`, Linux to `xdg-open`, native Windows to `start`. False if none ran.
async function openUrl($: EngineInterface, url: string): Promise<boolean> {
  const wsl = await $.env.get('WSL_DISTRO_NAME')
  const tries: string[][] = wsl
    ? [['wslview', url], ['cmd.exe', '/c', 'start', '', url]]
    : [['open', url], ['xdg-open', url], ['cmd', '/c', 'start', '', url]]
  for (const argv of tries) {
    try {
      const r = await $.process.run(argv, { timeoutMs: 10_000 })
      if (r.exitCode === 0) return true
    } catch {
      // Not installed here; try the next opener.
    }
  }
  return false
}

async function homeDir($: EngineInterface): Promise<string> {
  return (await $.env.get('HOME')) || (await $.env.get('USERPROFILE')) || ''
}

// The records branch8-jira-check writes, one file per folder.
async function stateDir($: EngineInterface): Promise<string> {
  return `${await homeDir($)}/.claude/branch8-jira/projects`
}

// Which Jira project this session's folder belongs to: the repo root inside a
// git repo, else the folder; the nearest record above it wins (as lib.sh).
async function resolveFolder($: EngineInterface): Promise<void> {
  const cwd = await $.session.cwd()
  let base = cwd
  try {
    const r = await $.process.run(['git', '-C', cwd, 'rev-parse', '--show-toplevel'], { timeoutMs: 5_000 })
    if (r.exitCode === 0 && r.stdout.trim()) base = r.stdout.trim()
  } catch {
    // No git: the folder itself is the unit.
  }
  const dirs = await stateDir($)
  let rec: FolderRecord | null = null
  for (const dir of ancestorDirs(base)) {
    const file = `${dirs}/${recordFileName(dir)}`
    if (!(await $.fs.exists(file))) continue
    rec = parseRecord(await $.fs.read(file))
    if (rec) break
  }
  const name = base.split(/[/\\]/).filter(Boolean).pop() || base
  await update($, folderAtom, () =>
    rec?.kind === 'project'
      ? { dir: name, project: rec.key, name: rec.name }
      : { dir: name, project: null, name: '', noJira: rec?.kind === 'none' },
  )
}

// Where to suggest working on another project: a folder recorded for it,
// else the workspace folder branch8-jira-check would create.
async function folderForProject($: EngineInterface, key: string): Promise<string> {
  const dirs = await stateDir($)
  try {
    for (const entry of await $.fs.list(dirs)) {
      if (!entry.name.endsWith('.json')) continue
      const text = await $.fs.read(`${dirs}/${entry.name}`)
      const rec = parseRecord(text)
      if (rec?.kind !== 'project' || rec.key !== key) continue
      const dir = (JSON.parse(text) as { projectDir?: unknown }).projectDir
      if (typeof dir === 'string' && dir) return dir
    }
  } catch {
    // No records yet.
  }
  const root = (await $.env.get('BRANCH8_WORKSPACE_ROOT')) || `${await homeDir($)}/Branch8`
  return suggestedFolder(root, key)
}

// Reads the open-ticket list into the pane's state; the reply for the command.
// Moves the pane's ring and records it at once: the ui.focus hook records it
// too, but not before the next arrow when the element is drawn in this pass.
async function focusOn($: EngineInterface, key: string): Promise<void> {
  await update($, ringAtom, () => key)
  await $.ui.focus({ requestId: TODO_PANE, key })
}

// Fills the pane's list: the first page afresh, or with `more` the next page
// after what is loaded. The search names its range and, scoped to this
// folder, its project, so Jira sends only what the pane shows.
// Tells Claude, in a row it reads but the person does not see as typed, what
// the person just picked in the pane; see pickNote for why the system prompt
// alone is not enough. A refusal or failure only loses the note.
async function tellClaude($: EngineInterface, ticket: Ticket | null): Promise<void> {
  try {
    await $.session.append({ message: { type: 'user', content: [{ type: 'text', text: pickNote(ticket) }] } })
  } catch {
    // The band and the rules section still show the ticket.
  }
}

// Reads the version published on main; a refused or failed fetch leaves it
// unknown and the pane offers no update.
async function checkLatest($: EngineInterface): Promise<void> {
  try {
    const res = await $.http.fetch(LATEST_URL)
    if (res.ok) await update($, latestAtom, l => ({ ...l, version: manifestVersion(res.text) }))
  } catch {
    // Offline, or the organisation's web-fetch policy refused it.
  }
}

// Updates the marketplace, then this plugin, as the person would with
// /plugin; then reloads plugins so the new version runs. The CLI only: on
// other surfaces the process call fails and the toast gives the command.
async function runUpdate($: EngineInterface, str: (typeof STRINGS)[Lang]): Promise<void> {
  await update($, latestAtom, l => ({ ...l, isUpdating: true }))
  $.ui.toast(str.updating)
  try {
    const steps = [
      ['claude', 'plugin', 'marketplace', 'update', 'branch8'],
      ['claude', 'plugin', 'update', PLUGIN_ID],
    ]
    let said = ''
    for (const argv of steps) {
      const r = await $.process.run(argv, { timeoutMs: 120_000 })
      if (r.exitCode !== 0) throw new Error(r.stderr || r.stdout)
      said = r.stdout
    }
    const outcome = updateOutcome(said)
    if (!outcome) throw new Error(said)
    if (outcome.kind === 'latest') {
      $.ui.toast(str.alreadyLatest(outcome.version))
      return
    }
    $.ui.toast(str.updated(outcome.version))
    try {
      await $.command.run({ command: 'reload-plugins' })
    } catch {
      // The toast already says to open a new session if it does not take.
    }
  } catch {
    $.ui.toast(str.updateFailed)
  } finally {
    await update($, latestAtom, l => ({ ...l, isUpdating: false }))
  }
}

// The moves a ticket can make now, from whichever Atlassian server answers;
// null when neither does.
async function loadTransitions($: EngineInterface, key: string, current: string): Promise<Transition[] | null> {
  const cloudId = (await read($, ticketAtom))?.cloudId || SITE
  const calls: [string, string, Record<string, unknown>][] = [
    [ATLASSIAN[0]!, 'executeRead', { name: 'listJiraIssueTransitions', cloudId, inputs: { issueIdOrKey: key } }],
    [ATLASSIAN[1]!, 'getTransitionsForJiraIssue', { cloudId, issueIdOrKey: key }],
  ]
  for (const [server, tool, args] of calls) {
    try {
      const res = await $.mcp.call(server, tool, args)
      if (res.isError) continue
      const list = parseTransitions(res.content as { type: string; text?: string }[], current)
      if (list) return list
    } catch {
      // Not connected under this name; try the next one.
    }
  }
  return null
}

// Moves a ticket in Jira; false when no server takes it (fields to fill, no
// permission, or not connected). The person confirmed it in the pane.
async function moveTicket($: EngineInterface, key: string, transitionId: string): Promise<boolean> {
  const cloudId = (await read($, ticketAtom))?.cloudId || SITE
  const calls: [string, Record<string, unknown>][] = [
    [ATLASSIAN[0]!, { cloudId, issueIdOrKey: key, transitionId }],
    [ATLASSIAN[1]!, { cloudId, issueIdOrKey: key, transition: { id: transitionId } }],
  ]
  for (const [server, args] of calls) {
    try {
      const res = await $.mcp.call(server, 'transitionJiraIssue', args)
      if (!res.isError) return true
    } catch {
      // Not connected under this name; try the next one.
    }
  }
  return false
}

async function loadTodos(
  $: EngineInterface,
  str: (typeof STRINGS)[Lang],
  more = false,
): Promise<{ ok: boolean; text: string }> {
  const before = await read($, todosAtom)
  if (more && !before.next) return { ok: true, text: str.todoCount(before.items.length) }
  await update($, todosAtom, t => ({ ...t, error: null, isLoading: true }))
  const cloudId = (await read($, ticketAtom))?.cloudId || SITE
  const folder = await read($, folderAtom)
  const scope = effectiveScope(await read($, scopePrefAtom), folder.project)
  const jql = todoJql({ days: await read($, rangeAtom), project: scope === 'folder' ? folder.project : null })
  let error = str.noJira
  for (const server of ATLASSIAN) {
    try {
      const res = await $.mcp.call(server, 'searchJiraIssuesUsingJql', {
        cloudId,
        jql,
        maxResults: TODO_LIMIT,
        fields: TODO_FIELDS,
        ...(more && before.next ? { nextPageToken: before.next } : {}),
      })
      if (res.isError) {
        // Installed but signed out answers isError: try the other server.
        error = str.signedOut
        continue
      }
      const page = parseIssuePage(res.content as { type: string; text?: string }[])
      if (page) {
        const seen = new Set(more ? before.items.map(i => i.key) : [])
        const items = more ? [...before.items, ...page.items.filter(i => !seen.has(i.key))] : page.items
        await update($, todosAtom, () => ({ items, error: null, isLoading: false, isLoaded: true, next: page.next }))
        // The band follows the list: a status moved in Jira shows on the next
        // load or refresh, with no request of its own.
        const synced = syncTicket(await read($, ticketAtom), items)
        if (synced) await update($, ticketAtom, () => synced)
        // Jira answers now: the account block can name its user.
        void loadJiraUser($)
        return { ok: true, text: str.todoCount(items.length) }
      }
      error = str.queryFailed
    } catch {
      // Not connected under this name; try the next one.
    }
  }
  await update($, todosAtom, t => ({ ...t, error, isLoading: false }))
  return { ok: false, text: error }
}

// Signed in to the Branch8 organisation through claude.ai (not an API key,
// token or cloud provider), read from the config dir's .claude.json.
async function onOrgAccount($: EngineInterface): Promise<boolean> {
  const overrides = [
    await $.env.get('ANTHROPIC_API_KEY'),
    await $.env.get('ANTHROPIC_AUTH_TOKEN'),
    await $.env.get('CLAUDE_CODE_OAUTH_TOKEN'),
    await $.env.get('CLAUDE_CODE_USE_BEDROCK'),
    await $.env.get('CLAUDE_CODE_USE_VERTEX'),
    await $.env.get('CLAUDE_CODE_USE_FOUNDRY'),
  ]
  const text = await readClaudeJson($)
  if (text === null) return false
  const orgId = (await $.env.get('BRANCH8_ORG_ID')) || DEFAULT_ORG_ID
  return isOrgAccount(text, orgId, overrides.some(Boolean))
}

// The config dir's .claude.json (it follows CLAUDE_CONFIG_DIR), else the one
// in home; null when neither exists.
async function readClaudeJson($: EngineInterface): Promise<string | null> {
  const home = await homeDir($)
  for (const dir of [(await $.env.get('CLAUDE_CONFIG_DIR')) || home, home]) {
    const file = `${dir}/.claude.json`
    if (await $.fs.exists(file)) return $.fs.read(file)
  }
  return null
}

// Asks once which Jira user the Atlassian MCP is signed in as, for the
// account block; the plugin server's atlassianUserInfo gives no email.
async function loadJiraUser($: EngineInterface): Promise<void> {
  if ((await read($, accountAtom)).isJiraChecked) return
  const cloudId = (await read($, ticketAtom))?.cloudId || SITE
  const calls: [string, string, Record<string, unknown>][] = [
    [ATLASSIAN[0]!, 'executeRead', { name: 'getJiraCurrentUser', cloudId, inputs: {} }],
    [ATLASSIAN[1]!, 'atlassianUserInfo', {}],
  ]
  for (const [server, tool, args] of calls) {
    try {
      const res = await $.mcp.call(server, tool, args)
      if (res.isError) continue
      const user = parseJiraUser(res.content as { type: string; text?: string }[])
      if (user) {
        await update($, accountAtom, a => ({ ...a, jira: user, isJiraChecked: true }))
        return
      }
    } catch {
      // Not connected under this name; try the next one.
    }
  }
}

// GitHub through the gh CLI, checked only in a git folder: people outside one
// (PMs' documents, research) rarely need it, and the row is left out for them.
async function githubSignIn($: EngineInterface): Promise<SignIn> {
  try {
    const git = await $.process.run(['git', 'rev-parse', '--is-inside-work-tree'], { timeoutMs: 5_000 })
    if (git.exitCode !== 0) return { state: 'skip', user: '' }
  } catch {
    return { state: 'skip', user: '' }
  }
  try {
    const gh = await $.process.run(['gh', 'auth', 'status', '--hostname', 'github.com'], { timeoutMs: 8_000 })
    return parseGhStatus(gh.exitCode, gh.stdout + gh.stderr)
  } catch {
    // gh could not start (not installed) or hung.
    return { state: 'missing', user: '' }
  }
}

// Devin is signed in once one of its wiki tools gets past the engine's
// "no connected tool" check; the server's own answer to empty arguments, error
// or not, still proves the sign-in.
async function devinSignIn($: EngineInterface): Promise<SignIn> {
  for (const tool of DEVIN_TOOLS) {
    try {
      await $.mcp.call(DEVIN, tool, {})
      return { state: 'in', user: '' }
    } catch (err) {
      if (!isNoConnectedTool(err)) return { state: 'in', user: '' }
    }
  }
  return { state: 'out', user: '' }
}

// The pane's GitHub and Devin rows, and the Jira user. MCP servers are still
// connecting at start, so this runs again on the start-up retries and on
// refresh; `final` marks Jira signed out once the last retry still finds none.
async function loadSignIns($: EngineInterface, final = false): Promise<void> {
  const [github, devin] = await Promise.all([githubSignIn($), devinSignIn($), loadJiraUser($)])
  await update($, accountAtom, a => ({ ...a, github, devin, isJiraOut: final && !a.isJiraChecked }))
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    // Side by side: one after another took up to 15 s at start (2026-10-20),
    // and the first session.start holds the first prompt until it passes.
    await Promise.all([
      $.tool.register({
        name: 'set_ticket',
        description:
          'Record the Jira ticket the current task belongs to: it shows above the prompt and the mod reminds you at the start / PR / merge points. Call after the jira-workflow skill resolves or creates a ticket.',
        inputSchema: {
          type: 'object',
          required: ['key', 'cloudId'],
          properties: {
            key: { type: 'string', description: 'Issue key, e.g. HS-123' },
            summary: { type: 'string' },
            status: { type: 'string', description: 'Current status name' },
            cloudId: { type: 'string', description: 'Atlassian cloudId or site URL' },
            confirmedOtherProject: {
              type: 'boolean',
              description: 'True only after the user agreed to work here on a ticket from a project other than this folder\'s',
            },
          },
        },
        isDeferred: false,
      }),
      $.tool.register({
        name: 'get_ticket',
        description: 'The current Jira ticket of this session and the workflow points already asked about.',
        isDeferred: false,
      }),
      $.tool.register({
        name: 'clear_ticket',
        description:
          'Unselect the current Jira ticket, so this session is tied to none (the user asked to stop tracking a ticket, or the work is not ticket work).',
        isDeferred: false,
      }),
      $.tool.register({
        name: 'mark_asked',
        description:
          'Record that the user was asked about a status transition at a point, as "<KEY>:<start|pr|merge>", so it is not asked again.',
        inputSchema: { type: 'object', required: ['mark'], properties: { mark: { type: 'string' } } },
        isDeferred: false,
      }),
      $.command.register({
        name: 'jira-todo',
        description: 'Jira 待辦 / open tickets: pick one as the current ticket',
      }),
    ])
    // Last, and guarded: a language that fails to load must not cost the
    // tools and the command registered above.
    try {
      await resolveFolder($)
    } catch {
      // Unknown folder: the list shows every project.
    }
    try {
      const scope = await $.store.get('scope')
      if (scope === 'folder' || scope === 'all') await update($, scopePrefAtom, () => scope)
    } catch {
      // Stays on auto.
    }
    try {
      const manifest = await $.fs.read(`${$.plugin.root}/.claude-plugin/plugin.json`)
      await update($, versionAtom, () => manifestVersion(manifest))
    } catch {
      // The pane shows no version.
    }
    // In the background: the pane offers the update once it answers.
    void checkLatest($)
    // In the background too, again while MCP servers are still connecting.
    void loadSignIns($)
    AUTO_RETRY_MS.forEach((ms, i) => {
      $.clock.after(ms, () => {
        void (async () => {
          const a = await read($, accountAtom)
          const isLast = i === AUTO_RETRY_MS.length - 1
          if (a.isJiraChecked && a.devin?.state === 'in' && !isLast) return
          await loadSignIns($, isLast)
        })()
      })
    })
    try {
      const text = await readClaudeJson($)
      const claude = text === null ? null : claudeAccount(text)
      await update($, accountAtom, a => ({ ...a, claude }))
    } catch {
      // The block leaves the Claude line out.
    }
    try {
      const range = await $.store.get('range')
      if (typeof range === 'number' && range >= 0) await update($, rangeAtom, () => range)
    } catch {
      // Stays on the default range.
    }
    try {
      const pref = await $.store.get('lang')
      await applyLang($, pref === 'zh-TW' || pref === 'zh-CN' || pref === 'en' ? pref : 'auto')
    } catch {
      // Stays on the default (English).
    }
    // Last: open the pane by itself on the organisation account, without
    // taking the keyboard, and fill it once the Atlassian MCP answers.
    try {
      const pref = await $.store.get('autoOpen')
      await update($, autoOpenAtom, () => pref !== false)
      const isOrg = await onOrgAccount($)
      await update($, orgAtom, () => isOrg)
      if (pref !== false && isOrg) {
        const opened = await $.ui.open({ id: TODO_PANE, title: 'Jira' })
        await update($, todoOpenAtom, () => true)
        const str = STRINGS[(await read($, langAtom)) as Lang]
        // Opened unasked, a narrow terminal keeps it undrawn: say how to get it.
        if (!opened.isPlaced) $.ui.toast(str.narrowHint)
        // In the background: the Atlassian MCP is still connecting at start, and
        // waiting on it here held session.start for 17 s (2026-10-20).
        void (async () => {
          const first = await loadTodos($, str)
          if (first.ok) return
          for (const ms of AUTO_RETRY_MS) {
            $.clock.after(ms, () => {
              void (async () => {
                const todos = await read($, todosAtom)
                if (todos.isLoaded || !(await read($, todoOpenAtom))) return
                await loadTodos($, STRINGS[(await read($, langAtom)) as Lang])
              })()
            })
          }
        })()
      }
    } catch {
      // No auto-open; /jira-todo still works.
    }
    return next(e)
  })

  // /jira-todo toggles the pane: closes it when open, opens it otherwise.
  on('command.run', { command: 'jira-todo' }, async $ => {
    const str = STRINGS[(await read($, langAtom)) as Lang]
    if (await read($, todoOpenAtom)) {
      await $.ui.close({ id: TODO_PANE })
      await update($, todoOpenAtom, () => false)
      return { text: str.closed }
    }
    try {
      await resolveFolder($)
    } catch {
      // Keep what session.start found.
    }
    await $.ui.open({ id: TODO_PANE, title: 'Jira', focus: true })
    await update($, todoOpenAtom, () => true)
    return { text: (await loadTodos($, str)).text }
  })

  on('ui.close', async ($, e, next) => {
    if (e.id === TODO_PANE) {
      await update($, todoOpenAtom, () => false)
      if (e.origin.kind === 'person' && (await read($, orgAtom))) {
        $.ui.toast(STRINGS[(await read($, langAtom)) as Lang].closedHint)
      }
    }
    return next(e)
  })

  on('ui.focus', { requestId: TODO_PANE }, async ($, e, next) => {
    // Every move updates it, so leaving a ticket for a button clears it.
    await update($, focusedAtom, () => focusedTicket(e.element))
    // No element: the ring went to one of the engine's stops or left the pane.
    await update($, ringAtom, ring => (e.element ? e.element : leftFrom(ring)))
    return next(e)
  })

  // A list taller than the pane's window makes the arrows scroll it a row
  // instead of moving the ring, and the highlight is soon out of view. Walk the
  // ring instead; it keeps the element it lands on in view. Wheel and page keys
  // still scroll.
  on('ui.scroll', { requestId: TODO_PANE }, async ($, e, next) => {
    if (!isArrowScroll(e)) return next(e)
    const folder = await read($, folderAtom)
    const scope = effectiveScope(await read($, scopePrefAtom), folder.project)
    const settings = await read($, settingsAtom)
    const current = (await read($, ticketAtom))?.key ?? null
    const menu = await read($, menuAtom)
    const todos = await read($, todosAtom)
    const order = focusOrder({
      groups: groupTodos(applyScope(todos.items, scope, folder.project)),
      folded: await read($, todoFoldedAtom),
      statusFolded: await read($, statusFoldedAtom),
      settings: settings ? settingsValues(Boolean(folder.project)) : null,
      current,
      menu: menu
        ? {
            key: menu.item.key,
            values: menuValues(menu.other, menu.item.key === current),
            transitions: menu.status ? menu.status.list.map(t => t.id) : null,
            confirm: Boolean(menu.status?.pick),
          }
        : null,
      more: Boolean(todos.next),
      update: isNewer((await read($, latestAtom)).version, await read($, versionAtom)),
    })
    const to = stepFocus(order, await read($, ringAtom), e.by)
    if (!to) return next(e)
    try {
      await focusOn($, to)
    } catch {
      return next(e)
    }
    return {}
  })

  on('ui.render', { component: 'Pane', requestId: TODO_PANE }, async ($, e) => {
    const { Box, Button, Text } = $.ui.resolve(e)
    const todos = await read($, todosAtom)
    const folded = await read($, todoFoldedAtom)
    const statusFolded = await read($, statusFoldedAtom)
    const lang = (await read($, langAtom)) as Lang
    const pref = (await read($, langPrefAtom)) as LangPref
    const str = STRINGS[lang]
    const folder = await read($, folderAtom)
    const scopePref = await read($, scopePrefAtom)
    const scope: Scope = effectiveScope(scopePref, folder.project)
    const menu = await read($, menuAtom)
    const focusedKey = await read($, focusedAtom)
    const autoOpen = await read($, autoOpenAtom)
    const settings = await read($, settingsAtom)
    const range = await read($, rangeAtom)
    const version = await read($, versionAtom)
    const account = await read($, accountAtom)
    const jiraWarn = account.jira ? jiraWarning(account.jira.email, account.claude?.email ?? null) : null
    const latest = await read($, latestAtom)
    const canUpdate = isNewer(latest.version, version)
    const ticket = await read($, ticketAtom)
    const current = ticket?.key
    const cloudId = ticket?.cloudId || SITE

    // A menu item disappears with the menu; hand the ring back to its row,
    // or the arrows have nothing to move from.
    const backToRow = async (key: string) => {
      try {
        await focusOn($, key)
      } catch {
        // The row is gone (list refreshed); the ring stays where the engine left it.
      }
    }
    const pick = async (item: (typeof todos.items)[number]) => {
      await update($, menuAtom, () => null)
      await update($, ticketAtom, () => ({ ...item, cloudId }))
      $.ui.toast(str.current(item.key))
      await tellClaude($, { ...item, cloudId })
    }
    const clearTicket = async () => {
      await update($, menuAtom, () => null)
      await update($, ticketAtom, () => null)
      $.ui.toast(str.cleared)
      await tellClaude($, null)
    }
    const openIssue = async (key: string) => {
      const url = issueUrl(SITE, key)
      if (!(await openUrl($, url))) $.ui.toast(str.openFailed(url))
    }

    return (
      <Box flexDirection="column">
        {/* The session's accounts and folder, as branch8-jira-check's banner,
            plus the Jira user the banner cannot know (MCP is not up yet then). */}
        {account.claude && (
          <Text>
            <Text>{'✅ '}</Text>
            <Text color="claude" bold>{`${str.labelClaude}  `}</Text>
            <Text bold>{account.claude.email}</Text>
            <Text dimColor>
              {account.claude.org ? `（${account.claude.org}${account.claude.plan ? ` · ${account.claude.plan}` : ''}）` : ''}
            </Text>
          </Text>
        )}
        {account.jira ? (
          <Text>
            <Text>{`${jiraWarn ? '⚠️' : '🔗'} `}</Text>
            <Text color="claude" bold>{`${str.labelJira}  `}</Text>
            <Text bold>{account.jira.name}</Text>
            <Text dimColor>{`（${account.jira.email}）`}</Text>
          </Text>
        ) : (
          <Text>
            <Text>{account.isJiraOut ? '⚪ ' : '🔗 '}</Text>
            <Text color="claude" bold>{`${str.labelJira}  `}</Text>
            <Text dimColor>{account.isJiraOut ? str.authOut : str.jiraPending}</Text>
          </Text>
        )}
        {jiraWarn && (
          <Text color="warning">{`   ${jiraWarn === 'domain' ? str.jiraDomain : str.jiraDiffers}`}</Text>
        )}
        {/* Sign-ins branch8-auth-check offers; the rows only point at /auth-check. */}
        {account.github?.state !== 'skip' && (
          <Text>
            <Text>{account.github?.state === 'in' ? '🔗 ' : account.github ? '⚪ ' : '🔗 '}</Text>
            <Text color="claude" bold>{`${str.labelGithub}  `}</Text>
            {account.github?.state === 'in' ? (
              <Text bold>{account.github.user || str.signedIn}</Text>
            ) : (
              <Text dimColor>
                {!account.github ? str.jiraPending : account.github.state === 'missing' ? str.ghMissing : str.authOut}
              </Text>
            )}
          </Text>
        )}
        <Text>
          <Text>{account.devin?.state === 'out' ? '⚪ ' : '🔗 '}</Text>
          <Text color="claude" bold>{`${str.labelDevin}  `}</Text>
          {account.devin?.state === 'in' ? (
            <Text bold>{str.signedIn}</Text>
          ) : (
            <Text dimColor>{account.devin ? str.authOut : str.jiraPending}</Text>
          )}
        </Text>
        <Text>
          <Text>{'📁 '}</Text>
          <Text color="claude" bold>{`${str.labelFolder}  `}</Text>
          <Text bold>{folder.dir || '?'}</Text>
          <Text color={folder.project ? 'success' : undefined} dimColor={!folder.project}>
            {folder.project
              ? ` → Jira ${folder.project}${folder.name ? `（${folder.name}）` : ''}`
              : ` → ${folder.noJira ? str.noJiraFolder : str.unmappedFolder}`}
          </Text>
        </Text>
        <Text dimColor>{folder.project ? str.changeMapping : str.setMapping}</Text>
        <Box flexDirection="column" borderStyle="round" borderDimColor paddingX={1} marginTop={1}>
          <Text dimColor bold>{str.helpTitle + (version ? ` · v${version}` : '')}</Text>
          {str.help.map(line => (
            <Text key={line} dimColor>
              {line}
            </Text>
          ))}
        </Box>
        <Box flexDirection="row" columnGap={2}>
          <Button key="settings" plain dimColor={!settings} label={str.settings} onPress={async () => {
            await update($, settingsAtom, open => (open ? null : 'lang'))
            if (!settings) await focusOn($, 'settings-lang')
          }} />
          {/* Outside the popup: a hotkey works only while its button is drawn. */}
          <Button key="hotkey-o" plain dimColor hotkey="o" label={str.menuOpen} onPress={async () => {
            if (focusedKey) await openIssue(focusedKey)
            else $.ui.toast(str.noFocus)
          }} />
          {canUpdate && latest.version && (
            <Button
              key="update"
              plain
              label={latest.isUpdating ? str.updating : str.updateTo(latest.version)}
              onPress={async () => {
                if (latest.isUpdating || !latest.version) return
                await runUpdate($, str)
              }}
            />
          )}
        </Box>
        {settings && (() => {
          const labels: Record<string, string> = {
            lang: `${str.language}${str.langNames[pref]}`,
            auto: str.autoOpen(autoOpen),
            scope: `${str.scope}${str.scopeNames[scope]}`,
            range: str.rangeLabel(range),
            close: str.close,
            back: str.settingsBack,
          }
          const choose = async (value: string) => {
            if (value === 'lang') {
              const next = nextLangPref(pref)
              await $.store.set('lang', next)
              await applyLang($, next)
            } else if (value === 'auto') {
              await $.store.set('autoOpen', !autoOpen)
              await update($, autoOpenAtom, () => !autoOpen)
            } else if (value === 'scope') {
              const next: Scope = scope === 'folder' ? 'all' : 'folder'
              await $.store.set('scope', next)
              await update($, scopePrefAtom, () => next)
              await loadTodos($, str)
            } else if (value === 'range') {
              const next = nextRange(range)
              await $.store.set('range', next)
              await update($, rangeAtom, () => next)
              await loadTodos($, str)
            } else if (value === 'close') {
              await update($, settingsAtom, () => null)
              await $.ui.close({ id: TODO_PANE })
              // A close from the plugin's own handler may not reach its ui.close hook.
              await update($, todoOpenAtom, () => false)
              if (await read($, orgAtom)) $.ui.toast(str.closedHint)
            } else {
              await update($, settingsAtom, () => null)
              await backToRow('settings')
            }
          }
          // A toggle keeps the popup open and the ring on it, to change several in a row.
          return (
            <Box flexDirection="column" borderStyle="round" borderColor="claude" paddingX={1} marginLeft={2}>
              {settingsValues(Boolean(folder.project)).map(v => (
                <Button key={`settings-${v}`} plain label={labels[v] ?? v} onPress={() => choose(v)} />
              ))}
            </Box>
          )
        })()}
        {current && (
          <Button key="clear-top" plain label={str.clearTicket(current)} onPress={clearTicket} />
        )}
        <Text dimColor>{'─'.repeat(PANE_WIDTH - 4)}</Text>
        <Button
          key="refresh"
          plain
          dimColor
          // The one loading line: first load or refresh.
          label={todos.isLoading ? (todos.items.length ? str.refreshing : str.loading + '…') : str.refresh}
          onPress={async () => {
            if (todos.isLoading) return
            // Sign-ins too: someone who just ran /auth-check sees the rows turn.
            await Promise.all([loadTodos($, str), loadSignIns($, true)])
          }}
        />
        {todos.error && <Text color="error">{todos.error}</Text>}
        {todos.isLoaded && !todos.isLoading && !todos.error && todos.items.length === 0 && (
          <Text dimColor>{str.empty}</Text>
        )}
        {groupTodos(applyScope(todos.items, scope, folder.project)).map(group => {
          const isFolded = folded.includes(group.project)
          const isMine = group.project === folder.project
          return (
            <Box key={group.project} flexDirection="column">
              <Box flexDirection="row">
                <Button
                  key={`p-${group.project}`}
                  plain
                  label={`${isFolded ? '▸' : '▾'} ${group.project}`}
                  onPress={() =>
                    update($, todoFoldedAtom, f =>
                      f.includes(group.project) ? f.filter(x => x !== group.project) : [...f, group.project],
                    )
                  }
                />
                <Text color="claude" bold>{`  ${group.count}`}</Text>
                {folder.project && (
                  <Text color={isMine ? 'success' : 'subtle'}>{`   ${isMine ? str.thisFolderTag : str.otherTag}`}</Text>
                )}
              </Box>
              {!isFolded &&
                group.statuses.map(st => {
                  const fk = `${group.project}/${st.status}`
                  const isStFolded = statusFolded.includes(fk)
                  return (
                    <Box key={fk} flexDirection="column" marginLeft={2}>
                      <Box flexDirection="row">
                        <Button
                          key={`s-${fk}`}
                          plain
                          label={isStFolded ? '▸' : '▾'}
                          onPress={() =>
                            update($, statusFoldedAtom, f => (f.includes(fk) ? f.filter(x => x !== fk) : [...f, fk]))
                          }
                        />
                        <Text color={statusTone(st.status)}>{` ● ${st.status || str.noStatus} (${st.items.length})`}</Text>
                      </Box>
                      {!isStFolded &&
                        st.items.map(item => (
                          <Box key={item.key} flexDirection="column" marginLeft={2}>
                            <Box flexDirection="row">
                              <Button
                                key={item.key}
                                plain
                                {...(item.key === current ? {} : { label: `${typeIcon(item.type)} ${todoRow(item, ROW_WIDTH - 3)}` })}
                                onPress={async () => {
                                  if (menu?.item.key === item.key) return update($, menuAtom, () => null)
                                  const other = isOtherProject(item.key, folder.project)
                                  const dir = other ? await folderForProject($, projectOf(item.key)) : ''
                                  await update($, menuAtom, () => ({ item, other, dir }))
                                  const first = menuValues(other, item.key === current)[0]
                                  await focusOn($, `menu-${item.key}-${first}`)
                                }}
                              >
                                {/* The current ticket stands out: the rest are plain labels. */}
                                {item.key === current && (
                                  <Text bold color="success">{`▶ ${typeIcon(item.type)} ${todoRow(item, ROW_WIDTH - 3)}`}</Text>
                                )}
                              </Button>
                              <Text color="suggestion">{' 🔗'}</Text>
                            </Box>
                            {menu?.item.key === item.key && (
                              <Box
                                flexDirection="column"
                                borderStyle="round"
                                borderColor="claude"
                                paddingX={1}
                                marginLeft={3}
                              >
                                <Text bold color="claude">{item.key}</Text>
                                {menu.other && folder.project && (
                                  <Text color="warning">{str.confirmOther(item.key, folder.project)}</Text>
                                )}
                                {menu.other && <Text dimColor>{str.moveHint(menu.dir)}</Text>}
                                {(() => {
                                  const labels: Record<string, string> = {
                                    move: `→ ${str.moveThere}`,
                                    work: menu.other ? `→ ${str.stayHere}` : str.menuWork,
                                    clear: str.menuClear,
                                    status: str.menuStatus,
                                    open: str.menuOpen,
                                    cancel: str.menuCancel,
                                  }
                                  const choose = async (value: string) => {
                                    if (value === 'status') {
                                      // Opens the status popup under the menu; the menu stays.
                                      await update($, menuAtom, m =>
                                        m ? { ...m, status: { isLoading: true, list: [], pick: null } } : m,
                                      )
                                      await focusOn($, `menu-${item.key}-tback`)
                                      const list = await loadTransitions($, item.key, item.status)
                                      await update($, menuAtom, m =>
                                        m && m.item.key === item.key
                                          ? { ...m, status: { isLoading: false, list: list ?? [], pick: null } }
                                          : m,
                                      )
                                      if (list === null) $.ui.toast(str.queryFailed)
                                      const first = list?.[0]
                                      if (first) await focusOn($, `menu-${item.key}-t-${first.id}`)
                                      return
                                    }
                                    if (value === 'work') await pick(item)
                                    else if (value === 'clear') await clearTicket()
                                    else if (value === 'open') await openIssue(item.key)
                                    else if (value === 'move') $.ui.toast(str.moveHint(menu.dir))
                                    await update($, menuAtom, () => null)
                                    await backToRow(item.key)
                                    // Setting or clearing the ticket adds or drops the unselect
                                    // button above the list after this redraw, and the ring keeps
                                    // its place in the order, a row off: point it again once drawn.
                                    if (value === 'work' || value === 'clear') {
                                      $.clock.after(300, () => void backToRow(item.key))
                                    }
                                  }
                                  return menuValues(menu.other, item.key === current).map(v => (
                                    <Button
                                      key={`menu-${item.key}-${v}`}
                                      plain
                                      dimColor={v === 'cancel'}
                                      label={labels[v] ?? v}
                                      onPress={() => choose(v)}
                                    />
                                  ))
                                })()}
                              </Box>
                            )}
                            {menu?.item.key === item.key && menu.status && (
                              <Box
                                flexDirection="column"
                                borderStyle="round"
                                borderColor="claude"
                                paddingX={1}
                                marginLeft={5}
                              >
                                <Text bold color="claude">{str.statusTitle(item.key)}</Text>
                                <Text dimColor>{str.statusNow(item.status)}</Text>
                                {menu.status.isLoading && <Text dimColor>{str.loadingTransitions}</Text>}
                                {!menu.status.isLoading && menu.status.list.length === 0 && (
                                  <Text dimColor>{str.noTransitions}</Text>
                                )}
                                {menu.status.list.map(t => (
                                  <Button
                                    key={`menu-${item.key}-t-${t.id}`}
                                    plain
                                    label={`→ ${t.to}`}
                                    onPress={async () => {
                                      await update($, menuAtom, m =>
                                        m?.status ? { ...m, status: { ...m.status, pick: t } } : m,
                                      )
                                      await focusOn($, `menu-${item.key}-yes`)
                                    }}
                                  />
                                ))}
                                <Button
                                  key={`menu-${item.key}-tback`}
                                  plain
                                  dimColor
                                  label={str.back}
                                  onPress={async () => {
                                    await update($, menuAtom, m => (m ? { ...m, status: null } : m))
                                    await focusOn($, `menu-${item.key}-status`)
                                  }}
                                />
                              </Box>
                            )}
                            {menu?.item.key === item.key && menu.status?.pick && (() => {
                              const t = menu.status.pick
                              return (
                                <Box
                                  flexDirection="column"
                                  borderStyle="round"
                                  borderColor="warning"
                                  paddingX={1}
                                  marginLeft={7}
                                >
                                  <Text bold>{str.confirmMove(item.key)}</Text>
                                  <Text dimColor>{item.status || '?'}</Text>
                                  <Text color="claude">{`→ ${t.to}`}</Text>
                                  {t.hasScreen && <Text color="warning">{str.needsFields}</Text>}
                                  <Button
                                    key={`menu-${item.key}-yes`}
                                    plain
                                    label={str.confirmYes}
                                    onPress={async () => {
                                      const from = item.status
                                      if (!(await moveTicket($, item.key, t.id))) {
                                        $.ui.toast(str.moveFailed(issueUrl(SITE, item.key)))
                                        await update($, menuAtom, m =>
                                          m?.status ? { ...m, status: { ...m.status, pick: null } } : m,
                                        )
                                        await focusOn($, `menu-${item.key}-t-${t.id}`)
                                        return
                                      }
                                      // A done status leaves the open-tickets list; another moves the row.
                                      await update($, todosAtom, ts => ({
                                        ...ts,
                                        items: t.isDone
                                          ? ts.items.filter(i => i.key !== item.key)
                                          : ts.items.map(i => (i.key === item.key ? { ...i, status: t.to } : i)),
                                      }))
                                      await update($, ticketAtom, cur =>
                                        cur && cur.key === item.key ? { ...cur, status: t.to } : cur,
                                      )
                                      await update($, menuAtom, () => null)
                                      $.ui.toast(str.moved(item.key, t.to))
                                      try {
                                        await $.session.append({
                                          message: { type: 'user', content: [{ type: 'text', text: moveNote(item.key, from, t.to) }] },
                                        })
                                      } catch {
                                        // The list and the band still show the new status.
                                      }
                                      // The row moved to another status group: point the ring at it now,
                                      // and again once drawn (the popups' removal shifts the order).
                                      if (!t.isDone) {
                                        await backToRow(item.key)
                                        $.clock.after(300, () => void backToRow(item.key))
                                      }
                                    }}
                                  />
                                  <Button
                                    key={`menu-${item.key}-no`}
                                    plain
                                    dimColor
                                    label={str.confirmNo}
                                    onPress={async () => {
                                      await update($, menuAtom, m =>
                                        m?.status ? { ...m, status: { ...m.status, pick: null } } : m,
                                      )
                                      await focusOn($, `menu-${item.key}-t-${t.id}`)
                                    }}
                                  />
                                </Box>
                              )
                            })()}
                          </Box>
                        ))}
                    </Box>
                  )
                })}
            </Box>
          )
        })}
        {todos.next && (
          <Button
            key="more"
            plain
            dimColor
            // Stays as it is while loading: the refresh button is the one loading line.
            label={str.loadMore(TODO_LIMIT)}
            onPress={async () => {
              if (todos.isLoading) return
              const had = new Set(todos.items.map(i => i.key))
              await loadTodos($, str, true)
              // The ring would keep the button's place in the order, now on an
              // old row: put it on the first ticket just loaded, once drawn.
              const first = (await read($, todosAtom)).items.find(i => !had.has(i.key))
              if (first) $.clock.after(300, () => void backToRow(first.key))
            }}
          />
        )}
      </Box>
    )
  })

  on('tool.call', { tool: 'mcp__branch8-jira-mod__set_ticket' }, async ($, e) => {
    const input = e as unknown as Record<string, unknown>
    const t: Ticket = {
      key: str(input.key).trim().toUpperCase(),
      summary: str(input.summary),
      status: str(input.status),
      cloudId: str(input.cloudId) || SITE,
    }
    if (!/^[A-Z][A-Z0-9_]*-\d+$/.test(t.key)) {
      return { result: `Not a Jira issue key: "${str(input.key)}".` as never }
    }
    // Another project's ticket in this folder: the person decides first.
    const folder = await read($, folderAtom)
    if (isOtherProject(t.key, folder.project) && input.confirmedOtherProject !== true) {
      const dir = await folderForProject($, projectOf(t.key))
      return {
        result: `Not set: ${t.key} belongs to ${projectOf(t.key)}, but this folder is mapped to Jira ${folder.project}. Ask the user with one question card, in their language: (1) open a new session in that project's folder — recommended — telling them to run \`cd ${dir} && claude\`; (2) work on it here anyway; (3) cancel. Only on (2), call set_ticket again with confirmedOtherProject: true, then continue. On (1) or (3) do not start the work.` as never,
      }
    }
    await update($, ticketAtom, () => t)
    return { result: `Current ticket set to ${t.key}.` as never }
  }).catch(($, e, next) => next(e))

  on('tool.call', { tool: 'mcp__branch8-jira-mod__clear_ticket' }, async $ => {
    const was = (await read($, ticketAtom))?.key
    await update($, ticketAtom, () => null)
    return { result: (was ? `Unselected ${was}; no current ticket.` : 'No current ticket was set.') as never }
  }).catch(($, e, next) => next(e))

  on('tool.call', { tool: 'mcp__branch8-jira-mod__get_ticket' }, async $ => {
    const ticket = await read($, ticketAtom)
    const asked = await read($, askedAtom)
    return { result: JSON.stringify({ ticket, asked }) as never }
  }).catch(($, e, next) => next(e))

  on('tool.call', { tool: 'mcp__branch8-jira-mod__mark_asked' }, async ($, e) => {
    const mark = str((e as unknown as Record<string, unknown>).mark)
    await update($, askedAtom, a => (a.includes(mark) ? a : [...a, mark]))
    return { result: `Recorded ${mark}.` as never }
  }).catch(($, e, next) => next(e))

  // Safety net: remind Claude at the three points, once per ticket and point.
  on('tool.call', async ($, e, next) => {
    const ran = await next(e)
    if (ran.deny !== undefined || ran.isError) return ran
    // A folder record was just written (e.g. Claude recording the board):
    // refresh the pane's folder ↔ project line now, not next session.
    if (touchesFolderRecords(e.tool, e as unknown as Record<string, unknown>)) {
      try {
        await resolveFolder($)
      } catch {
        // Keep the previous answer.
      }
    }
    // Subagents and engine forks cannot ask the user; leave the point for the
    // main loop instead of spending it there.
    if ((e as { agentId?: string }).agentId) return ran
    const node = detectNode(e.tool, e as unknown as Record<string, unknown>)
    if (!node) return ran
    const reminder = reminderFor(node, await read($, ticketAtom), await read($, askedAtom))
    if (!reminder) return ran
    await update($, askedAtom, a => [...a, reminder.mark])
    return { ...ran, context: [...(ran.context ?? []), reminder.text] }
  }).catch(($, e, next) => next(e))

  on('prompt.compose', async ($, e, next) => {
    const out = await next(e)
    const text = rulesSection(await read($, ticketAtom), await read($, askedAtom))
    return { sections: [...out.sections, { id: `${P}:rules`, text, scope: 'session' as const }] }
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const t = await read($, ticketAtom)
    const todos = await read($, todosAtom)
    // The count stands in for the pane while it is closed.
    const count = todos.isLoaded && !(await read($, todoOpenAtom)) ? todos.items.length : null
    const hint = (await read($, orgAtom)) && !(await read($, todoOpenAtom))
    const line = bandText(t, count, undefined, STRINGS[(await read($, langAtom)) as Lang], hint)
    if (!line || e.props.hasSurvey) return next(e)
    const { Text } = $.ui.resolve(e)
    return <Text>{line}</Text>
  })

  // The band's status comes with the ticket (the pane, set_ticket) and follows
  // the pane's loads and moves; Jira is asked only for a status still unknown,
  // once per ticket. No polling.
  on('turn.complete', async ($, e, next) => {
    const out = await next(e)
    // Records can change outside this session, or /cd can move it.
    try {
      await resolveFolder($)
    } catch {
      // Keep the previous answer.
    }
    const t = await read($, ticketAtom)
    if (!t || t.status || (await read($, statusAskedAtom)) === t.key) return out
    await update($, statusAskedAtom, () => t.key)

    let fresh: { summary?: string; status?: string } | null = null
    for (const server of ATLASSIAN) {
      try {
        const res = await $.mcp.call(server, 'getJiraIssue', {
          cloudId: t.cloudId || SITE,
          issueIdOrKey: t.key,
          fields: ISSUE_FIELDS,
        })
        // Installed but signed out answers isError: try the other server.
        if (res.isError) continue
        fresh = parseIssueStatus(res.content as { type: string; text?: string }[])
        if (fresh) break
      } catch {
        // Not connected under this name; try the next one.
      }
    }
    if (fresh) await update($, ticketAtom, cur => (cur && cur.key === t.key ? { ...cur, ...fresh } : cur))
    return out
  })
}
