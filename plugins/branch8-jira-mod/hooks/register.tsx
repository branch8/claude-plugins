// Engine wiring for the Branch8 Jira mod. The judgment (which ticket, which
// transition) belongs to the jira-workflow skill; this module only keeps the
// current ticket, reminds Claude at the three points, puts the rules in the
// system prompt and draws the ticket above the prompt. It never writes Jira.
import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Ticket } from '../types'
import type { FolderRecord, Lang, LangPref, Scope } from './logic'
import {
  STRINGS,
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
  TODO_JQL,
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
const refreshedAtom = atom({ plugin: 'branch8-jira-mod', key: 'refreshedAt' } as const, 0)
const todosAtom = atom({ plugin: 'branch8-jira-mod', key: 'todos' } as const, {
  items: [],
  error: null,
  isLoading: false,
  isLoaded: false,
})
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
// The settings popup under the toolbar's ⚙ button: null when closed, else
// the option last picked, where the cursor rests when it is drawn again.
const settingsAtom = atom({ plugin: 'branch8-jira-mod', key: 'settings' } as const, null)
// The ticket row the pane's focus ring is on, for the "o" hotkey.
const focusedAtom = atom({ plugin: 'branch8-jira-mod', key: 'focusedKey' } as const, null)

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
const REFRESH_MS = 60_000

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
    rec?.kind === 'project' ? { dir: name, project: rec.key, name: rec.name } : { dir: name, project: null, name: '' },
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
async function loadTodos($: EngineInterface, str: (typeof STRINGS)[Lang]): Promise<{ ok: boolean; text: string }> {
  await update($, todosAtom, t => ({ ...t, error: null, isLoading: true }))
  const cloudId = (await read($, ticketAtom))?.cloudId || SITE
  let error = str.noJira
  for (const server of ATLASSIAN) {
    try {
      const res = await $.mcp.call(server, 'searchJiraIssuesUsingJql', {
        cloudId,
        jql: TODO_JQL,
        maxResults: TODO_LIMIT,
        fields: TODO_FIELDS,
      })
      if (res.isError) {
        // Installed but signed out answers isError: try the other server.
        error = str.signedOut
        continue
      }
      const items = parseIssueList(res.content as { type: string; text?: string }[])
      if (items) {
        await update($, todosAtom, () => ({ items, error: null, isLoading: false, isLoaded: true }))
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
  const home = await homeDir($)
  const dirs = [(await $.env.get('CLAUDE_CONFIG_DIR')) || home, home]
  for (const dir of dirs) {
    const file = `${dir}/.claude.json`
    if (!(await $.fs.exists(file))) continue
    const orgId = (await $.env.get('BRANCH8_ORG_ID')) || DEFAULT_ORG_ID
    return isOrgAccount(await $.fs.read(file), orgId, overrides.some(Boolean))
  }
  return false
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.tool.register({
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
    })
    await $.tool.register({
      name: 'get_ticket',
      description: 'The current Jira ticket of this session and the workflow points already asked about.',
      isDeferred: false,
    })
    await $.tool.register({
      name: 'clear_ticket',
      description:
        'Unselect the current Jira ticket, so this session is tied to none (the user asked to stop tracking a ticket, or the work is not ticket work).',
      isDeferred: false,
    })
    await $.tool.register({
      name: 'mark_asked',
      description:
        'Record that the user was asked about a status transition at a point, as "<KEY>:<start|pr|merge>", so it is not asked again.',
      inputSchema: { type: 'object', required: ['mark'], properties: { mark: { type: 'string' } } },
      isDeferred: false,
    })
    await $.command.register({
      name: 'jira-todo',
      description: 'Jira 待辦 / open tickets: pick one as the current ticket',
    })
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
        const first = await loadTodos($, str)
        if (!first.ok) {
          for (const ms of AUTO_RETRY_MS) {
            $.clock.after(ms, () => {
              void (async () => {
                const todos = await read($, todosAtom)
                if (todos.isLoaded || !(await read($, todoOpenAtom))) return
                await loadTodos($, STRINGS[(await read($, langAtom)) as Lang])
              })()
            })
          }
        }
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
    return next(e)
  })

  on('ui.render', { component: 'Pane', requestId: TODO_PANE }, async ($, e) => {
    const ui = $.ui.resolve(e)
    const { Box, Button, Text } = ui
    // Select is every surface's picker but mobile's; there, menu items are buttons.
    const Select = 'Select' in ui ? ui.Select : null
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
    const ticket = await read($, ticketAtom)
    const current = ticket?.key
    const cloudId = ticket?.cloudId || SITE

    // A menu item disappears with the menu; hand the ring back to its row,
    // or the arrows have nothing to move from.
    const backToRow = async (key: string) => {
      try {
        await $.ui.focus({ requestId: TODO_PANE, key })
      } catch {
        // The row is gone (list refreshed); the ring stays where the engine left it.
      }
    }
    const pick = async (item: (typeof todos.items)[number]) => {
      const now = await $.clock.now()
      await update($, menuAtom, () => null)
      await update($, ticketAtom, () => ({ ...item, cloudId }))
      // The list was just read from Jira; no need to refresh at once.
      await update($, refreshedAtom, () => now)
      $.ui.toast(str.current(item.key))
    }
    const clearTicket = async () => {
      await update($, menuAtom, () => null)
      await update($, ticketAtom, () => null)
      $.ui.toast(str.cleared)
    }
    const openIssue = async (key: string) => {
      const url = issueUrl(SITE, key)
      if (!(await openUrl($, url))) $.ui.toast(str.openFailed(url))
    }

    return (
      <Box flexDirection="column">
        {folder.project ? (
          <Text bold>{str.folderLine(folder.dir, folder.project, folder.name)}</Text>
        ) : (
          <Text bold>{str.folderUnmapped(folder.dir || '?')}</Text>
        )}
        <Text dimColor>{folder.project ? str.changeMapping : str.setMapping}</Text>
        <Box flexDirection="column" borderStyle="round" borderDimColor paddingX={1} marginTop={1}>
          <Text dimColor bold>{str.helpTitle}</Text>
          {str.help.map(line => (
            <Text key={line} dimColor>
              {line}
            </Text>
          ))}
        </Box>
        <Box flexDirection="row" columnGap={2}>
          <Button key="settings" plain dimColor={!settings} label={str.settings} onPress={async () => {
            await update($, settingsAtom, open => (open ? null : 'lang'))
            if (!settings) {
              await $.ui.focus({ requestId: TODO_PANE, key: `settings-menu-${pref}-${autoOpen}-${scope}` })
            }
          }} />
          {/* Outside the popup: a hotkey works only while its button is drawn. */}
          <Button key="hotkey-o" plain dimColor hotkey="o" label={str.menuOpen} onPress={async () => {
            if (focusedKey) await openIssue(focusedKey)
            else $.ui.toast(str.noFocus)
          }} />
        </Box>
        {settings && (() => {
          const options = [
            { value: 'lang', label: `${str.language}${str.langNames[pref]}` },
            { value: 'auto', label: str.autoOpen(autoOpen) },
            ...(folder.project ? [{ value: 'scope', label: `${str.scope}${str.scopeNames[scope]}` }] : []),
            { value: 'close', label: str.close },
            { value: 'back', label: str.settingsBack },
          ]
          // A pick folds a Select to one line; a new key per state draws it open again.
          const menuKey = `settings-menu-${pref}-${autoOpen}-${scope}`
          const choose = (value: string) => {
            void (async () => {
              if (value !== 'close' && value !== 'back') await update($, settingsAtom, () => value)
              if (value === 'lang') {
                const next = nextLangPref(pref)
                await $.store.set('lang', next)
                await applyLang($, next)
                $.clock.after(300, () => void backToRow(`settings-menu-${next}-${autoOpen}-${scope}`))
              } else if (value === 'auto') {
                await $.store.set('autoOpen', !autoOpen)
                await update($, autoOpenAtom, () => !autoOpen)
                $.clock.after(300, () => void backToRow(`settings-menu-${pref}-${!autoOpen}-${scope}`))
              } else if (value === 'scope') {
                const next: Scope = scope === 'folder' ? 'all' : 'folder'
                await $.store.set('scope', next)
                await update($, scopePrefAtom, () => next)
                $.clock.after(300, () => void backToRow(`settings-menu-${pref}-${autoOpen}-${next}`))
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
            })()
          }
          // Toggles keep the popup open so several can be changed in a row.
          return (
            <Box flexDirection="column" borderStyle="round" borderColor="claude" paddingX={1} marginLeft={2}>
              {Select ? (
                <Select key={menuKey} autoFocus value={settings} options={options} onSelect={choose} />
              ) : (
                options.map(o => (
                  <Button key={`settings-${o.value}`} plain label={o.label} onPress={() => choose(o.value)} />
                ))
              )}
            </Box>
          )
        })()}
        {current && (
          <Button key="clear-top" plain label={str.clearTicket(current)} onPress={clearTicket} />
        )}
        <Text dimColor>{'─'.repeat(PANE_WIDTH - 4)}</Text>
        {todos.isLoading && <Text dimColor>{todos.items.length ? str.refreshing : str.loading + '…'}</Text>}
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
                                label={(item.key === current ? '▶ ' : '') + `${typeIcon(item.type)} ${todoRow(item, ROW_WIDTH - 3)}`}
                                onPress={async () => {
                                  if (menu?.item.key === item.key) return update($, menuAtom, () => null)
                                  const other = isOtherProject(item.key, folder.project)
                                  const dir = other ? await folderForProject($, projectOf(item.key)) : ''
                                  await update($, menuAtom, () => ({ item, other, dir }))
                                  await $.ui.focus({ requestId: TODO_PANE, key: `menu-${item.key}` })
                                }}
                              />
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
                                  const options = [
                                    ...(menu.other ? [{ value: 'move', label: `→ ${str.moveThere}` }] : []),
                                    item.key === current
                                      ? { value: 'clear', label: str.menuClear }
                                      : { value: 'work', label: menu.other ? `→ ${str.stayHere}` : str.menuWork },
                                    { value: 'open', label: str.menuOpen },
                                    { value: 'cancel', label: str.menuCancel },
                                  ]
                                  const choose = (value: string) => {
                                    void (async () => {
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
                                    })()
                                  }
                                  return Select ? (
                                    <Select key={`menu-${item.key}`} autoFocus value={options[0]!.value} options={options} onSelect={choose} />
                                  ) : (
                                    options.map(o => (
                                      <Button key={`menu-${item.key}-${o.value}`} plain label={o.label} onPress={() => choose(o.value)} />
                                    ))
                                  )
                                })()}
                              </Box>
                            )}
                          </Box>
                        ))}
                    </Box>
                  )
                })}
            </Box>
          )
        })}
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
    await update($, refreshedAtom, () => 0)
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

  // Pick up status changes made in Jira, at most once a minute.
  on('turn.complete', async ($, e, next) => {
    const out = await next(e)
    // Records can change outside this session, or /cd can move it.
    try {
      await resolveFolder($)
    } catch {
      // Keep the previous answer.
    }
    const t = await read($, ticketAtom)
    if (!t) return out
    const now = await $.clock.now()
    if (now - (await read($, refreshedAtom)) < REFRESH_MS) return out
    await update($, refreshedAtom, () => now)

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
    const lang = (await read($, langAtom)) as Lang
    await update($, ticketAtom, cur =>
      cur && cur.key === t.key ? { ...cur, ...(fresh ?? { status: STRINGS[lang].statusUnknown }) } : cur,
    )
    return out
  })
}
