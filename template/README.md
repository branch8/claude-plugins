# Plugin 開發模板

要開發一個新的公司自訂 plugin，從這裡複製，不要從零開始。

## 為什麼放這裡不會被發送出去

`validate.py` 和組織同步都只認 **`.claude-plugin/marketplace.json` 的 `plugins` 陣列**——
它們不掃目錄。`template/` 沒有列在那份清單裡，所以：

- 不會發送給任何人
- 不會被 `validate.py` 檢查（所以裡面的佔位值不會讓 CI 變紅）
- 不會被本 repo 的 Claude Code 當成 skill 載入（專案層級只讀 `.claude/skills/`，本 repo 沒有這個目錄）

換句話說，**一個 plugin 存不存在，看的是 marketplace.json，不是它在不在硬碟上。**

## 三步

```bash
# 1. 複製並改名
cp -r template/plugin-template plugins/你的plugin名

# 2. 改 .claude-plugin/plugin.json 的 name（必須跟下一步的 name 一模一樣）

# 3. .claude-plugin/marketplace.json 加一筆
#    { "name": "你的plugin名", "source": "./plugins/你的plugin名",
#      "description": "...", "category": "..." }

# 4. managed-settings.json 的 enabledPlugins 加一行
#    "你的plugin名@branch8": true

python3 scripts/validate.py
```

然後開 PR。合併後全公司自動拿到。

## 複製後一定要改的

| 檔案 | 要改什麼 |
|---|---|
| `.claude-plugin/plugin.json` | `name`、`displayName`、`version`、`description`、`keywords` |
| `skills/example-skill/` | 資料夾改名，`SKILL.md` 的 `name` 要跟資料夾同名 |
| `skills/*/SKILL.md` | `description` 全部重寫（見下節，這是最重要的一欄） |
| `commands/example-command.md` | 檔名改成實際的指令名，`description` 重寫 |
| `.mcp.json.example` | 不需要 MCP 就**刪掉**；需要就改名為 `.mcp.json` |

用不到的元件整個刪掉即可——plugin 不需要同時有 skill、command 和 MCP。

## `description` 怎麼寫（決定 skill 會不會被觸發）

Claude 在決定要不要載入一個 skill 時，**只看得到 `description` 這一行**。寫不好的話
skill 永遠不會被叫起來，而你會以為是 plugin 沒裝好。

寫法：**先說它做什麼，再列出應該觸發它的具體情境，包含使用者實際會打的字。**

```yaml
# ❌ 太籠統，永遠不會觸發
description: Helps with code review.

# ✅ 有明確的觸發條件與實際用語
description: Review a pull request against our internal engineering conventions
  and produce comments using our severity rubric. Use this whenever the user asks
  to review a PR, review a diff, look over changes before merging, or asks "does
  this look OK to ship" - even if they do not say the word "review".
```

如果團隊會用中文下指令，**把中文的觸發語也寫進去**（本 repo 的 `contract-review`
就是這樣做的）——描述裡沒有的說法不會觸發。

## `validate.py` 會擋你的三件事

| 錯誤 | 原因 |
|---|---|
| `plugin.json name 'x' does not match marketplace entry 'y'` | 兩處的 name 必須完全一致。slug 一旦發布就不能改名，改了會讓所有已安裝的人壞掉 |
| `name must be lowercase words separated by hyphens` | 只能小寫字母、數字、連字號，64 字以內 |
| `version 'x' is not semver` | 必須是 `x.y.z` |

## 最容易犯、而且不會報錯的那個

**版本號沒 bump 就不會發送。**

後台判斷要不要同步是看 `version` 有沒有變，不是看你改了哪些檔案。改了內容但沒動版本號，
PR 會安靜地合併，然後什麼都不會發生——你以為部署了，其實沒有。

CI 的 `check_version_bump.py` 會自動幫忙補，但手動操作時要自己記得。
