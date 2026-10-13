# Jira 工作流程 skill 與 mod 擴充 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 新增 skill `jira-workflow`（找單、開單、推薦狀態轉換）到現有 plugin，並新增可選的 mod `branch8-jira-mod`（system prompt 規則、時機點補漏、輸入框上方顯示目前的單）。

**Architecture:** skill 是純 Markdown，隨 `branch8-jira-check` 發布，負責語意判斷。mod 是獨立 plugin（TypeScript function hooks），純邏輯放 `hooks/logic.ts`（可單測），引擎接線放 `hooks/register.tsx`。mod 不直接改 Jira，只提醒、記錄、顯示。

**Tech Stack:** Claude Code mods（v2.1.287+）、`claude-code` / `claude-code/testing` 型別、Atlassian MCP（`plugin:atlassian:atlassian`）、bash（既有 plugin）。

**Spec:** `docs/superpowers/specs/2026-10-13-jira-workflow-skill-mod-design.md`

## Global Constraints

- 現有 `branch8-jira-check` 的 bash hook 行為不變；只新增 skill、更新 context 文字指向 skill，版本 `1.1.4 → 1.2.0`
- SessionStart 注入的 context 仍須通過 `tests/context-size.sh`（7 KB 預算）
- mod 不寫入 Jira；所有狀態轉換由 skill 經使用者卡片確認後執行
- 不碰 QA 之後的階段
- mod 列入 `marketplace.json`，**不**加入 `managed-settings.json`（第一版只給 Glenn 手動安裝）
- mod 的工具名稱：`mcp__branch8-jira-mod__set_ticket`、`…__get_ticket`、`…__mark_asked`
- 時機點代碼：`start`（開始動手）、`pr`（開 PR）、`merge`（合併）
- 測試寫入 Jira 只在 HS 專案，測試單加 `claude-test` 標籤、標題 `[測試]` 開頭，測完移到 `已取消`
- 程式碼註解英文；文件繁體中文；腳本不引入外部依賴

## Review Focus

1. `gh pr create --help`、`git merge --abort`、`git merge-base` 之類**不是**該時機點的指令 → 不得提醒（Task 1 測試）
2. 還沒設定目前的單就開始改檔案 → 提醒一次「先找單」，之後不再重複（Task 1 測試）
3. Jira 查詢失敗或回傳格式異常 → 顯示「狀態無法取得」，不得讓 hook 拋錯（Task 1 `parseIssueStatus` 測試）
4. 換單後 → 新單的時機點重新計算，舊單已問過的紀錄不影響新單（Task 1 測試）
5. 標題過長 → 顯示截斷，不撐爆一行（Task 1 `formatBand` 測試）

---

## File Structure

```
plugins/branch8-jira-mod/                    (new plugin, the mod)
  .claude-plugin/plugin.json                 manifest, types contract
  hooks/hooks.json                           { "modules": ["./register.tsx"] }
  hooks/logic.ts                             pure functions: detectNode, reminderFor, formatBand,
                                             rulesSection, parseIssueStatus
  hooks/logic.test.ts                        unit tests for logic.ts
  hooks/register.tsx                         engine wiring: state, tools, tool.call, prompt.compose,
                                             ui.render, turn.complete
  types/index.d.ts                           PluginState contract + shared types
plugins/branch8-jira-check/
  skills/jira-workflow/SKILL.md              (new) the judgment rules
  hooks/context/tickets.md                   point to the skill
  hooks/context/first-prompt.md              point to the skill
  .claude-plugin/plugin.json                 1.2.0
.claude-plugin/marketplace.json              add branch8-jira-mod entry
CLAUDE.md, README.md                         document the mod and skill
```

---

### Task 1: mod 純邏輯

**Files:**
- Create: `plugins/branch8-jira-mod/hooks/logic.ts`
- Create: `plugins/branch8-jira-mod/types/index.d.ts`
- Test: `plugins/branch8-jira-mod/hooks/logic.test.ts`

**Interfaces:**
- Produces:
  - `type Node = 'start' | 'pr' | 'merge'`
  - `type Ticket = { key: string; summary: string; status: string; cloudId: string }`
  - `detectNode(tool: string, input: Record<string, unknown>): Node | null`
  - `reminderFor(node: Node, ticket: Ticket | null, asked: readonly string[]): { text: string; mark: string } | null`
  - `formatBand(ticket: Ticket): string`
  - `rulesSection(ticket: Ticket | null, asked: readonly string[]): string`
  - `parseIssueStatus(content: readonly { type: string; text?: string }[]): { summary?: string; status?: string } | null`

- [ ] **Step 1: 寫失敗的測試**（`logic.test.ts`）

```ts
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
```

