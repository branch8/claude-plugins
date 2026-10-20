import { test, expect } from 'claude-code/testing'
import { detectNode, reminderFor, formatBand, rulesSection, parseIssueStatus, parseIssueList, todoJql, nextRange, parseIssuePage, TODO_FIELDS, ISSUE_FIELDS, displayWidth, bandText, TODO_HELP, groupTodos, issueUrl, todoRow, langOf, STRINGS, statusTone, nextLangPref, resolveLang, recordFileName, ancestorDirs, parseRecord, projectOf, isOtherProject, applyScope, effectiveScope, foldersFor, suggestedFolder, typeIcon, focusedTicket, isOrgAccount, touchesFolderRecords, focusOrder, stepFocus, isArrowScroll, settingsValues, menuValues, leftFrom, pickNote, manifestVersion, isNewer } from './logic'

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

test('band takes a narrower width for the pane', () => {
  const s = formatBand({ ...T, summary: '一二三四五六七八九十'.repeat(5) }, 40)
  expect(displayWidth(s) <= 40).toBe(true)
  expect(s.startsWith('🎫 HS-1 一二三')).toBe(true)
  expect(s.endsWith('… · 待辦事項')).toBe(true)
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

test('parse searchJiraIssuesUsingJql output into todo items', () => {
  const issues = [
    { key: 'HS-128', fields: { summary: '請假 Email', status: { name: '待辦事項' } } },
    { key: 'HS-124', fields: { summary: '額度', status: { name: 'Dev done' } } },
  ]
  const wrapped = [{ type: 'text', text: JSON.stringify({ data: { issues } }) }]
  expect(parseIssueList(wrapped)).toEqual([
    { key: 'HS-128', summary: '請假 Email', status: '待辦事項' },
    { key: 'HS-124', summary: '額度', status: 'Dev done' },
  ])
  const bare = [{ type: 'text', text: JSON.stringify({ issues: [issues[0]] }) }]
  expect(parseIssueList(bare)?.length).toBe(1)
  expect(parseIssueList([{ type: 'text', text: JSON.stringify({ data: { issues: [] } }) }])).toEqual([])
  expect(parseIssueList([{ type: 'text', text: 'oops' }])).toBeNull()
  // An issue without a key is skipped rather than drawn as a blank row.
  expect(parseIssueList([{ type: 'text', text: JSON.stringify({ issues: [{ fields: {} }] }) }])).toEqual([])
})

test('todo JQL lists my unresolved issues, newest first', () => {
  expect(todoJql({ days: 0, project: null })).toBe('assignee = currentUser() AND statusCategory != Done ORDER BY updated DESC')
})

// --- Final review fixes ---

test('syncing or auto-merge is not the merge point', () => {
  expect(detectNode('Bash', { command: 'git merge origin/main' })).toBeNull()
  expect(detectNode('Bash', { command: 'git merge' })).toBeNull()
  expect(detectNode('Bash', { command: 'git merge feature/x' })).toBeNull()
  expect(detectNode('Bash', { command: 'gh pr merge 12 --auto --squash' })).toBeNull()
  expect(detectNode('Bash', { command: 'gh pr merge 12 --squash' })).toBe('merge')
})

test('heredoc bodies are not commands', () => {
  const commit = "git commit -F - <<'EOF'\nFix \"quote\ngit merge later\ngh pr create soon\nEOF"
  expect(detectNode('Bash', { command: commit })).toBeNull()
})

test('band truncates by display width, CJK counts double', () => {
  const t = { ...T, summary: '請'.repeat(47), status: 'Dev done, QA to do' }
  const b = formatBand(t)
  expect(displayWidth(b) <= 80).toBe(true)
  expect(b.includes('…')).toBe(true)
})

test('band never splits an emoji', () => {
  const b = formatBand({ ...T, summary: '😀'.repeat(60) })
  expect(b.includes('\uFFFD')).toBe(false)
  expect(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])/.test(b)).toBe(false)
})

test('rules section carries no status or summary (keeps the prompt cache stable)', () => {
  const s = rulesSection(T, [])
  expect(s.includes('待辦事項')).toBe(false)
  expect(s.includes('修正請假審核通知')).toBe(false)
  expect(s.includes('HS-1')).toBe(true)
})

// --- Pane closed acts as collapsed: the band carries the todo count ---

