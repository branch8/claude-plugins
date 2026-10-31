#!/usr/bin/env bash
# A tiny fictional code repo, so the skill's "only in a code repository" holds.
set -e
git init -q
mkdir -p src
printf '{"name": "demo-shop", "version": "1.0.0"}\n' > package.json
printf 'export function cartTotal(items) {\n  return items.reduce((s, i) => s + i.price * i.qty, 0)\n}\n' > src/cart.js
printf '<button id="checkout">送出</button>\n' > src/checkout.html
mkdir -p docs/features
cat > docs/features/DEMO-12-coupon-stacking.md <<'MD'
# DEMO-12 優惠券疊加

Status: waiting-for-pm
Source: DEMO-12

## Purpose
- RD 的版本：讓會員在一張訂單同時使用多張優惠券，提高大額訂單轉換。
- Claude 的補充與差異：PRD 沒說疊加上限與順序，RD 版本也沒提。

## Scenarios
| # | Given / When / Then | From | PM confirmed |
|---|---|---|---|
| 1 | Given 會員有兩張滿千折百券，When 訂單 2000 元，Then 兩張都可套用 | PRD | 否 |
| 2 | Given 已套用折扣券，When 再加免運券，Then 兩者並存 | PRD | 否 |

## Issues found
| # | Type | Found by | PM answer or assumption |
|---|---|---|---|
| 1 | gap：折扣券與免運券能否疊加 | RD | 待 PM 回覆（問題 1） |
| 2 | gap：一張訂單最多幾張券 | Claude | 待 PM 回覆（問題 2） |

## Solution

## Collaboration
- Claude proposed: 疊加上限問題。
- RD thought / decided: 「先問清楚上限再設計資料結構。」
MD
git add -A
git -c user.name=demo -c user.email=demo@example.com commit -q -m init
