// Engine wiring for the Branch8 Jira mod. The judgment (which ticket, which
// transition) belongs to the jira-workflow skill; this module only keeps the
// current ticket, reminds Claude at the three points, puts the rules in the
// system prompt and draws the ticket above the prompt. It never writes Jira.
import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Ticket } from '../types'
import type { Lang, LangPref } from './logic'
import {
  STRINGS,
  TODO_JQL,
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

// The company Jira site, used when no ticket has given a cloudId yet.
const SITE = 'https://branch8.atlassian.net'
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
      const pref = await $.store.get('lang')
      await applyLang($, pref === 'zh-TW' || pref === 'zh-CN' || pref === 'en' ? pref : 'auto')
    } catch {
      // Stays on the default (English).
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
    await $.ui.open({ id: TODO_PANE, title: 'Jira', focus: true })
    await update($, todoOpenAtom, () => true)
    // Keep the last list on screen while it refreshes.
    await update($, todosAtom, t => ({ ...t, error: null, isLoading: true }))
    const cloudId = (await read($, ticketAtom))?.cloudId || SITE
    let error = str.noJira
    for (const server of ATLASSIAN) {
      try {
        const res = await $.mcp.call(server, 'searchJiraIssuesUsingJql', {
          cloudId,
          jql: TODO_JQL,
          maxResults: TODO_LIMIT,
        })
        if (res.isError) {
          // Installed but signed out answers isError: try the other server.
          error = str.signedOut
          continue
        }
        const items = parseIssueList(res.content as { type: string; text?: string }[])
        if (items) {
          await update($, todosAtom, () => ({ items, error: null, isLoading: false, isLoaded: true }))
          return { text: str.todoCount(items.length) }
        }
        error = str.queryFailed
      } catch {
        // Not connected under this name; try the next one.
      }
    }
    await update($, todosAtom, t => ({ ...t, error, isLoading: false }))
    return { text: error }
  })

  on('ui.close', async ($, e, next) => {
    if (e.id === TODO_PANE) await update($, todoOpenAtom, () => false)
    return next(e)
  })

  on('ui.render', { component: 'Pane', requestId: TODO_PANE }, async ($, e) => {
    const { Box, Button, Text } = $.ui.resolve(e)
    const todos = await read($, todosAtom)
    const folded = await read($, todoFoldedAtom)
    const lang = (await read($, langAtom)) as Lang
    const pref = (await read($, langPrefAtom)) as LangPref
    const str = STRINGS[lang]
    const ticket = await read($, ticketAtom)
    const current = ticket?.key
    const cloudId = ticket?.cloudId || SITE
    return (
      <Box flexDirection="column">
        {str.help.map(line => (
          <Text key={line} dimColor>
            {line}
          </Text>
        ))}
        <Box flexDirection="row" columnGap={2}>
          <Button key="close" plain dimColor label={str.close} onPress={async () => {
            await $.ui.close({ id: TODO_PANE })
            // A close from the plugin's own handler may not reach its ui.close hook.
            await update($, todoOpenAtom, () => false)
          }} />
          <Button key="lang" plain dimColor label={`${str.language}${str.langNames[pref]}`} onPress={async () => {
            const next = nextLangPref(pref)
            await $.store.set('lang', next)
            await applyLang($, next)
          }} />
        </Box>
        <Text> </Text>
        {todos.isLoading && <Text dimColor>{todos.items.length ? str.refreshing : str.loading + '…'}</Text>}
        {todos.error && <Text color="error">{todos.error}</Text>}
        {todos.isLoaded && !todos.isLoading && !todos.error && todos.items.length === 0 && (
          <Text dimColor>{str.empty}</Text>
        )}
        {groupTodos(todos.items).map(group => {
          const isFolded = folded.includes(group.project)
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
              </Box>
              {!isFolded &&
                group.statuses.map(st => (
                  <Box key={`${group.project}-${st.status}`} flexDirection="column" marginLeft={2}>
                    <Text color={statusTone(st.status)}>{`● ${st.status || str.noStatus}`}</Text>
                    {st.items.map(item => (
                      <Box key={item.key} flexDirection="row" marginLeft={2} columnGap={1}>
                        <Button
                          key={item.key}
                          plain
                          label={(item.key === current ? '▶ ' : '') + todoRow(item, ROW_WIDTH)}
                          onPress={async () => {
                            const now = await $.clock.now()
                            await update($, ticketAtom, () => ({ ...item, cloudId }))
                            // The list was just read from Jira; no need to refresh at once.
                            await update($, refreshedAtom, () => now)
                            $.ui.toast(str.current(item.key))
                          }}
                        />
                        <Button
                          key={`o-${item.key}`}
                          plain
                          dimColor
                          label={str.open}
                          onPress={async () => {
                            const url = issueUrl(SITE, item.key)
                            if (!(await openUrl($, url))) $.ui.toast(str.openFailed(url))
                          }}
                        />
                      </Box>
                    ))}
                  </Box>
                ))}
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
    await update($, ticketAtom, () => t)
    await update($, refreshedAtom, () => 0)
    return { result: `Current ticket set to ${t.key}.` as never }
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
    const line = bandText(t, count, undefined, STRINGS[(await read($, langAtom)) as Lang])
    if (!line || e.props.hasSurvey) return next(e)
    const { Text } = $.ui.resolve(e)
    return <Text>{line}</Text>
  })

  // Pick up status changes made in Jira, at most once a minute.
  on('turn.complete', async ($, e, next) => {
    const out = await next(e)
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