test('band adds the todo count after the ticket', () => {
  expect(bandText(T, 17)).toBe('🎫 HS-1 修正請假審核通知 · 待辦事項 · 待辦 17')
})

test('band without a ticket still shows the todo count', () => {
  expect(bandText(null, 17)).toBe('📋 Jira 待辦 17 張 · /jira-todo')
})

test('band hides when there is neither a ticket nor a known count', () => {
  expect(bandText(null, null)).toBeNull()
  expect(bandText(T, null)).toBe(formatBand(T))
})

test('band with count still fits the width', () => {
  const b = bandText({ ...T, summary: '請'.repeat(60) }, 17)
  expect(b !== null && displayWidth(b) <= 78).toBe(true)
  expect(b?.endsWith(' · 待辦 17')).toBe(true)
})

test('pane key help fits the pane width', () => {
  expect(TODO_HELP.length).toBe(2)
  for (const line of TODO_HELP) expect(displayWidth(line) <= 46).toBe(true)
  expect(TODO_HELP.join(' ').includes('Ctrl+X Tab')).toBe(true)
})

// --- Tree by project, then status; links to Jira ---

const ITEMS = [
  { key: 'HS-126', summary: '請假日期少一天', status: '進行中' },
  { key: 'HTGO2-3319', summary: '驗收文件備齊', status: '[HOTFIX] WIP' },
  { key: 'HS-8', summary: 'Multi level approval', status: 'Pending for discussion' },
  { key: 'HS-130', summary: '[測試] README', status: '進行中' },
]

test('todos group by project, then status, in first-seen order', () => {
  expect(groupTodos(ITEMS)).toEqual([
    {
      project: 'HS',
      count: 3,
      statuses: [
        { status: '進行中', items: [ITEMS[0], ITEMS[3]] },
        { status: 'Pending for discussion', items: [ITEMS[2]] },
      ],
    },
    { project: 'HTGO2', count: 1, statuses: [{ status: '[HOTFIX] WIP', items: [ITEMS[1]] }] },
  ])
  expect(groupTodos([])).toEqual([])
})

test('issue link points at the browse page', () => {
  expect(issueUrl('https://branch8.atlassian.net', 'HS-126')).toBe('https://branch8.atlassian.net/browse/HS-126')
  expect(issueUrl('https://branch8.atlassian.net/', 'HS-126')).toBe('https://branch8.atlassian.net/browse/HS-126')
})

test('tree row shows key and summary within the width, no status', () => {
  const row = todoRow({ key: 'HS-126', summary: '請假日期員工端顯示少一天（off-by-one）', status: '進行中' }, 30)
  expect(row.startsWith('HS-126 請假')).toBe(true)
  expect(displayWidth(row) <= 30).toBe(true)
  expect(row.includes('進行中')).toBe(false)
})

// --- Language follows Claude Code's setting; status colours ---

test('language setting maps to zh-TW, zh-CN or en', () => {
  expect(langOf('台灣繁體中文')).toBe('zh-TW')
  expect(langOf('Chinese (Traditional)')).toBe('zh-TW')
  expect(langOf('简体中文')).toBe('zh-CN')
  expect(langOf('English')).toBe('en')
  expect(langOf('日本語')).toBe('en')
  expect(langOf(undefined, 'zh_TW.UTF-8')).toBe('zh-TW')
  expect(langOf(undefined, undefined)).toBe('en')
})

test('every language has every string, and the help fits the pane', () => {
  const keys = Object.keys(STRINGS['zh-TW']).sort()
  for (const lang of ['zh-TW', 'zh-CN', 'en'] as const) {
    expect(Object.keys(STRINGS[lang]).sort()).toEqual(keys)
    for (const line of STRINGS[lang].help) expect(displayWidth(line) <= 46).toBe(true)
  }
})

test('band speaks the user language', () => {
  expect(bandText(null, 17, 78, STRINGS.en)).toBe('📋 Jira: 17 open · /jira-todo')
  expect(bandText(T, 3, 78, STRINGS.en)?.endsWith(' · 3 open')).toBe(true)
  expect(formatBand({ ...T, status: '' }, 78, STRINGS.en)).toBe('🎫 HS-1 修正請假審核通知 · loading')
})