- [ ] **Step 2: 執行，確認失敗** — `claude plugin test plugins/branch8-jira-mod` → 預期：找不到 `./logic`

- [ ] **Step 3: 實作 `logic.ts` 與 `types/index.d.ts`**

```ts
// types/index.d.ts
export type Node = 'start' | 'pr' | 'merge'
export type Ticket = { key: string; summary: string; status: string; cloudId: string }

declare module 'claude-code' {
  interface PluginState {
    'branch8-jira-mod': { ticket: Ticket | null; asked: string[]; refreshedAt: number }
  }
}
```

```ts
// hooks/logic.ts
import type { Node, Ticket } from '../types'

const EDIT_TOOLS = new Set(['Edit', 'Write', 'MultiEdit', 'NotebookEdit'])
const SKIP_FLAGS = /(^|\s)(--help|-h|--dry-run|--abort|--continue|--quit)(\s|$)/

// Strip quoted strings so `echo "gh pr create"` does not count.
function unquoted(cmd: string): string {
  return cmd.replace(/"[^"]*"|'[^']*'/g, ' ')
}

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

export function reminderFor(node: Node, ticket: Ticket | null, asked: readonly string[]) {
  if (!ticket) {
    if (node !== 'start' || asked.includes('none:resolve')) return null
    return {
      mark: 'none:resolve',
      text: 'Branch8 Jira: files are being changed but no Jira ticket is set for this task. Use the jira-workflow skill to resolve the ticket now (card), unless the user already declined one.',
    }
  }
  const mark = `${ticket.key}:${node}`
  if (asked.includes(mark)) return null
  return {
    mark,
    text: `Branch8 Jira: ${NODE_TEXT[node]} for ${ticket.key} (status: ${ticket.status}). Use the jira-workflow skill to decide whether to offer a status transition for the "${node}" point, then call mark_asked.`,
  }
}

export function formatBand(ticket: Ticket): string {
  const max = 50
  const s = ticket.summary.length > max ? ticket.summary.slice(0, max - 1) + '…' : ticket.summary
  return `🎫 ${ticket.key} ${s} · ${ticket.status}`
}

export function rulesSection(ticket: Ticket | null, asked: readonly string[]): string {
  const lines = [
    'Branch8 Jira workflow (branch8-jira-mod): use the jira-workflow skill whenever the user starts a new unit of work, when work on it starts, when a pull request is opened, and when it is merged. Ask with question cards; never move a Jira status without the user confirming.',
    'After resolving a ticket call mcp__branch8-jira-mod__set_ticket; after asking at a point call mcp__branch8-jira-mod__mark_asked.',
  ]
  if (ticket) {
    const mine = asked.filter(a => a.startsWith(`${ticket.key}:`)).map(a => a.split(':')[1])
    lines.push(`Current ticket: ${ticket.key} "${ticket.summary}" (${ticket.status}). Points already asked: ${mine.length ? mine.join(', ') : 'none'}.`)
  } else {
    lines.push('Current ticket: none set yet.')
  }
  return lines.join('\n')
}

export function parseIssueStatus(content: readonly { type: string; text?: string }[]) {
  const text = content.find(c => c.type === 'text' && typeof c.text === 'string')?.text
  if (!text) return null
  try {
    const json = JSON.parse(text)
    const issue = json?.data ?? json
    const status = issue?.fields?.status?.name
    if (typeof status !== 'string') return null
    const summary = issue?.fields?.summary
    return typeof summary === 'string' ? { summary, status } : { status }
  } catch {
    return null
  }
}
```

- [ ] **Step 4: 執行，確認通過** — `claude plugin test plugins/branch8-jira-mod` → 全部 PASS

- [ ] **Step 5: Commit** — `git add plugins/branch8-jira-mod && git commit -m "feat(branch8-jira-mod): pure logic for node detection, reminders and band text"`

---

### Task 2: mod 引擎接線

**Files:**
- Create: `plugins/branch8-jira-mod/.claude-plugin/plugin.json`
- Create: `plugins/branch8-jira-mod/hooks/hooks.json`
- Create: `plugins/branch8-jira-mod/hooks/register.tsx`

**Interfaces:**
- Consumes: Task 1 全部函式與型別
- Produces: 工具 `set_ticket({ key, summary, status, cloudId })`、`get_ticket()`、`mark_asked({ mark })`；system prompt 段落 id `branch8-jira-mod:rules`

- [ ] **Step 1: manifest 與 hooks.json**

```json
{ "name": "branch8-jira-mod", "version": "0.1.0",
  "description": "Branch8 Jira workflow extension: shows the current ticket above the prompt, reminds Claude at start / PR / merge points, keeps the rules in the system prompt. Optional; needs Claude Code v2.1.287+.",
  "author": { "name": "Branch8" }, "types": "./types/index.d.ts" }
```

