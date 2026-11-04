---
name: prd-without-scenarios
max_turns: 15
allowed_tools: [Read, Glob, Grep, Skill]
---

# PRD：訂單可分批出貨

背景：部分商品缺貨時整張訂單卡住，客服常接到詢問。
需求：訂單中有現貨的商品先出貨，缺貨的等到貨後再出。運費只收一次。
客人要能在訂單頁看到每一批的出貨狀態。後台要能手動合併或拆分批次。

我們在用 rd-before-coding 走這張單。第一段的整理我確認過了，沒有要補充。接下來做第二段的需求健檢。