test('status colours by meaning, not by Jira category', () => {
  expect(statusTone('Dev done, QA to to')).toBe('warning')
  expect(statusTone('進行中')).toBe('warning')
  expect(statusTone('[HOTFIX] WIP')).toBe('warning')
  expect(statusTone('[HOTFIX] QA DONE')).toBe('success')
  expect(statusTone('Deployed')).toBe('success')
  expect(statusTone('已取消')).toBe('inactive')
  expect(statusTone('*Discard*')).toBe('inactive')
  expect(statusTone('[STAG] Need to fix (release-fix)')).toBe('error')
  expect(statusTone('Pending for discussion')).toBe('error')
  expect(statusTone('待辦事項')).toBe('suggestion')
  expect(statusTone('Backlog')).toBe('suggestion')
  expect(statusTone('PHASE2')).toBe('subtle')
})

test('language button cycles 繁中 → 简中 → English → auto', () => {
  expect(nextLangPref('zh-TW')).toBe('zh-CN')
  expect(nextLangPref('zh-CN')).toBe('en')
  expect(nextLangPref('en')).toBe('auto')
  expect(nextLangPref('auto')).toBe('zh-TW')
})

test('a chosen language wins; auto follows Claude Code, then the locale', () => {
  expect(resolveLang('en', '台灣繁體中文', undefined)).toBe('en')
  expect(resolveLang('auto', '台灣繁體中文', undefined)).toBe('zh-TW')
  expect(resolveLang('auto', undefined, 'zh_CN.UTF-8')).toBe('zh-CN')
  expect(resolveLang('bogus', undefined, undefined)).toBe('en')
})

// --- Folder ↔ Jira project (same records as branch8-jira-check) ---

test('record file name matches branch8-jira-check', () => {
  expect(recordFileName('/home/glenn/Development/Branch8/Projects/HR-system')).toBe('home_glenn_Development_Branch8_Projects_HR-system.json')
  expect(recordFileName('C:\\Users\\a b\\HS')).toBe('C__Users_a_b_HS.json')
  expect(recordFileName('/')).toBe('root.json')
})

test('ancestors walk up to the root', () => {
  expect(ancestorDirs('/home/glenn/x')).toEqual(['/home/glenn/x', '/home/glenn', '/home', '/'])
  expect(ancestorDirs('C:\\Users\\a')).toEqual(['C:\\Users\\a', 'C:\\Users', 'C:\\'])
})

test('records: a project, no Jira, personal, or unreadable', () => {
  expect(parseRecord('{"projectKey":"HS","projectName":"HR System"}')).toEqual({ kind: 'project', key: 'HS', name: 'HR System' })
  expect(parseRecord('{"projectDir":"x","jira":"none"}')).toEqual({ kind: 'none' })
  expect(parseRecord('{"folder":"x","company":false}')).toEqual({ kind: 'none' })
  expect(parseRecord('nope')).toBeNull()
})

test('other-project check and scope filter', () => {
  expect(projectOf('HTGO2-3319')).toBe('HTGO2')
  expect(isOtherProject('HTGO2-1', 'HS')).toBe(true)
  expect(isOtherProject('HS-1', 'HS')).toBe(false)
  expect(isOtherProject('HS-1', null)).toBe(false)
  const items = [{ key: 'HS-1', summary: '', status: '' }, { key: 'HTGO2-1', summary: '', status: '' }]
  expect(applyScope(items, 'folder', 'HS').map(i => i.key)).toEqual(['HS-1'])
  expect(applyScope(items, 'all', 'HS').length).toBe(2)
  expect(applyScope(items, 'folder', null).length).toBe(2)
})

test('scope defaults to this folder when it is mapped', () => {
  expect(effectiveScope('auto', 'HS')).toBe('folder')
  expect(effectiveScope('auto', null)).toBe('all')
  expect(effectiveScope('all', 'HS')).toBe('all')
  expect(effectiveScope('folder', null)).toBe('all')
})

test('new strings exist in every language and fit the pane', () => {
  for (const lang of ['zh-TW', 'zh-CN', 'en'] as const) {
    const s = STRINGS[lang]
    expect(displayWidth(s.folderLine('claude-plugins', 'HS', 'HR System')) > 0).toBe(true)
    expect(s.folderLine('a', 'HS', 'HR').includes('↔')).toBe(true)
    expect(displayWidth(s.thisFolderTag) <= 24).toBe(true)
    expect(displayWidth(s.otherTag) <= 26).toBe(true)
    expect(s.confirmOther('HTGO2-1', 'HS').includes('HTGO2-1')).toBe(true)
  }
})