```json
{ "modules": ["./register.tsx"] }
```

- [ ] **Step 2: `register.tsx`**

```tsx
import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'
import type { Ticket } from '../types'
import { detectNode, reminderFor, formatBand, rulesSection, parseIssueStatus } from './logic'

const P = 'branch8-jira-mod'
const ticketAtom = atom({ plugin: P, key: 'ticket' } as const, null)
const askedAtom = atom({ plugin: P, key: 'asked' } as const, [])
const refreshedAtom = atom({ plugin: P, key: 'refreshedAt' } as const, 0)
const ATLASSIAN = ['plugin:atlassian:atlassian', 'claude.ai Atlassian Rovo']
const tool = (name: string) => `mcp__${P}__${name}`

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.tool.register({
      name: 'set_ticket',
      description: 'Record the Jira ticket the current task belongs to, so it shows above the prompt and the mod can remind you at start / PR / merge points. Call after the jira-workflow skill resolves or creates a ticket.',
      inputSchema: { type: 'object', required: ['key', 'cloudId'], properties: {
        key: { type: 'string' }, summary: { type: 'string' }, status: { type: 'string' }, cloudId: { type: 'string' } } },
      isDeferred: false,
    })
    await $.tool.register({ name: 'get_ticket', description: 'The current Jira ticket and the points already asked.', isDeferred: false })
    await $.tool.register({
      name: 'mark_asked',
      description: 'Record that the user was asked about a status transition at a point, as "<KEY>:<start|pr|merge>", so it is not asked again.',
      inputSchema: { type: 'object', required: ['mark'], properties: { mark: { type: 'string' } } },
      isDeferred: false,
    })
    return next(e)
  })

  on('tool.call', { tool: tool('set_ticket') }, async ($, e) => {
    const t: Ticket = { key: String(e.key), summary: String(e.summary ?? ''), status: String(e.status ?? ''), cloudId: String(e.cloudId) }
    await update($, ticketAtom, () => t)
    await update($, refreshedAtom, () => 0)
    return { result: `Current ticket set to ${t.key}.` }
  })

  on('tool.call', { tool: tool('get_ticket') }, async $ => {
    const t = await read($, ticketAtom)
    const asked = await read($, askedAtom)
    return { result: JSON.stringify({ ticket: t, asked }) }
  })

  on('tool.call', { tool: tool('mark_asked') }, async ($, e) => {
    const mark = String(e.mark)
    await update($, askedAtom, a => (a.includes(mark) ? a : [...a, mark]))
    return { result: `Recorded ${mark}.` }
  })

  // Safety net: remind Claude at the three points, once per ticket and point.
  on('tool.call', async ($, e, next) => {
    const ran = await next(e)
    const node = detectNode(e.tool, e as unknown as Record<string, unknown>)
    if (!node || ran.deny !== undefined || ran.isError) return ran
    const r = reminderFor(node, await read($, ticketAtom), await read($, askedAtom))
    if (!r) return ran
    await update($, askedAtom, a => [...a, r.mark])
    return { ...ran, context: [...(ran.context ?? []), r.text] }
  })

  on('prompt.compose', async ($, e, next) => {
    const out = await next(e)
    const text = rulesSection(await read($, ticketAtom), await read($, askedAtom))
    return { sections: [...out.sections, { id: `${P}:rules`, text, scope: 'session' }] }
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const t = await read($, ticketAtom)
    if (!t) return next(e)
    const { Text } = $.ui.resolve(e)
    return <Text>{formatBand(t)}</Text>
  })

  on('turn.complete', async ($, e, next) => {
    const out = await next(e)
    const t = await read($, ticketAtom)
    const now = await $.clock.now()
    if (!t || now - (await read($, refreshedAtom)) < 60_000) return out
    await update($, refreshedAtom, () => now)
    for (const server of ATLASSIAN) {
      try {
        const res = await $.mcp.call(server, 'getJiraIssue', { cloudId: t.cloudId, issueIdOrKey: t.key, fields: ['summary', 'status'] })
        const s = res.isError ? null : parseIssueStatus(res.content as { type: string; text?: string }[])
        await update($, ticketAtom, cur => (cur && cur.key === t.key ? { ...cur, ...(s ?? { status: '狀態無法取得' }) } : cur))
        return out
      } catch {
        // try the next server name
      }
    }
    await update($, ticketAtom, cur => (cur && cur.key === t.key ? { ...cur, status: '狀態無法取得' } : cur))
    return out
  })
}
```

- [ ] **Step 3: 驗證** — `claude plugin validate plugins/branch8-jira-mod`、型別檢查（types 檔頭的 tsconfig）、`claude plugin test plugins/branch8-jira-mod`，全部通過；依型別錯誤修正 API 細節

