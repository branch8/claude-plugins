// Engine wiring for the Branch8 Jira mod. The judgment (which ticket, which
// transition) belongs to the jira-workflow skill; this module only keeps the
// current ticket, reminds Claude at the three points, puts the rules in the
// system prompt and draws the ticket above the prompt. It never writes Jira.
import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

import type { Ticket } from '../types'
import {
  TODO_JQL,
  detectNode,
  formatBand,
  parseIssueList,
  parseIssueStatus,
  reminderFor,
  rulesSection,
} from './logic'

const P = 'branch8-jira-mod'
const ticketAtom = atom({ plugin: 'branch8-jira-mod', key: 'ticket' } as const, null)
const askedAtom = atom({ plugin: 'branch8-jira-mod', key: 'asked' } as const, [])
const refreshedAtom = atom({ plugin: 'branch8-jira-mod', key: 'refreshedAt' } as const, 0)
const todosAtom = atom({ plugin: 'branch8-jira-mod', key: 'todos' } as const, {
  items: [],
  error: null,
  isLoading: false,
})

// The company Jira site, used when no ticket has given a cloudId yet.
const SITE = 'https://branch8.atlassian.net'
const TODO_PANE = 'branch8-jira-todo'
const TODO_LIMIT = 20
// The pane is narrow; wide (CJK) titles wrap past this.
const PANE_SUMMARY_MAX = 24

// The Atlassian MCP under either name it is installed as.
const ATLASSIAN = ['plugin:atlassian:atlassian', 'claude.ai Atlassian Rovo']
const REFRESH_MS = 60_000
const UNKNOWN_STATUS = '狀態無法取得'

const str = (v: unknown) => (typeof v === 'string' ? v : '')

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
      description: '列出指派給我、還沒完成的 Jira 單，點一張設為目前的單',
    })
    return next(e)
  })

  on('command.run', { command: 'jira-todo' }, async $ => {
    await $.ui.open({ id: TODO_PANE, title: 'Jira 待辦', focus: true })
    await update($, todosAtom, () => ({ items: [], error: null, isLoading: true }))
    const cloudId = (await read($, ticketAtom))?.cloudId || SITE
    let error = 'Jira 沒有連線（找不到 Atlassian MCP），請先跑 /jira-check'
    for (const server of ATLASSIAN) {
      try {
        const res = await $.mcp.call(server, 'searchJiraIssuesUsingJql', {
          cloudId,
          jql: TODO_JQL,
          maxResults: TODO_LIMIT,
        })
        const items = res.isError ? null : parseIssueList(res.content as { type: string; text?: string }[])
        if (items) {
          await update($, todosAtom, () => ({ items, error: null, isLoading: false }))
          return { text: `Jira 待辦：${items.length} 張。` }
        }
        error = 'Jira 查詢失敗，請稍後再試'
        break
      } catch {
        // Not connected under this name; try the next one.
      }
    }
    await update($, todosAtom, () => ({ items: [], error, isLoading: false }))
    return { text: error }
  })

  on('ui.render', { component: 'Pane', requestId: TODO_PANE }, async ($, e) => {
    const { Box, Button, Text } = $.ui.resolve(e)
    const todos = await read($, todosAtom)
    const current = (await read($, ticketAtom))?.key
    const cloudId = (await read($, ticketAtom))?.cloudId || SITE
    return (
      <Box flexDirection="column">
        {todos.isLoading && <Text dimColor>查詢中…</Text>}
        {todos.error && <Text>{todos.error}</Text>}
        {!todos.isLoading && !todos.error && todos.items.length === 0 && (
          <Text dimColor>沒有指派給你、還沒完成的單。</Text>
        )}
        {todos.items.map(item => (
          <Button
            key={item.key}
            label={(item.key === current ? '▶ ' : '') + formatBand({ ...item, cloudId }, PANE_SUMMARY_MAX)}
            onPress={async () => {
              const now = await $.clock.now()
              await update($, ticketAtom, () => ({ ...item, cloudId }))
              // The list was just read from Jira; no need to refresh at once.
              await update($, refreshedAtom, () => now)
              $.ui.toast(`目前的單：${item.key}`)
            }}
          />
        ))}
      </Box>
    )
  })

  on('tool.call', { tool: 'mcp__branch8-jira-mod__set_ticket' }, async ($, e) => {
    const input = e as unknown as Record<string, unknown>
    const t: Ticket = {
      key: str(input.key).trim().toUpperCase(),
      summary: str(input.summary),
      status: str(input.status),
      cloudId: str(input.cloudId),
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
    if (!t) return next(e)
    const { Text } = $.ui.resolve(e)
    return <Text>{formatBand(t)}</Text>
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
          cloudId: t.cloudId,
          issueIdOrKey: t.key,
        })
        fresh = res.isError ? null : parseIssueStatus(res.content as { type: string; text?: string }[])
        break
      } catch {
        // Not connected under this name; try the next one.
      }
    }
    await update($, ticketAtom, cur =>
      cur && cur.key === t.key ? { ...cur, ...(fresh ?? { status: UNKNOWN_STATUS }) } : cur,
    )
    return out
  })
}