test('folders recorded for a project, for the move suggestion', () => {
  const recs = [
    { dir: '/w/hs', text: '{"projectDir":"/w/hs","projectKey":"HS"}' },
    { dir: '/w/htgo', text: '{"projectDir":"/w/htgo","projectKey":"HTGO2"}' },
    { dir: '/w/x', text: '{"projectDir":"/w/x","jira":"none"}' },
    { dir: '/w/bad', text: 'oops' },
  ]
  expect(foldersFor(recs, 'HTGO2')).toEqual(['/w/htgo'])
  expect(foldersFor(recs, 'ZZ')).toEqual([])
  expect(suggestedFolder('/home/g/Branch8', 'ZZ')).toBe('/home/g/Branch8/ZZ')
  for (const lang of ['zh-TW', 'zh-CN', 'en'] as const) {
    expect(STRINGS[lang].moveHint('/w/htgo').includes('cd /w/htgo && claude')).toBe(true)
  }
})

// --- Issue type icons, row menu ---

test('issue type icons', () => {
  expect(typeIcon('錯誤')).toBe('🐞')
  expect(typeIcon('Bug')).toBe('🐞')
  expect(typeIcon('漏洞')).toBe('🐞')
  expect(typeIcon('故事')).toBe('✨')
  expect(typeIcon('功能')).toBe('✨')
  expect(typeIcon('Story')).toBe('✨')
  expect(typeIcon('任務')).toBe('✅')
  expect(typeIcon('Task')).toBe('✅')
  expect(typeIcon('大型工作')).toBe('⚡')
  expect(typeIcon('Epic')).toBe('⚡')
  expect(typeIcon('Sub-task')).toBe('🔹')
  expect(typeIcon('Subtask')).toBe('🔹')
  expect(typeIcon('HOTFIX')).toBe('🔥')
  expect(typeIcon('Inquire')).toBe('❓')
  expect(typeIcon('Idea')).toBe('📄')
  expect(typeIcon(undefined)).toBe('📄')
})

test('todo items carry the issue type', () => {
  const issues = [{ key: 'HS-1', fields: { summary: 'S', status: { name: '進行中' }, issuetype: { name: '錯誤' } } }]
  expect(parseIssueList([{ type: 'text', text: JSON.stringify({ issues }) }])).toEqual([
    { key: 'HS-1', summary: 'S', status: '進行中', type: '錯誤' },
  ])
})

test('menu and hotkey strings exist in every language', () => {
  for (const lang of ['zh-TW', 'zh-CN', 'en'] as const) {
    const s = STRINGS[lang]
    expect(s.menuWork.length > 0 && s.menuOpen.includes('🔗') && s.menuCancel.length > 0).toBe(true)
    expect(s.help.join(' ').includes(' o ')).toBe(true)
    for (const line of s.help) expect(displayWidth(line) <= 46).toBe(true)
  }
})

test('clear-ticket strings exist in every language', () => {
  for (const lang of ['zh-TW', 'zh-CN', 'en'] as const) {
    const s = STRINGS[lang]
    expect(s.clearTicket('HS-1').includes('HS-1')).toBe(true)
    expect(s.menuClear.includes('⏹')).toBe(true)
    expect(s.cleared.length > 0).toBe(true)
    expect(s.noFocus.includes('o')).toBe(true)
  }
})

test('the o hotkey only targets a ticket the cursor is on now', () => {
  expect(focusedTicket('HS-126')).toBe('HS-126')
  expect(focusedTicket('hotkey-o')).toBeNull()
  expect(focusedTicket('w-HS-126')).toBeNull()
  expect(focusedTicket('lang')).toBeNull()
  expect(focusedTicket(undefined)).toBeNull()
})

// --- Auto-open on the Branch8 organisation account ---

const ORG = 'a4a2aa1a-21cd-467f-af54-8253e2ed15d8'

test('organisation account is read from .claude.json', () => {
  const org = JSON.stringify({ oauthAccount: { emailAddress: 'a@branch8.com', organizationUuid: ORG } })
  const personal = JSON.stringify({ oauthAccount: { emailAddress: 'a@gmail.com', organizationUuid: 'x' } })
  expect(isOrgAccount(org, ORG, false)).toBe(true)
  expect(isOrgAccount(personal, ORG, false)).toBe(false)
  expect(isOrgAccount('{}', ORG, false)).toBe(false)
  expect(isOrgAccount('not json', ORG, false)).toBe(false)
  // An API key, token or cloud provider overrides the claude.ai login.
  expect(isOrgAccount(org, ORG, true)).toBe(false)
})

