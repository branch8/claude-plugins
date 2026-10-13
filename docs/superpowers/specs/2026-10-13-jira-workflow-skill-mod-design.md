# Jira 工作流程 skill 與 mod 擴充：設計

2026-10-13 · 狀態：待審閱

## 目的

讓「這個任務對應哪張 Jira 單、要不要開新單、做到哪個階段」在每個 session 都可靠地處理，
並讓使用者隨時看得到目前任務的 Jira 單。

現況的問題（2026-10-08～13 實測）：

- 規則只在 SessionStart 注入，和其他 plugin 的開場合併後排在最後，第一句就是任務時 Claude 會整套跳過。
  第一則訊息提醒（1.1.4）補了第一則，但 session 中途的新任務仍可能漏。
- 沒有「移動 Jira 狀態」的能力。
- 使用者看不到目前任務對應哪張單。

## 範圍

**做：**

1. 新 skill `jira-workflow`：找單、決定是否開新單、在三個時機點推薦狀態轉換。
2. 新 mod（擴充，可選）：system prompt 規則段落、指令偵測補漏、時機點紀錄、輸入框上方顯示目前的單。

**不做：**

- 不改寫現有 `branch8-jira-check` 的 bash hook。開頭橫幅、帳號檢查、資料夾對應 Jira 板、第一則訊息提醒維持原樣。
- 不碰 QA 之後的階段（QA、部署、上線），那是別人的工作，Claude 看不到。
- 不自動移動狀態，一律先問。

## 已定案的決策

| 決策 | 內容 | 理由 |
|---|---|---|
| 擴充而非改寫 | 現有 plugin 不動；skill 加進現有 plugin；mod 獨立 | mod 能否透過 managed settings 發布、同事版本是否支援都未驗證。mod 不能用時，核心功能仍在 |
| 判斷交給 skill，偵測交給 mod | skill 做語意判斷（主要），mod 做固定指令偵測（補漏） | 「推上去讓人審」「做完了」這類說法沒有固定指令；固定指令則是 Claude 容易忘記的地方。兩邊都判斷，用紀錄去重 |
| 找單順序 | 訊息裡的單號 → git branch 名的單號 → 本 session 正在做的單 → 搜尋「指派給我、未完成」的單挑相關的 | 能自己確定的不問；找到候選用卡片確認；都沒有才問「有單／幫我開／不用」 |
| 移動狀態的時機 | 只在三個時機點：開始動手、開 PR、合併 | Claude 看得到的只有開發者自己的節點 |
| 移動狀態的方式 | 從該單「現在可走的轉換」推薦一個，用卡片確認後才移 | 各專案流程差異大（HS 10 個狀態，HTGO2 33 個），狀態類別也不可靠（HTGO2 的 `WIP` 被歸為「未開始」），不能寫死也不能靠類別推斷 |
| 顯示位置 | 輸入框上方一行；沒有單時不佔位 | 使用者選定；終端機與桌面版 Code 分頁都能顯示 |
| 第一版即正式設計 | 先只裝在 Glenn 的機器上試用，程式碼沿用到正式版 | 試用回饋只做調整，不重寫 |

## 元件

### 1. skill `jira-workflow`（放在 `plugins/branch8-jira-check/skills/jira-workflow/`）

隨現有 plugin 發布，不依賴 mod。

**觸發時機**（寫在 skill 的 description，讓 Claude 自行判斷是否使用）：使用者開始一個新任務、
開始動手修改、開 PR 或要求審查、合併或宣告完成。

**找單**

1. 訊息裡有單號（如 `HS-123`）→ 用 `getJiraIssue` 確認存在，直接採用，不問。
2. git branch 名含單號 → 同上，不問。
3. 本 session 已在做某張單、且這則訊息是同一件事的延續 → 沿用，不問。
4. 搜尋：`assignee = currentUser() AND statusCategory != Done AND project = <資料夾對應的專案>`，
   依標題與任務內容挑相關的。
   - 找到 1～3 張候選 → 卡片列出（單號、標題、狀態），加上「都不是／開新單／不用」。
   - 一張都沒有 → 卡片問「有單（給單號）／幫我開／不用」。
5. 資料夾還沒對應 Jira 專案 → 先走現有的 board 卡片，再找單。

**開新單**：在資料夾對應的專案建立，類型用記錄裡的 `defaultIssueType`（預設 Task），
標題與描述由 Claude 依任務擬好，**在卡片上先列出標題讓使用者確認**後才建立。

**推薦狀態轉換**

1. 用 `listJiraIssueTransitions` 取得該單現在可走的轉換。
2. 依時機點從中挑最合適的：
   - 開始動手 → 名稱或目標狀態最接近「進行中／WIP／In Progress」的
   - 開 PR → 最接近「Dev done／PR created／Code review」的
   - 合併 → 最接近「Merged／Ready to deploy」的；若下一步明顯屬於 QA，則不推薦
3. 一個合適 → 卡片問「移到 X／不用」；多個 → 卡片列出，推薦的排第一；沒有合適的 → 不問。
4. 確認後呼叫 `transitionJiraIssue`。需要填欄位或沒有權限 → 不硬做，告知原因並附 `<site>/browse/<KEY>` 連結。
5. 問過（不論答案）就記錄，同一張單的同一個時機點不再問。有 mod 時記在 mod；沒有 mod 時記在對話中。

**語言與安靜原則**：沿用現有規則，訊息與卡片用使用者的語言；不敘述檢查過程。

