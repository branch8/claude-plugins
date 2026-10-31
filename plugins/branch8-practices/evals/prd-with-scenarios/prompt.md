---
name: prd-with-scenarios
max_turns: 15
allowed_tools: [Read, Glob, Grep, Skill]
---

# PRD：會員點數折抵

背景：會員反映點數很難用完，想在結帳時直接用點數折抵。

使用者情境：
1. Given 會員有 500 點，When 結帳時勾選「使用點數」，Then 每 100 點折抵 10 元，訂單金額相應減少。
2. Given 會員點數不足 100 點，When 進入結帳頁，Then 「使用點數」選項顯示為不可勾選並提示原因。
3. Given 訂單已用點數折抵，When 會員取消訂單，Then 點數退回會員帳戶。

這張單分給我了，幫我做這個功能。