test('auto-open strings exist in every language', () => {
  for (const lang of ['zh-TW', 'zh-CN', 'en'] as const) {
    const s = STRINGS[lang]
    expect(s.autoOpen(true).length > 0 && s.autoOpen(false).length > 0).toBe(true)
    expect(s.autoOpen(true) !== s.autoOpen(false)).toBe(true)
  }
})

// --- Hints to open the pane: org account with the pane closed ---

test('band hints at /jira-todo on the org account when the pane is closed', () => {
  const s = STRINGS['zh-TW']
  expect(bandText(null, null, 78, s, true)).toBe('📋 輸入 /jira-todo 開啟 Jira 待辦')
  expect(bandText(null, 16, 78, s, true)).toBe('📋 Jira 待辦 16 張 · /jira-todo')
  const withTicket = bandText(T, 16, 78, s, true)
  expect(withTicket?.endsWith(' · 待辦 16 · /jira-todo')).toBe(true)
  expect(withTicket !== null && displayWidth(withTicket) <= 78).toBe(true)
  // No hint off the org account: unchanged behaviour.
  expect(bandText(null, null, 78, s, false)).toBeNull()
  expect(bandText(T, 16, 78, s, false)?.endsWith(' · 待辦 16')).toBe(true)
})

test('hint strings exist in every language', () => {
  for (const lang of ['zh-TW', 'zh-CN', 'en'] as const) {
    const s = STRINGS[lang]
    expect(s.bandHint.includes('/jira-todo')).toBe(true)
    expect(s.closedHint.includes('/jira-todo')).toBe(true)
    expect(s.narrowHint.includes('/jira-todo')).toBe(true)
  }
})

test('rules tell Claude to mention /jira-todo, without changing with pane state', () => {
  expect(rulesSection(null, []).includes('/jira-todo')).toBe(true)
})

test('tool calls that write branch8-jira-check folder records', () => {
  const rec = '/home/g/.claude/branch8-jira/projects/home_g_work_x.json'
  expect(touchesFolderRecords('Write', { file_path: rec })).toBe(true)
  expect(touchesFolderRecords('Edit', { file_path: rec })).toBe(true)
  expect(touchesFolderRecords('Bash', { command: `mkdir -p ~/.claude/branch8-jira/projects && cat > "${rec}" <<'EOF'` })).toBe(true)
  expect(touchesFolderRecords('Bash', { command: 'bash /p/bin/branch8-jira record-path /w' })).toBe(false)
  expect(touchesFolderRecords('Write', { file_path: '/home/g/work/README.md' })).toBe(false)
  expect(touchesFolderRecords('Read', { file_path: rec })).toBe(false)
  expect(touchesFolderRecords('Write', { file_path: 'C:\\Users\\g\\.claude\\branch8-jira\\projects\\x.json' })).toBe(true)
})

test('Jira queries ask only for the fields drawn, never descriptions', () => {
  expect(TODO_FIELDS.includes('description')).toBe(false)
  expect(ISSUE_FIELDS.includes('description')).toBe(false)
  expect(TODO_FIELDS.includes('issuetype')).toBe(true)
})

test('search results with issues under nodes (the shape a fields-limited search answers)', () => {
  const text = JSON.stringify({
    issues: {
      nodes: [{ key: 'HS-134', fields: { summary: 'S', status: { name: '待辦事項' }, issuetype: { name: '任務' } } }],
    },
  })
  expect(parseIssueList([{ type: 'text', text }])).toEqual([{ key: 'HS-134', summary: 'S', status: '待辦事項', type: '任務' }])
})

test('settings popup strings in every language', () => {
  for (const lang of ['zh-TW', 'zh-CN', 'en'] as const) {
    expect(STRINGS[lang].settings.startsWith('⚙')).toBe(true)
    expect(STRINGS[lang].settingsBack.length > 0).toBe(true)
  }
  expect(STRINGS['zh-TW'].settings).toBe('⚙ 設定')
})

