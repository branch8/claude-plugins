# Branch8 claude-plugins

全公司 Claude 技能的單一來源。**改這個 repo，全公司的 Claude 就跟著變。**

同事不需要安裝任何東西，也不需要手動更新。

> ⚠️ **可見性要求取決於你走哪條發送管道，兩者相反：**
>
> | 管道 | 可見性要求 | 認證方式 |
> |---|---|---|
> | `managed-settings.json`（Claude Code CLI / IDE） | **無限制，public 可以** | 同事自己的 git credential helper |
> | Organization settings › Plugins（chat / Cowork） | **必須 private / internal** | Claude GitHub App，不碰同事憑證 |
>
> 這個 repo 目前是 **public**，因為只走 Claude Code 那條。理由見
> [為什麼目前是 public](#為什麼目前是-public)。

---

## 目錄

0. [目前發送什麼](#目前發送什麼)
1. [一分鐘搞懂](#一分鐘搞懂)
2. [目錄結構](#目錄結構)
3. [四支腳本在做什麼](#四支腳本在做什麼)
4. [日常操作](#日常操作)
5. [全自動模式](#全自動模式)
6. [首次設定](#首次設定)
7. [開發自訂 plugin](#開發自訂-plugin)
8. [第三方 plugin 怎麼管](#第三方-plugin-怎麼管)
9. [不依賴任何個人](#不依賴任何個人)
10. [排查](#排查)
11. [為什麼目前是 public](#為什麼目前是-public)
12. [限制與已知問題](#限制與已知問題)

---

## 目前發送什麼

七個 plugin。**六個直接用 Anthropic 官方來源，只有一個需要 vendoring。**

| Plugin | 來源 | 為什麼 |
|---|---|---|
| `atlassian` | 官方 | Jira / Confluence。Atlassian 官方 MCP，官方已 pin sha |
| `superpowers` | 官方 | TDD、除錯、規劃流程 |
| `mattpocock-skills` | 官方 | TypeScript、code review、domain modelling |
| `skill-creator` | 官方 | 寫 / 改 / 測 skill |
| `frontend-design` | 官方 | 前端視覺設計方向 |
| `github` | 官方 | GitHub MCP |
| `ui-ux-pro-max` | **vendored** | UI/UX 設計資料庫。**官方沒有上架**，所以走 vendoring |

判斷方式不是「信不信任作者」，而是**官方有沒有上架**。官方上架的 plugin，
Anthropic 的 CI 已經幫它釘在特定 commit 上（外部 repo 的 source 都帶 `sha`），
自己再 vendoring 一次是重做別人做過的事。查法：

```bash
python3 - <<'EOF'
import json
d=json.load(open('/home/glenn/.claude/plugins/marketplaces/claude-plugins-official/.claude-plugin/marketplace.json'))
print(sorted(p['name'] for p in d['plugins']))
EOF
```

**代價要知道**：走官方來源，等於把「何時更新」交給 Anthropic——它移動 pin，
同事就跟著更新，公司這邊沒有審查點。只有 `ui-ux-pro-max` 這種沒上架的，
才會經過本 repo 的 PR 流程。這是決策 3 刻意的取捨，見 `CLAUDE.md`。

---

## 一分鐘搞懂

```
你改 repo  →  開 PR  →  合併  →  自動同步  →  全公司更新
```

repo 裡有兩種東西：

- **`plugins/`** — 我們自己寫的。想改就直接改。
- **`vendor/`** — 從別人的 repo 複製過來的。**不要手改**，由腳本產生。

為什麼第三方要複製一份而不是直接連過去？因為 plugin 可以在同事電腦上執行任意程式碼，
而且第三方 plugin 不經 Anthropic 審核。複製一份並鎖定版本之後，作者半夜改東西不會
直接影響你們——會先變成一個 PR 讓你看過再決定。

（這在軟體業叫 vendoring，Go 的 `vendor/`、npm 的 lockfile 都是同一個概念。）

### 東西怎麼到同事手上

發送分兩個管道，都指向這個 repo：

| 管道 | 涵蓋 | 設定位置 |
|---|---|---|
| 組織 marketplace | chat（網頁、手機、桌面 App 的 Chat 分頁）、Cowork | Organization settings › Plugins |
| managed settings | Claude Code（CLI、IDE） | Admin Settings › Claude Code › Managed settings |

兩處都是**一次性設定**。設完之後日常只動 repo，兩邊自動跟上。

---

## 目錄結構

```
.claude-plugin/
  marketplace.json          發送清單。只放「官方沒上架」的 plugin
managed-settings.json       貼到 Admin Settings › Claude Code › Managed settings 的內容
                            官方那 6 個是在這裡用 @claude-plugins-official 引用
plugins/
  branch8-jira-check/       SessionStart hook：顯示當下的 Claude 帳號（個人帳號碰公司專案
                            會警告）、檢查 Jira 連線與 Jira 帳號、每個專案問一次對應哪個
                            Jira 板並記在本機 ~/.claude/branch8-jira/projects/、新任務先問
                            有沒有 Jira 單，沒有就在該板建立。另有 /jira-check、/jira-board。
                            公司設定值（組織 ID、Jira 站台、email 網域、公司 git remote）
                            在 config.env；整個關掉：設 BRANCH8_JIRA_CHECK=off
template/
  plugin-template/          開發新 plugin 的起點，複製到 plugins/ 再改
                            沒列在 marketplace.json，所以永遠不會被發送
vendor/
  ui-ux-pro-max/            第三方，腳本產生，不要手改
vendor.lock.json            記錄每個第三方鎖在哪個 commit
scripts/                    四支維護腳本（見下節）
.github/workflows/          三個自動化流程
CLAUDE.md                   設計決策與待辦，Claude Code 會自動載入
CODEOWNERS                  審查者指派（用 team，不要用個人）
```

**兩份清單，不要搞混：**

- `marketplace.json` — 只有 vendored 的東西。官方 plugin **不要**寫進來。
- `managed-settings.json` — 全部七個都在這，官方的標 `@claude-plugins-official`，
  vendored 的標 `@branch8`。

---

## 四支腳本在做什麼

全部只用 Python 標準函式庫，不需要安裝任何東西。

### `vendor.py` — 把第三方抓下來

讀 `vendor.lock.json`，按裡面寫的網址和版本號去 GitHub 抓，複製到 `vendor/`，
清掉不需要的東西（`.git`、`.github`、`node_modules`），最後寫一張 `VENDORED.md`
記錄來源。

```bash
python3 scripts/vendor.py --check          # 只看上游有沒有新版，不動檔案
python3 scripts/vendor.py                  # 真的抓
python3 scripts/vendor.py --only superpowers
```

`--check` 會印出 compare 連結，點下去就能看上游改了什麼。

**規定**：`ref` 必須是完整 40 碼 commit SHA，不能寫 `main`。腳本會拒絕分支名稱——
分支內容隨時會變，等於沒鎖。

### `auto_update.py` — 機器人的大腦

把「檢查上游 → 重新抓 → 改版本號 → 寫好 PR 說明」一次做完。每週自動跑，
正常情況你不會手動碰它。

```bash
python3 scripts/auto_update.py --dry-run   # 預覽機器人會做什麼
```

跟 `vendor.py` 的差別：`vendor.py` 是照 lock 檔抓東西的工人，`auto_update.py`
是決定「該抓什麼、版本怎麼改、PR 要寫什麼」的管理者。

### `validate.py` — 上線前的健康檢查

擋掉會讓同步失敗的錯誤：格式、保留名稱、資料夾存不存在、source 是不是相對路徑、
`plugin.json` 名字對不對得上、版本格式、vendored 目錄有沒有登記在 lock 檔。

```bash
python3 scripts/validate.py
```

**為什麼需要**：同步失敗時 plugin 可能從所有同事帳號上暫時消失，而且修好之後
安裝偏好有可能被重設。本機花兩秒檢查比事後收拾便宜太多。

### `check_version_bump.py` — 防止忘記改版本號

比對這個 PR 動到哪些 plugin，檢查版本號有沒有跟著改。CI 會自動跑，
加 `--fix` 會直接幫你改好。

**為什麼需要**：後台判斷「要不要同步」是**看版本號有沒有變**，不是看你改了什麼檔案。
忘記改版本號的話，PR 會安靜地合併，然後什麼都不會發生——你以為部署了，其實沒有。

---

## 日常操作

### A. 改我們自己的 plugin

```bash
# 1. 改 plugins/internal-review/ 底下的檔案
# 2. 改版本號（忘了也沒關係，CI 會幫你補）
python3 scripts/validate.py
# 3. 開 PR，合併
```

### B. 更新第三方（通常不用手動，機器人會開 PR）

```bash
python3 scripts/vendor.py --check    # 看上游動靜
# 點開 compare 連結，確認可以接受
# 把 vendor.lock.json 的 ref 換成新 SHA
python3 scripts/vendor.py
git diff vendor/                     # 這份 diff 就是你的 review
python3 scripts/validate.py
```

### C. 新增第三方

```bash
# 1. vendor.lock.json 的 sources 加一筆：
#    { "dest": "名字", "repo": "https://github.com/xxx/yyy.git",
#      "ref": "完整 40 碼 SHA", "subdir": ".", "license": "MIT" }
python3 scripts/vendor.py --only 名字
# 2. 確認 vendor/名字/ 底下有 plugin.json
#    沒有的話代表根目錄在子資料夾，回去改 subdir 重跑
# 3. marketplace.json 加一筆 { "name": "名字", "source": "./vendor/名字" }
python3 scripts/validate.py
```

⚠️ 新增 plugin 時，**Claude Code 那份 managed settings 也要加一行** `enabledPlugins`。
這是唯一需要同時動兩邊的情況。

### D. 移除

從 `marketplace.json` 拿掉那筆、刪資料夾（第三方的話連 lock 檔那筆也刪），開 PR。

---

## 全自動模式

```
每週一 09:00（台北時間）
  ↓  機器人檢查每個第三方的上游
  ↓  有更新：重新抓、改版本號、跑檢查
  ↓  自動開 PR，附上游 diff 連結和審查重點
  ↓  你看過、按 merge
  ↓  全公司更新
```

**沒有更新就不會開 PR**，信箱不會被洗。

### PR 長什麼樣

```
## superpowers

- Upstream diff: https://github.com/obra/superpowers/compare/26d56a...29d3c7
- Commit: `26d56a78b0a9` -> `29d3c7555b2e`
- Version: `1.2.3` -> `1.2.4` (local bump)
- Changes: 4 files changed, 9 insertions(+), 3 deletions(-)

⚠️ 這次更新動到了可執行檔或 hook，請逐行看

**Executable or config files in this update:**
- `vendor/superpowers/scripts/install.sh`
```

最後那段是重點：**上游偷偷多一支 shell script，或動到 hook、MCP 設定，PR 會直接標出來**。

PR 描述是固定模板拼出來的，沒有 LLM 參與。它不會告訴你上游改了什麼，
只告訴你哪裡改了、去哪看。（為什麼不用 LLM 寫摘要，見 `CLAUDE.md` 決策 5。）

### 你在 PR 上可以做的三件事

| 想做 | 怎麼做 |
|---|---|
| 接受 | 直接 merge |
| 這版不要 | 直接 close，下週會重開 |
| 這版永遠不要 | 手動把 lock 檔的 `ref` 鎖在最後一個好的 SHA，並留言說明 |

### 想立刻檢查

Actions 分頁 → vendor-update → Run workflow。可以只跑其中一個 plugin。

---

## 首次設定

### 第一步：GitHub

1. **Settings › Actions › General › Workflow permissions**
   - 選 **Read and write permissions**
   - 勾 **Allow GitHub Actions to create and approve pull requests**
   - 不開這兩個，機器人開 PR 會失敗
2. 建兩個 label：`vendor`、`automation-failure`
3. 把 `CODEOWNERS` 裡的 team handle 換成真實的
4. **Settings › Branches** 加保護規則：要求 PR、要求 Code Owner 審查

### 第二步：chat / Cowork（Organization settings › Plugins）

需要 Owner 或 Primary Owner 權限。

1. 確認組織已開 **Code execution and file creation**、**Skills**、**Cowork**
2. 確認 Claude 的 GitHub App 已裝在這個 repo（**要裝在 organization 層級**）
3. Add plugin → GitHub → 填 `branch8/claude-plugins`
4. 右上角選單 → 開啟 **Sync automatically**
   - 開這個開關的人需要對 repo 有 GitHub admin 權限（要建 webhook）
5. 幫每個 plugin 選安裝偏好：

| 選項 | 效果 | 適合 |
|---|---|---|
| **Required** ← 目前這七個都用這個 | 自動裝並啟用，不能移除 | 團隊必要工具、公司規範類 |
| **Installed by default** | 自動裝，可自行移除 | 選配、好用但不強制的 |
| **Available for install** | 出現在目錄，自己裝 | 實驗中的 |
| **Not available** | 完全隱藏 | 準備中或已淘汰 |

目前發送的七個全部是**團隊必要**，所以一律 `Required`。之後加選配工具時
再用 `Installed by default`——把兩者混在同一個等級，會讓「必要」失去意義。

### 第三步：Claude Code（Admin Settings › Claude Code › Managed settings）

直接貼 **`managed-settings.json`** 的內容（那個檔就是這一步的單一來源，
改發送清單時改它，不要改這裡的複製品）：

```json
{
  "extraKnownMarketplaces": {
    "branch8": {
      "source": { "source": "github", "repo": "branch8/claude-plugins" },
      "autoUpdate": true
    }
  },
  "enabledPlugins": {
    "atlassian@claude-plugins-official": true,
    "superpowers@claude-plugins-official": true,
    "mattpocock-skills@claude-plugins-official": true,
    "skill-creator@claude-plugins-official": true,
    "frontend-design@claude-plugins-official": true,
    "github@claude-plugins-official": true,
    "ui-ux-pro-max@branch8": true
  }
}
```

三個欄位回答三個問題：

- `extraKnownMarketplaces` — **去哪拿**。只放自己的 repo。
  官方的 `claude-plugins-official` 是內建的，不需要註冊（已實測：
  `known_marketplaces.json` 裡它是自動出現的，沒有人手動加過）。
- `enabledPlugins` — **拿哪些**。格式是 `plugin名字@來源名字`。
  **官方上架的一律標 `@claude-plugins-official`，不要 vendoring 進本 repo。**
- （沒設 `strictKnownMarketplaces`）— 同事仍可自由安裝別的 plugin。
  公司設定只管「至少要有什麼」。

⚠️ `branch8` 這個名字出現在三個地方且必須完全一致：
`marketplace.json` 的 `name`、`managed-settings.json` 的兩處。

### 兩邊的差別

chat 那邊是完全無感自動裝好；Claude Code 那邊會跳一次資料夾信任確認才裝。
這是刻意的，因為 plugin 可以在本機執行程式碼。

**先設一邊、跑順了再補另一邊也完全沒問題**，兩邊沒有依賴關係。

---

## 開發自訂 plugin

從 `template/plugin-template/` 複製，不要從零開始：

```bash
cp -r template/plugin-template plugins/你的plugin名
```

然後改三個地方——**這三處的名字必須完全一致**：

| 檔案 | 改什麼 |
|---|---|
| `plugins/你的plugin名/.claude-plugin/plugin.json` | `name`、`version`、`description` |
| `.claude-plugin/marketplace.json` | 加一筆 `{ "name": "...", "source": "./plugins/..." }` |
| `managed-settings.json` | `enabledPlugins` 加一行 `"你的plugin名@branch8": true` |

`python3 scripts/validate.py` → 開 PR → 合併 → 全公司拿到。

細節（`description` 怎麼寫才會觸發、複製後的完整 checklist、validate 會擋什麼）
見 [`template/README.md`](template/README.md)。

### 一個 plugin 可以同時裝很多東西

不用為了 skill 和 command 開兩個 plugin：

```
plugins/你的plugin名/
  .claude-plugin/plugin.json
  skills/xxx/SKILL.md        技能
  commands/yyy.md            slash command
  agents/zzz.md              subagent
  .mcp.json                  MCP server
```

用不到的目錄直接刪掉。`validate.py` 只要求至少有其中一種。

**MCP 的審查標準要分兩級**：`type: "http"` / `"sse"` 只是一個 URL，風險低；
**`stdio` 型的會在每位同事的機器上執行程式**，這跟「第三方 plugin 能執行任意程式碼」
是同一類風險，要用跟 vendoring 同等的標準審。

### 為什麼放在這個 repo，而不是各自開 repo

自家 plugin 一律用**相對路徑放在 `plugins/` 底下**（官方也是這個建議：
*"place the plugin folders inside the marketplace repository and reference them
with a relative path"*）。理由是維護成本與失敗成本都最低——一個 PR 看得到全部改動，
不需要在兩個 repo 之間同步版本。

**不要用 git submodule。** 官方文件對組織同步的 submodule 支援**完全沒有敘述**。
Claude Code 那側的 clone 確實帶 `--recurse-submodules`，但組織同步走的是
「Claude GitHub App 打包每個 plugin」那條路，submodule 會不會被打包進去無從得知。
用沒有文件保證的行為承載全公司分發，壞掉的時候無法歸因。

**也不要對自家 code 用 `vendor/`。** vendoring 存在的理由是「上游不受我控制，
所以要 pin 住 SHA 並逐行看 diff」（見決策 1）。自家 repo 沒有這個問題，套用只會
讓每改一行都要走兩次 PR——摩擦大到會讓人乾脆繞過流程。`vendor/` 只留給真正的第三方。

### 什麼時候才該把某個 plugin 拆出去

用 `github` source 加 `sha`（決策 3 的「第 2 級」，目前腳本還不支援，要先實作）。
觸發條件是下列之一，**不是「plugin 變多了」**：

1. 那個 plugin 開始有 repo 外的 contributor
2. 它需要自己的 CI / release cycle，跟 marketplace 的節奏脫鉤
3. 它大到讓 marketplace repo 的 clone 明顯變慢

而且是拆**那一個**，不是全部拆。

### repo 是 public，所以有內容邊界

放進 `plugins/` 的東西就是公開的。含公司業務邏輯的 plugin（談判立場、客戶專屬流程、
內部定價規則）**不能走這條路**。

那種的路徑是「同 owner 的 private repo + `github` source」——組織同步官方明文支援
（*"A github.com source that shares the marketplace repository's owner"*）。
但 Claude Code 那側仍需同事的 git 憑證，因為要取得 plugin 內容就得 clone 那個
private repo。

| plugin 性質 | 放哪 | Claude Code 端 |
|---|---|---|
| 通用方法論、工具、設計規範 | `plugins/`（public） | 零設定 |
| 含公司業務邏輯 | 同 owner 的 private repo + `github` source | 同事要 `gh auth login` |
| 真正的第三方 | `vendor/` + pin SHA | 零設定 |

---

## 第三方 plugin 怎麼管

判斷標準是**這個 plugin 能做什麼**，不是信不信任作者。

| 等級 | 做法 | 適用 |
|---|---|---|
| 1 | 直接用官方 marketplace | 純 prompt，沒有 hooks / MCP / 腳本 |
| 2 | marketplace.json 用 github source 加 `sha` | 想控版本但不需要看 diff |
| 3 | 完整 vendoring（本 repo 這套） | 有 hooks / MCP / 可執行檔，或壞掉會擋住很多人 |

**已經上架官方的，直接用官方版。** Anthropic 的 marketplace 會用 CI 把每個核准的
plugin 釘在特定 commit，pin 只在重新審查後才移動——這正是 vendoring 想達到的效果。
自己再 vendoring 一次是重做別人做過的事，而且會慢慢落後於上游修正。

**絕對不要**把第三方 marketplace 直接寫進 `extraKnownMarketplaces`：

```json
// ❌ 不要這樣
"extraKnownMarketplaces": {
  "superpowers-mp": { "source": {...obra/superpowers-marketplace...}, "autoUpdate": true }
}
```

上游作者 push 什麼，同事立刻拿到，中間沒有 PR、沒有你、什麼都沒有。
等於把整套審查機制繞過去。

「信任這個作者」和「信任他未來每一次的 push」是兩件事。

### 同名不同來源會裝兩份

如果同事之前自己 `/plugin marketplace add obra/superpowers-marketplace`，
那是 `superpowers@superpowers-marketplace`，跟 `superpowers@claude-plugins-official`
對系統來說是兩個完全不同的東西，兩份都會載入。

目前**沒有優先權或覆蓋機制**，無法指定「優先用內部這份」。

三個緩解做法：

1. 在團隊文件裡明講哪個 plugin 從哪個來源出
2. 上線前請大家開 `/plugin` 的 Installed 分頁清一次重複的
3. 自己寫的 plugin 用公司前綴命名（`acme-review` 而非 `code-review`）

### 同名同來源則沒問題

管理層級的設定優先權最高，覆蓋專案和個人設定。同事那份會被接管，
以 managed scope 顯示且無法修改。順序不是「誰先裝誰贏」，而是**管理設定永遠贏**。

---

## 不依賴任何個人

### 已經處理好的

| 項目 | 做法 |
|---|---|
| 執行環境 | GitHub Actions，跑在 GitHub 的機器上，沒有任何人的筆電參與 |
| 認證 | 內建 `GITHUB_TOKEN`。**沒用任何人的 PAT**——會過期，也會跟著離職的人消失 |
| 觸發 | cron 排程，不需要有人記得去跑 |
| 審查者 | `CODEOWNERS` 指到 team 而非個人 |
| 排程被停用 | 每月 heartbeat commit 維持 repo 活躍度 |
| Workflow 壞掉 | 自動開 issue，不會靜悄悄 |
| 沒人審 PR | 超過 14 天自動開 issue 提醒 |

### 你要自己確認的

1. **Repo 屬於 GitHub organization**，不能放在個人帳號底下
2. **Claude 那邊至少兩個 Owner**
3. **Claude 的 GitHub App 裝在 organization 層級**
4. **`CODEOWNERS` 裡每個 team 至少兩個人**
5. **開啟自動同步的人離職後會怎樣？** 見下方「未確認的事」

### 誰擁有這個 repo

- 主要負責：`@Branch8/platform-team`
- 第三方程式碼審查：`@Branch8/security`
- Claude 後台 Owner：（至少列兩個人）

---

## 排查

**改完合併了，但同事沒拿到新版**
八成是忘了 bump 版本號。直接 push 到預設分支也不會觸發，一定要走 PR。
同步最長可能跑 30 分鐘。

**同步失敗，plugin 從大家帳號上消失**
修好問題重新同步。**修好之後回去確認安裝偏好還在**——失敗可能把偏好重設掉。

**後台看不到我的 repo**
Claude GitHub App 沒裝在那個 repo 上。

**開自動同步時說 Cannot access repository**
你對 repo 沒有 GitHub admin 權限，或 Claude GitHub App 的 Webhooks 權限還沒批准。

**`vendor.py` 抓下來找不到 plugin.json**
plugin 根目錄不在最上層。去 GitHub 看實際結構，把 `subdir` 設對。

**機器人開的 PR 上沒有綠色勾勾**
正常。GitHub 的安全設計讓 `GITHUB_TOKEN` 開的 PR 不觸發其他 workflow，
所以檢查是在開 PR **之前**跑掉的，過不了就不會有 PR。

---

## 為什麼目前是 public

**2026-08-26 實測後的決定。** 官方對兩條管道的要求是相反的：

- `managed-settings.json` 的 `extraKnownMarketplaces`（Claude Code）——官方文件**沒有**
  可見性要求，並明言支援 private repo。
- Organization settings › Plugins（chat / Cowork）——官方原文：
  *"Your repository must be private or internal—public repos aren't allowed for
  organization marketplaces."*

只要還沒設 chat 那一側，public 就沒有壞處，而且**一次解掉三個閘門**：

| 閘門 | private 時 | public 後 |
|---|---|---|
| repo 讀取權 | 每個同事都要被加進 repo | 不需要 |
| git 憑證 | 每人要 `gh auth login`，漏掉的人只看到「contact your admin」 | 不需要 |
| 背景自動更新 | **必定失敗**（見下） | 正常運作 |

### private + Claude Code 的隱藏地雷

Claude Code 的背景自動更新會**強制清空 credential helper** 再 `git fetch`：

```js
let allow = gate("tengu_plugin_autoupdate_allow_credential_helper", false);  // 預設 false
refresh(mp, { disableCredentialHelper: !allow });   // → ["-c", "credential.helper="]
```

官方文件也承認：*"the background refresh disables git credential helpers for its
`git pull`, so the pull can't authenticate to private repositories over HTTPS even
when a helper is configured."*

也就是說 **private repo 上的 `autoUpdate: true` 是無效設定**——初次安裝和手動
`/plugin marketplace update` 會成功（那條路徑有用 helper），但之後永遠不會自動更新。

### 之後要上 chat / Cowork 怎麼辦

兩個選項，屆時再決定：

1. 改回 private，並讓每位同事跑一次 `gh auth login`（接受背景更新失效，靠手動
   `/plugin marketplace update branch8`）
2. 另開一個 private repo 專供組織 marketplace，本 repo 繼續服務 Claude Code

改回 private 只要 `gh repo edit branch8/claude-plugins --visibility private`，
但**公開過的內容收不回**（可能已被 fork 或索引）——所以這裡不放任何機密。
目前 repo 內容：`marketplace.json`、MIT 授權的 vendored 程式碼、維護腳本、本文件。

---

## 限制與已知問題

| 項目 | 數字 |
|---|---|
| repo 可見性 | Claude Code 端無限制；組織 marketplace（chat / Cowork）只能 private / internal |
| 每個 marketplace 的 plugin 上限 | 500 |
| plugin 名稱 | 小寫加連字號，64 字以內 |
| 同步逾時 | 30 分鐘 |

**版本無法逐一釘選。** `plugin install` 目前沒有 `--version` 參數，而把整個
marketplace 釘在某個 git ref 會凍結該 marketplace 裡的所有 plugin。
對官方 marketplace 只有「跟或不跟」，沒有中間地帶。

**依部門分流是 Enterprise 功能。** Team 方案只能設全組織統一的偏好。

### 未確認的事

**開啟 Sync automatically 的人離職後，同步會不會斷掉？** 建立 webhook 用的是
那個人對 repo 的 GitHub admin 權限。權限消失後會怎樣沒有明確答案。

建議：設定完成後合併一個小改動確認同步正常，並把「重新開關一次自動同步」
寫進離職 checklist。有 service account 的話用它來開更乾淨。

**Claude Code 是否真的會自動安裝。** 文件說成員信任 repo 資料夾後會自動安裝，
但曾有回報指出 CLI 使用者仍需手動跑一次 `/plugin install`。
上線前先在一台測試機驗證。