- [ ] **Step 4: 真實介面冒煙測試** — `claude --plugin-dir plugins/branch8-jira-mod` 開 tmux session，請 Claude 呼叫 `set_ticket` 設定一張 HS 既有單（唯讀），確認輸入框上方出現 `🎫 HS-…`

- [ ] **Step 5: Commit**

---

### Task 2b: 待辦清單面板 `/jira-todo`（2026-10-13 追加需求）

**Files:**
- Modify: `plugins/branch8-jira-mod/hooks/logic.ts`（新增 `parseIssueList`、`todoJql`）
- Modify: `plugins/branch8-jira-mod/hooks/logic.test.ts`
- Modify: `plugins/branch8-jira-mod/hooks/register.tsx`（指令、面板、按鈕）
- Modify: `plugins/branch8-jira-mod/types/index.d.ts`（`todos` 狀態）

**Interfaces:**
- Produces: `parseIssueList(content): TodoItem[] | null`、`type TodoItem = { key: string; summary: string; status: string }`；指令 `/jira-todo`；面板 id `branch8-jira-todo`
- Consumes: Task 2 的 `ticketAtom`、`ATLASSIAN` 伺服器清單

- [ ] **Step 1: 失敗的測試**：`parseIssueList` 解析 `searchJiraIssuesUsingJql` 輸出（含 `data.issues` 包裝）、空清單、非 JSON 回 `null`
- [ ] **Step 2: 執行確認失敗**
- [ ] **Step 3: 實作 `parseIssueList`；`register.tsx` 加 `session.start` 註冊指令 `jira-todo`、`command.run` 開面板並查 Jira、`ui.render` Pane 畫按鈕清單；按下按鈕 → `update(ticketAtom)` 並 `$.ui.toast`**
- [ ] **Step 4: 測試通過；`claude plugin validate`、型別檢查通過**
- [ ] **Step 5: 真實介面：`/jira-todo` 列出 Glenn 的待辦、點選後輸入框上方換成該單**
- [ ] **Step 6: Commit**

---

### Task 3: skill `jira-workflow` 與既有 plugin 指向 skill

**Files:**
- Create: `plugins/branch8-jira-check/skills/jira-workflow/SKILL.md`
- Modify: `plugins/branch8-jira-check/hooks/context/tickets.md`、`hooks/context/first-prompt.md`
- Modify: `plugins/branch8-jira-check/.claude-plugin/plugin.json`（1.2.0）

- [ ] **Step 1: 寫 SKILL.md**（內容依 spec「元件 1」：觸發描述、找單四步、開新單、推薦轉換五步、mod 工具的可選使用、安靜與語言規則）
- [ ] **Step 2: context 檔改成「使用 jira-workflow skill」，保持短**
- [ ] **Step 3: `bash tests/context-size.sh` 全過；`python3 scripts/validate.py` 0 warning**
- [ ] **Step 4: Commit**

---

### Task 4: 發布設定與文件

**Files:**
- Modify: `.claude-plugin/marketplace.json`（加 `branch8-jira-mod`）
- Modify: `CLAUDE.md`、`README.md`
- 不修改：`managed-settings.json`

- [ ] **Step 1: marketplace entry**；`python3 scripts/validate.py` 通過（若 validate.py 不認 `modules` 格式，修 validate.py 並補測試）
- [ ] **Step 2: 文件**：CLAUDE.md 檔案地圖加 mod 與 skill、發布狀態（未進 managed-settings 的理由）；README 加安裝指令 `/plugin install branch8-jira-mod@branch8`
- [ ] **Step 3: Commit**

---

### Task 5: 端對端測試（HS）

在暫存 git repo（記錄對應 HS）以 tmux 跑真實 session；jira-check 以暫換快取方式載入新版、mod 以 `--plugin-dir` 載入。

- [ ] 情境 1：第一句就是任務 → 動手前出現找單卡片
- [ ] 情境 2：branch 名含 HS 單號 → 不問，直接採用並顯示
- [ ] 情境 3：開新單 → 卡片先列標題；建立 `[測試]` 單（`claude-test` 標籤）
- [ ] 情境 4：開始改檔 → 出現移到「進行中」卡片；確認後狀態移動、顯示更新
- [ ] 情境 5：`gh pr create`（暫存 repo 用假 remote，只測偵測與提醒）→ 出現移狀態卡片
- [ ] 情境 6：拒絕後不再問
- [ ] 清理：測試單移到 `已取消`；還原快取；回報暫存的資料夾對應紀錄
- [ ] 推 branch、開 PR（不合併，等 Glenn 審）