const ORDER_GROUPS = groupTodos([
  { key: 'HS-1', summary: 'a', status: '待辦' },
  { key: 'HS-2', summary: 'b', status: '進行中' },
  { key: 'HTGO2-9', summary: 'c', status: '待辦' },
])

test('focus order follows the drawn tree', () => {
  expect(focusOrder({ groups: ORDER_GROUPS, folded: [], statusFolded: [] })).toEqual([
    'settings', 'hotkey-o',
    'p-HS', 's-HS/待辦', 'HS-1', 's-HS/進行中', 'HS-2',
    'p-HTGO2', 's-HTGO2/待辦', 'HTGO2-9',
  ])
})

test('focus order skips folded branches and adds open menus and the unselect button', () => {
  expect(
    focusOrder({
      groups: ORDER_GROUPS,
      folded: ['HTGO2'],
      statusFolded: ['HS/進行中'],
      settings: ['lang', 'back'],
      current: 'HS-1',
      menu: { key: 'HS-1', values: ['clear', 'cancel'] },
    }),
  ).toEqual([
    'settings', 'hotkey-o', 'settings-lang', 'settings-back', 'clear-top',
    'p-HS', 's-HS/待辦', 'HS-1', 'menu-HS-1-clear', 'menu-HS-1-cancel', 's-HS/進行中', 'p-HTGO2',
  ])
})

test('popup options in order', () => {
  expect(settingsValues(true)).toEqual(['lang', 'auto', 'scope', 'range', 'close', 'back'])
  expect(settingsValues(false)).toEqual(['lang', 'auto', 'range', 'close', 'back'])
  expect(menuValues(false, false)).toEqual(['work', 'open', 'cancel'])
  expect(menuValues(true, false)).toEqual(['move', 'work', 'open', 'cancel'])
  expect(menuValues(false, true)).toEqual(['clear', 'open', 'cancel'])
})

test('stepping the ring clamps at the ends and starts from an end when on nothing', () => {
  const order = ['a', 'b', 'c']
  expect(stepFocus(order, 'b', 1)).toBe('c')
  expect(stepFocus(order, 'b', -1)).toBe('a')
  expect(stepFocus(order, 'c', 1)).toBe('c')
  expect(stepFocus(order, 'a', -1)).toBe('a')
  expect(stepFocus(order, null, 1)).toBe('a')
  expect(stepFocus(order, null, -1)).toBe('c')
  expect(stepFocus(order, 'gone', 1)).toBe('a')
  expect(stepFocus([], null, 1)).toBeNull()
})

test('back in the pane, the first arrow lands on where the ring was when it left', () => {
  const order = ['a', 'b', 'c']
  expect(stepFocus(order, leftFrom('b'), 1)).toBe('b')
  expect(stepFocus(order, leftFrom('b'), -1)).toBe('b')
  expect(stepFocus(order, leftFrom('gone'), 1)).toBe('a')
  expect(leftFrom(leftFrom('b'))).toBe(leftFrom('b'))
  expect(leftFrom(null)).toBeNull()
})

test('only the arrow keys count as arrow scrolls, not the wheel, page keys or a plugin', () => {
  expect(isArrowScroll({ by: 1, origin: { kind: 'person' } })).toBe(true)
  expect(isArrowScroll({ by: -1, origin: { kind: 'person' } })).toBe(true)
  expect(isArrowScroll({ by: 1, origin: { kind: 'person' }, pointer: { row: 3 } })).toBe(false)
  expect(isArrowScroll({ by: 12, origin: { kind: 'person' } })).toBe(false)
  expect(isArrowScroll({ by: 1, origin: { kind: 'plugin' } })).toBe(false)
})

test('todo JQL narrows by update age and project, newest first', () => {
  expect(todoJql({ days: 90, project: 'HS' })).toBe(
    'assignee = currentUser() AND statusCategory != Done AND project = "HS" AND updated >= -90d ORDER BY updated DESC',
  )
  expect(todoJql({ days: 30, project: null })).toBe(
    'assignee = currentUser() AND statusCategory != Done AND updated >= -30d ORDER BY updated DESC',
  )
})

test('range setting cycles 1, 3, 6 months and no limit', () => {
  expect(nextRange(30)).toBe(90)
  expect(nextRange(90)).toBe(180)
  expect(nextRange(180)).toBe(0)
  expect(nextRange(0)).toBe(30)
  expect(nextRange(7)).toBe(90)
})

