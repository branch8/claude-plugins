# 首次上線 checklist

照順序做，每格打勾。預計 40 分鐘。

## 1. Repo 準備

- [ ] repo 建在 **GitHub organization** 底下（不是個人帳號），可見性設 **private**
- [ ] 把這份骨架推上去
- [x] `vendor.lock.json` 的 `ref` 已填真實 SHA（ui-ux-pro-max @ 4857a2c5，v2.11.0）
- [x] `marketplace.json` 的 `name` 已設為 `branch8`
- [ ] `CODEOWNERS`：`@Branch8/platform-team` 與 `@Branch8/security` **必須先在 GitHub 上建出來**
      → 團隊不存在時 GitHub 不會報錯，而是整條規則靜默失效
- [ ] 決定 `plugins/internal-review` 要留著改還是刪掉（目前未列入 marketplace.json，不會發送）

## 2. 第一次 vendoring

```bash
python3 scripts/vendor.py
python3 scripts/validate.py
```

- [x] `vendor/ui-ux-pro-max/.claude-plugin/plugin.json` 已確認存在（v2.11.0, MIT）
- [x] `validate.py` 通過（0 error 0 warning）
- [ ] 提交（`vendor/` 一定要進版控，不能 gitignore）

## 3. GitHub 設定

- [ ] Settings › Actions › General › Workflow permissions
      → **Read and write permissions**
      → 勾 **Allow GitHub Actions to create and approve pull requests**
- [ ] 建 label：`vendor`、`automation-failure`
- [ ] Settings › Branches → 預設分支加保護：要求 PR、要求 Code Owner 審查
- [ ] 手動跑一次 Actions › vendor-update › Run workflow，確認不會爆

## 4. chat / Cowork

- [ ] 組織已啟用 Code execution and file creation、Skills、Cowork
- [ ] Claude GitHub App 裝在 **organization** 層級，且涵蓋這個 repo
- [ ] Organization settings › Plugins → Add plugin → GitHub → 填 `owner/repo`
- [ ] 開啟 **Sync automatically**
- [ ] 每個 plugin 選安裝偏好 → **Required**（自動裝並啟用、同事不能移除）
      這一步就是「自動會安裝」的開關。這七個是團隊必要工具，不是選配。
      | 選項 | 自動裝 | 同事可移除 | |
      |---|---|---|---|
      | **Required** | ✅ | ❌ | ← 選這個 |
      | Installed by default | ✅ | ✅ | 選配工具才用 |
      | Available for install | ❌ | — | 等於沒發 |
      | Not available | ❌ | — | 隱藏 |
      註：目前 chat 這一側只會看到 `ui-ux-pro-max`，因為組織 marketplace 只服務
      本 repo 的內容，那 6 個官方 plugin 不在 repo 裡（見 CLAUDE.md「未確認的事」）
- [ ] 用另一個帳號確認真的收到了

## 5. Claude Code

- [ ] Admin Settings › Claude Code › Managed settings 貼上 `managed-settings.json` 的內容
- [ ] `branch8` 三處名字一致（marketplace.json、managed-settings.json ×2）
- [ ] 在一台測試機驗證：是否真的自動安裝，還是需要手動 `/plugin install`

**這一側的「自動安裝」不需要額外設定。** `enabledPlugins` 裡的 `true` 本身就是
「自動裝並啟用」的意思，而且因為它來自 managed scope，優先權高於個人設定——
同事那邊會顯示為 managed 且無法關掉。七個都已經是 `true`。

唯一擋在中間的是**資料夾信任確認**：Claude Code 第一次會問一次才裝。這是刻意的
（plugin 可以在本機執行程式碼），repo 這邊沒辦法也不應該繞過。

## 6. 收尾

- [ ] 合併一個小改動，確認同步真的會跑（這同時驗證 webhook 正常）
- [ ] 通知團隊：公司提供哪些、從哪個來源、可以自己裝別的
- [ ] 請大家清掉重複安裝的 plugin
- [ ] 把「重新開關一次自動同步」寫進離職 checklist
- [ ] `CLAUDE.md` 底部的待辦清單刪掉已完成項目

## 之後

每週一早上收 PR。沒更新就不會有 PR。
