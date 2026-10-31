#!/usr/bin/env bash
# A tiny fictional code repo, so the skill's "only in a code repository" holds.
set -e
git init -q
mkdir -p src
printf '{"name": "demo-shop", "version": "1.0.0"}\n' > package.json
printf 'export function cartTotal(items) {\n  return items.reduce((s, i) => s + i.price * i.qty, 0)\n}\n' > src/cart.js
printf '<button id="checkout">送出</button>\n' > src/checkout.html
git add -A
git -c user.name=demo -c user.email=demo@example.com commit -q -m init