### 2. mod `branch8-jira-mod`（獨立擴充，可選）

TypeScript function hooks，不依賴 bash。

| 功能 | 機制 | 說明 |
|---|---|---|
| 規則段落 | `prompt.compose` 加一段 system prompt（`scope: 'session'`） | 幾行：「新任務、開始動手、開 PR、合併時使用 `jira-workflow` skill」，加上目前的單與已問過的時機點。內容只在換單或記錄時機點時變動，避免每輪讓 prompt 快取失效 |
| 目前的單 | `$.tool.register`：`set_ticket(key)`、`get_ticket()`、`mark_asked(key, node)` | skill 找到單後呼叫 `set_ticket`；compact 後由規則段落與 `get_ticket` 補回 |
| 時機點偵測補漏 | `tool.call` 監看：第一次 Edit／Write（開始動手）；Bash 的 `gh pr create`（開 PR）；`git merge`、`gh pr merge`（合併） | 偵測到且該單該時機點尚未問過 → 在結果附上提醒，讓 Claude 使用 skill。排除 `--help`、`--dry-run` |
| 顯示 | `ui.render` 的 `AbovePrompt` | `🎫 HS-123 標題 · 狀態`；沒有單時 `next(e)`，不佔位 |
| 狀態更新 | `$.mcp.call` 呼叫 Atlassian 的 `getJiraIssue` | `set_ticket` 時查一次；每輪結束時重查，最多每 60 秒一次 |

狀態存在 `$.state`（僅本 session），session 結束即清除。不寫入 repo 或 Jira。

## 資料流程（範例）

1. 使用者：「修正請假審核通知」→ 規則段落／第一則提醒 → Claude 使用 skill → 搜尋到 HS-123 → 卡片確認。
2. Claude 呼叫 `set_ticket("HS-123")` → mod 查 Jira → 輸入框上方顯示 `🎫 HS-123 修正請假審核通知 · 待辦事項`。
3. Claude 開始改程式 → skill 判斷為「開始動手」→ 可走的轉換中推薦「進行中」→ 卡片確認 → 移動 → `mark_asked` → 顯示更新。
4. Claude 執行 `gh pr create` → mod 偵測，該單「開 PR」尚未問過 → 提醒 Claude → skill 推薦 `Dev done, QA to do` → 卡片確認。
5. 使用者拒絕也記錄，不再問。

## 錯誤與例外

| 情況 | 處理 |
|---|---|
| Jira 沒連上 | 沿用現有連線卡片；使用者選不連，本 session 不碰 Jira，不顯示 |
| 多張候選單 | 卡片最多 3 張，加「都不是／開新單／不用」 |
| 要開單但資料夾未對應 | 先問對應哪個板，再開單 |
| 沒有合適的轉換 | 不問，安靜略過 |
| 多個合適的轉換 | 卡片列出，推薦的排第一 |
| 轉換需填欄位／沒權限 | 不硬做，告知原因並附連結 |
| 指令偵測誤判 | mod 只提醒，由 skill 判斷，不會直接移狀態 |
| 中途換任務 | `set_ticket` 換單；問過的紀錄依單號分開 |
| 別人在 Jira 改了狀態 | 每輪結束重查（最多每 60 秒） |
| Jira 查詢失敗 | 顯示 `🎫 HS-123 · 狀態無法取得`，不影響其他功能 |
| 沒有 mod | skill 獨立運作；session 中途新任務與 PR／合併時機點可能漏問，紀錄只在對話中 |

## 測試

測試專案：**HS（HR System）**。測試單一律加 `claude-test` 標籤、標題以 `[測試]` 開頭、指派給 Glenn；
測完移到 `已取消`（有權限則刪除）。不動任何既有的單；判斷邏輯對既有單只讀取可走的轉換，不移動。

**mod 單元測試**（`claude plugin test`、`claude plugin validate`、`tsc`）

- 時機點偵測：第一次 Edit／Write；`gh pr create` 各種寫法、`git merge`、`gh pr merge`；`--help`、`--dry-run` 不觸發
- 去重：同單同時機點只提醒一次；換單後重新計算
- 顯示：有單、沒單、Jira 查詢失敗

**真實介面測試**（tmux 跑互動式 session，同 1.1.4 的方法）

1. 第一句就是任務 → 找單卡片出現在動手之前
2. branch 名含單號 → 不問，直接採用
3. 多張候選單 → 卡片列出
4. 開 PR → 出現移狀態卡片（skill 判斷與 mod 補漏各測一次）
5. 拒絕後不再問
6. 不裝 mod → skill 獨立完成 1～3

**既有檢查**：`tests/context-size.sh`、`validate.py` 須通過；skill 不得讓 SessionStart 注入超過預算。

## 發布

- **第一版**：skill 進 `branch8-jira-check`（版本 1.2.0），照現有方式發布；mod 只裝在 Glenn 的機器上試用。
- **正式發布 mod 前須驗證**：能否透過 managed settings 或 marketplace 自動安裝到同事電腦；
  同事的 Claude Code 版本是否支援 mod；桌面版 Code 分頁的顯示。驗證不通過時，維持「plugin + skill」即可。
- `managed-settings.json`：skill 隨現有 plugin 發布，不需修改；mod 若要發給全公司，需在 `enabledPlugins` 加一行並同步貼到後台。

## 未決事項

- mod 的發布管道（見上）
- 「開始動手」的判定標準：第一版以「第一次修改檔案」為準（mod 偵測第一次 Edit／Write），試用後調整
