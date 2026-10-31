# branch8-practices / rd-before-coding：RD 拿到需求後的標準 AI 協作流程（設計）

日期：2026-10-30 ・ 狀態：設計待核可

## 為什麼要做

目的是拉高全公司 RD 用 AI 開發的**底線**，不是處理某一次事故。

現在常見的做法是：拿到 PRD 或 Jira 單，就交給 AI 一路做完。速度不是問題，問題在於沒有人在動手前停下來想。
結果漏洞到測試、上線甚至更久之後才浮現，例如需求本身缺漏或互相矛盾、解法方向錯誤、架構沒有彈性。
更根本的問題是，**做完之後 RD 什麼都不知道**：說不出需求要解決什麼，也說不出為什麼這樣做。

這套流程在「拿到需求」和「開始寫 code」之間，插入一段 RD 與 AI 的協作。
AI 在這裡是 **pair programming 的夥伴**，不是代工，也不是家教。雙方都可以提出想法、指出問題、動手做，
但**方向和決定由 RD 掌握**，而且每一步 RD 都要在場、跟得上。學習是在這個過程中自然發生的。

## 成功的樣子

流程結束時，RD 說得出：這個需求要解決什麼、AI 幫了哪些忙、自己想了什麼、決定了什麼、為什麼這樣決定。
這些內容會留成紀錄，讓 PM、RD 主管、接手的 RD、QA 日後要了解陌生功能、做延伸修改或查 bug 時都看得到。

## 目標 / 非目標 / 反目標

**目標**
- RD 在寫 code 前檢視需求，找出缺漏、衝突、做不到、應該改變做法的地方，並回頭跟 PM 確認。
- RD 自己構思解法並做決定，AI 負責提出選項、挑戰 RD 的想法。
- 留下紀錄：完整版放 repo，Jira 單上放摘要和連結。

**非目標（這一期不做）**
- PM 端的流程。PM 寫 PRD 要用 `prd-writer`（使用者自己的 plugin，`GlennCheng-prd-writer`，
  模板已經包含 Given/When/Then 驗收情境）。把它發給 PM 是下一個專案，這一期的 RD 流程要做到 PRD 有沒有附情境都能用。
- 不強制執行：不用 hook 擋住寫 code，不檢查有沒有走流程。
- 不取代 code review。

**反目標（就算技術上做到也算失敗）**
- 流程變成填表儀式：RD 照著格子填完，但其實沒有想過。
- AI 自己把紀錄寫完，RD 只按「好」。紀錄裡「RD 想了什麼」那欄必須來自 RD 本人說的話。
- 流程太重，RD 寧可繞過去不用。
- 小改動（改按鈕文字、調整欄位上限）也被要求走一遍。

## 流程

### 入口與規模判斷

有兩種入口：
- RD 在 jira-mod 面板選了一張單，或在對話中給出 PRD／Jira 單號。
- RD 直接叫出 skill（`/branch8-practices:rd-before-coding`）。

AI 先判斷規模。牽涉新功能、多個使用情境、或有架構選擇時，主動**提議**走這套流程，RD 可以拒絕；
小改動就直接做，不提議。若 RD 主動叫出 skill，就不再判斷，直接開始。

### 第 1 段：讀懂需求（RD 先理解，AI 後解讀）

前提：RD 在面板選單時通常還沒看過內容，所以不能一開始就要 RD 說出需求在做什麼。
這一段要防止的，是 **RD 還沒自己理解，就先被 AI 的解讀定型**。

1. **AI 攤開原文，不加解讀**：把 Jira 描述、附件、連到的 PRD 整理成好讀的版本。PRD 很長時，
   只列出目錄和段落位置，讓 RD 知道該往哪裡看。AI 不說「我覺得這張單是要……」。
2. **RD 用自己的話說一遍**：要解決什麼、給誰用、怎樣算做完。說得不完整也沒關係。
3. **AI 補上自己的解讀，並指出和 RD 版本的差異**。差異就是討論的起點，常常也直接暴露 PRD 寫得不清楚的地方。

RD 可以說「直接講給我聽」來跳過第 2 步，紀錄裡會註明「此段由 AI 先解讀」。

### 第 2 段：檢視需求（BDD）