test('a search page carries the next page token until the last page', () => {
  const page = (o: object) => [{ type: 'text', text: JSON.stringify({ data: o }) }]
  const issues = [{ key: 'HS-1', fields: { summary: 'a', status: { name: 'x' } } }]
  expect(parseIssuePage(page({ issues, nextPageToken: 'T', isLast: false }))).toEqual({
    items: [{ key: 'HS-1', summary: 'a', status: 'x' }],
    next: 'T',
  })
  expect(parseIssuePage(page({ issues, nextPageToken: 'T', isLast: true }))?.next).toBeNull()
  expect(parseIssuePage(page({ issues }))?.next).toBeNull()
  expect(parseIssuePage([{ type: 'text', text: 'nope' }])).toBeNull()
})

test('the load-more button is the last stop when there is more', () => {
  const order = focusOrder({ groups: ORDER_GROUPS, folded: [], statusFolded: [], more: true })
  expect(order[order.length - 1]).toBe('more')
})

test('range and load-more strings in every language', () => {
  for (const lang of ['zh-TW', 'zh-CN', 'en'] as const) {
    expect(STRINGS[lang].rangeLabel(90).length > 0).toBe(true)
    expect(STRINGS[lang].rangeLabel(0).length > 0).toBe(true)
    expect(STRINGS[lang].loadMore(20).length > 0).toBe(true)
  }
  expect(STRINGS['zh-TW'].rangeLabel(90)).toBe('時間：近 3 個月')
  expect(STRINGS['zh-TW'].rangeLabel(0)).toBe('時間：不限')
})

test('a nodes page carries its cursor in pageInfo', () => {
  const nodes = [{ key: 'HS-1', fields: { summary: 'a', status: { name: 'x' } } }]
  const text = (o: object) => [{ type: 'text', text: JSON.stringify(o) }]
  expect(parseIssuePage(text({ issues: { nodes, pageInfo: { hasNextPage: true, endCursor: 'C' } } }))?.next).toBe('C')
  expect(parseIssuePage(text({ issues: { nodes, pageInfo: { hasNextPage: false, endCursor: 'C' } } }))?.next).toBeNull()
})

test('the note Claude reads when the person picks or unselects a ticket in the pane', () => {
  const note = pickNote({ key: 'HS-96', summary: '員工多重身分', status: 'Need to fix', cloudId: 'c' })
  expect(note.includes('HS-96')).toBe(true)
  expect(note.includes('員工多重身分')).toBe(true)
  expect(note.includes('Need to fix')).toBe(true)
  expect(note.includes('/jira-todo')).toBe(true)
  expect(pickNote(null).includes('no current Jira ticket')).toBe(true)
})

test('the version shown in the pane comes from plugin.json', () => {
  expect(manifestVersion('{"name":"branch8-jira-mod","version":"0.13.0"}')).toBe('0.13.0')
  expect(manifestVersion('{"name":"x"}')).toBeNull()
  expect(manifestVersion('not json')).toBeNull()
})

test('a published version is newer only when its numbers are higher', () => {
  expect(isNewer('0.14.0', '0.13.0')).toBe(true)
  expect(isNewer('0.13.1', '0.13.0')).toBe(true)
  expect(isNewer('1.0.0', '0.99.9')).toBe(true)
  expect(isNewer('0.10.0', '0.9.0')).toBe(true)
  expect(isNewer('0.13.0', '0.13.0')).toBe(false)
  expect(isNewer('0.12.0', '0.13.0')).toBe(false)
  expect(isNewer(null, '0.13.0')).toBe(false)
  expect(isNewer('0.14.0', null)).toBe(false)
})

test('update strings in every language', () => {
  for (const lang of ['zh-TW', 'zh-CN', 'en'] as const) {
    const s = STRINGS[lang]
    expect(s.updateTo('0.14.0').includes('0.14.0')).toBe(true)
    expect(s.updateFailed.includes('/plugin update branch8-jira-mod@branch8')).toBe(true)
    expect(s.updated('0.14.0').includes('0.14.0')).toBe(true)
    expect(s.updating.length > 0).toBe(true)
  }
})

test('the update button sits after the toolbar when there is one', () => {
  expect(focusOrder({ groups: [], folded: [], statusFolded: [], update: true }).slice(0, 3)).toEqual([
    'settings', 'hotkey-o', 'update',
  ])
})