以情境為單位檢視需求：「在某狀況下，使用者做了某件事，應該看到某個結果」。
- PRD 已經有情境（例如 `prd-writer` 產出的 Given/When/Then）：逐條檢查。
- PRD 沒有情境：RD 和 AI 一起把情境補出來，並標註「RD 補寫，待 PM 確認」。

先問 RD 一句：看完情境，你覺得哪裡怪、哪裡擔心？RD 說完後，AI 再逐條掃描。
每條情境都檢查四件事：有沒有缺漏（edge case、錯誤路徑、權限）、和其他情境或既有功能是否衝突、
技術上做不做得到、有沒有更好的達成方式。逐條掃描這種機械性的工作交給 AI 做，RD 只需要對 AI 找到的每個問題下判斷，
不用自己一條一條檢查（*我的判斷：情境一多，RD 自己逐條檢查太重，會踩到「流程太重」這個反目標*）。
判斷的依據始終是第 1 段確認的「要達成的目的」，不是逐字照抄 PRD。

接著用 **grilling** 對需求逐輪追問，直到沒有懸而未決的問題。

產出一份「要問 PM 的問題」清單。AI 草擬成 Jira 留言，**RD 確認後才送出**。
流程停在這裡等 PM 回覆，這時紀錄的狀態是「待 PM 回覆」。PM 回覆後，RD 可以在任何 session 叫出 skill，從紀錄接續。
如果問題不影響解法方向，RD 可以決定先往下走，紀錄裡要標明哪些地方是「假設」。

### 第 3 段：構思解法

1. 先問 RD 傾向哪種做法，或者還沒有方向。
2. **brainstorming**（每次都叫用，使用者 2026-10-30 決定：RD 有時不知道怎麼解，或者想到的解法不夠好）：
   展開 2–3 個做法，每個都列出取捨，包括複雜度、彈性、風險，以及和既有架構是否相容。
3. RD 選定其中一個做法。
4. **grilling ＋ domain-modeling**：對 RD 的選擇施壓，用具體情境檢驗設計，並拿 code 比對 RD 的說法。
   真正需要取捨、而且難以回頭的決定，寫成 ADR。

每個決策點，AI 都停下來交給 RD。

### 第 4 段：收尾

- 寫完紀錄（格式見下）。
- 草擬 Jira 摘要留言，附上紀錄連結，RD 確認後才送出。
- 情境清單送 PM 確認。這可以和摘要放在同一則留言，也可以分開，由 builder 決定。
- 交棒：接著交給 `superpowers:writing-plans`；如果 brainstorming 判斷這只是小改動，就直接實作。專案有測試框架時，把情境當作測試清單，交給 TDD 處理。

## pair 的規則（貫穿全程）

- **RD 先想，AI 後補**：只用在關鍵點，不是每一題都要。關鍵點包括：第 1 段「要解決什麼」、第 2 段「哪裡怪」、
  第 3 段「傾向哪個做法」，以及 grilling 每一輪的提問。其他小問題 AI 可以直接給建議。RD 隨時可以說「你先講」。
  （*我的判斷：每一題都要 RD 先答，流程會太慢*）
- 決策點一定停下來，交給 RD 拍板，AI 不代為決定。
- AI 動手做了任何事，都要說明做了什麼、為什麼這樣做。
- 紀錄裡「AI 提出的」和「RD 想的、決定的」分開寫。

## 與既有 skill 的銜接（調整點）

借用的 skill 有些預設行為和上面的規則衝突，rd-before-coding 必須明確覆寫：

| skill | 預設行為 | 在 rd-before-coding 裡的調整 |
|---|---|---|
| `mattpocock-skills:grilling` | 每題都附 AI 的建議答案，回答「yes」即採用 | 先讓 RD 作答，RD 答完或主動要求時才給 AI 的建議（*我的判斷，依據「RD 先想」*） |
| `superpowers:brainstorming` | 另外寫一份 spec 到 `docs/superpowers/specs/`；技術上的小決定由 AI 自己定（"Settle it yourself and mark it … as your call"）；結束時強制交給 writing-plans | 每次都叫用。叫用前先交出第 1、2 段的結論，讓它跳過「你想做什麼」的開場。spec 直接寫進本流程紀錄的「解法」段（brainstorming 本身允許："Your human partner's preferences override both"）。它交出的「我替你做的決定」清單，由 RD 逐條確認，確認結果記進紀錄。**順序衝突**：brainstorming 規定文件一旦核可，下一步只能是 writing-plans，但 rd-before-coding 在那之後還有「RD 選定方案」和「grilling 施壓」兩步。因此 rd-before-coding 要明確說明：brainstorming 寫出的「解法」段，要等 grilling 結束後才送 RD 核可，核可後才進入 writing-plans |
| `mattpocock-skills:domain-modeling` | 用情境檢驗設計、拿 code 比對說法、維護 GLOSSARY.md，並在必要時寫 ADR | 和 grilling 一起使用（等同 grill-with-docs），照它原本的方式運作；紀錄裡只放 ADR 的連結 |

註：`grill-with-docs`（也就是 grilling ＋ domain-modeling）設了 `disable-model-invocation`，AI 不能叫用，所以要分別叫用這兩個 skill。

這兩個 plugin（superpowers、mattpocock-skills）都已經在 `managed-settings.json` 的發送清單中（已確認）。

rd-before-coding 只負責「何時叫用、輸出寫到哪裡」，不複製它們的內容。若之後在某個 session 裡沒有安裝它們，就以 rd-before-coding 內建的簡化版問法代替，不能讓流程卡住。

## 紀錄格式

路徑：`docs/features/<JIRA-KEY>-<slug>.md`，沒有單號時用 `<YYYY-MM-DD>-<slug>`，和 code 一起 commit。
即使是客戶看得到、或之後要交付給客戶的 repo，也一樣放進去（使用者 2026-10-30 決定），所以紀錄要寫得專業。
這份紀錄同時也是流程狀態，接續時從這裡讀起。

```
# <KEY> <標題>
狀態：讀懂需求 / 檢視中 / 待 PM 回覆 / 解法構思 / 完成
來源：Jira 連結、PRD 連結

## 要達成的目的
RD 的版本 ／ AI 的補充與差異

## 情境
每條：Given/When/Then ・ 來源（PRD／RD 補寫）・ PM 確認狀態

## 發現的問題
每條：類型（缺漏/衝突/不可行/建議改做法）・ 誰發現（RD/AI）・ PM 回覆或目前假設

## 解法
考慮過的方案與取捨 ・ 選定的方案 ・ 理由（RD 的話）・ brainstorming 中 AI 代為決定、經 RD 確認的事項 ・ grilling 中被挑戰後修正的地方 ・ ADR 連結

## 協作紀錄
AI 提出了什麼 ／ RD 想了什麼、決定了什麼
```

Jira 留言要寫成**不點連結也能讀懂**的完整摘要，因為 PM 和 QA 大多打不開 GitHub（使用者 2026-10-30 確認）。
內容包括：目的、情境清單（含確認狀態）、主要決定與理由、待確認事項。repo 連結只是寫給 RD 看的補充。
第 2 段送給 PM 的問題也一樣，留言本身就要把問題的前因後果寫清楚。

## 形式與發送

- 新 plugin：`plugins/branch8-practices/`，代表「Branch8 的工作方式」，日後同類的規範都收進這個 plugin。
  這一期只有一個 skill：`rd-before-coding`。加入 `marketplace.json` 和 `managed-settings.json`。
- **命名規則**（使用者 2026-10-31 定案）：skill 名加角色前綴，例如 `rd-…`、`pm-…`，讓人一看就知道是誰的流程。
  不同階段拆成不同 skill，例如寫 code 中、寫完之後，不全部塞進同一個。曾考慮直接命名為 `coding`，但這個名稱太寬，
  所有寫 code 的任務都可能觸發它，而且名稱大於實際範圍，所以沒有採用。
- skill 本體用英文撰寫（與 jira-workflow 一致），和 RD 對話時用 RD 的語言。
  SKILL.md 保持精簡，各段的詳細步驟放在 `docs/` 中，需要時才讀（沿用 jira-check 的做法：注入的 context 太大會失效）。
- jira-mod：在 `pickNote` 裡加一句，提示 Claude 先判斷規模，必要時提議 rd-before-coding。這需要 bump mod 的版本號。
  mod 沒有安裝時，就靠 skill 的 description 自己觸發。
- 依循 repo 慣例：版本號、validate.py、README／CLAUDE.md 都要同步更新。

## 我的判斷（設計者決定，非使用者明示）

- **紀錄的接續**：在第 2 段結束、送 PM 問題之前，先把紀錄 commit 起來（branch 與 push 的規則見下方）。
  接續時先看目前的 branch；找不到，再用
  `git log --all -- 'docs/features/<KEY>-*'` 依單號找。不另外建本機索引。
- **與 jira-workflow 的分工**：狀態轉換一律交給 jira-workflow，rd-before-coding 不自己推薦轉換。
  分析需求本身就算開始工作，所以 jira-workflow 的 `start` 時機照常觸發。等 PM 回覆時不推薦任何轉換。
- **非 RD 選單**：pickNote 那一句只叫 Claude「若這裡是 code repo 的開發工作」才判斷規模。
  PM 在非 code 資料夾選單時不會收到提議。這由 Claude 判斷，mod 不另外讀取資料夾狀態。
- **「RD 想了什麼」這一欄**：AI 可以整理文字，但關鍵句要引用 RD 的原話。收尾時這一欄**逐條讓 RD 確認或修改**，
  不能整份一次按「好」通過。
- **eval 範圍**：skill-creator 的 eval 只驗證「會不會觸發」和「第一步行為」（攤開原文、不加解讀；小改動不觸發）。
  完整流程用真實的 Jira 單手動走一遍來驗證。

- **branch 與 push**：Jira 留言已經能單獨閱讀，PM 不需要看 repo，所以送 PM 問題前**只需 commit，不需 push**。
  push 照 RD 平常的工作流程進行。rd-before-coding 不會自己開 branch；只有當 RD 正在預設分支上時，才建議開一個帶單號的 branch。
- **上游變動**：superpowers 和 mattpocock-skills 走官方來源，Anthropic 更新時公司這邊沒有審查點（見 CLAUDE.md 決策 3）。
  rd-before-coding 的關鍵規則（RD 先想、只留一份文件、決策交給 RD）**寫在 rd-before-coding 自己的文字裡**，
  不依賴上游 skill 的某句話剛好還在。eval 會檢查這幾條是否仍然成立。
- **ADR**：如果 domain-modeling 寫了 ADR（`docs/adr/`），紀錄的「解法」段只放連結和一句摘要，不重抄。
  ADR 記錄跨功能、難以回頭的決定；本流程的紀錄記錄這張單的來龍去脈。
- **公開 repo**：本 repo 是 public，所以 skill 和 docs 裡的範例一律使用虛構的情境，不寫客戶名稱或專案名稱。
- **Jira 和紀錄的差異**：Jira 留言是送出當下的快照，repo 紀錄才會持續更新。兩者對不上時，以 repo 為準。

## 留給 builder 決定

- skill description 的觸發字詞要怎麼寫，才能在「選了單、給了 PRD」時觸發，但小改動時不觸發。
- 規模判斷的具體措辭。
- Jira 留言要不要 @PM（找人要用 `lookupJiraAccountId`）。
- 讀 PRD 附件或連結的方式（Jira 附件、Google Drive 連結等，依目前可用的 MCP 而定）。
- 有沒有測試框架的偵測方式。

## 驗證方式

- 用 `claude plugin eval`（`plugins/branch8-practices/evals/`）在本機跑五種情境：PRD 有情境、PRD 沒有情境、小改動（應該不觸發）、
  打不開的 PRD 連結（不能編造內容）、PM 回覆後從紀錄接續。eval 是付費的模型呼叫，所以不放進 CI。
- eval 的沙盒只會載入受測的 plugin（沒有 superpowers、mattpocock、Jira MCP），而且只有一輪對話，
  所以以下兩點要改用手動走一遍來驗證（2026-10-31 實作時確認）：
  - 用了 brainstorming 之後，流程仍然會先跑 grilling 才進 writing-plans；
  - spec 沒有另外寫到 `docs/superpowers/specs/`。
- 找一張真實的 Jira 單，從 jira-mod 面板選單開始走完整流程，確認紀錄內容和 Jira 留言都正確。
