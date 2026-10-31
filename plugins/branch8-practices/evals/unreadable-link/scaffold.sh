#!/usr/bin/env bash
# A tiny fictional code repo, so the skill's "only in a code repository" holds.
set -e
git init -q
mkdir -p src
printf '{"name": "demo-shop", "version": "1.0.0"}\n' > package.json
printf 'export function cartTotal(items) {\n  return items.reduce((s, i) => s + i.price * i.qty, 0)\n}\n' > src/cart.js
printf '<button id="checkout">送出</button>\n' > src/checkout.html
# A ticket whose PRD lives only behind a link and an attachment that is not here.
cat > ticket.md <<'MD'
# DEMO-31 會員等級制度

PM：請依 PRD 實作會員等級（銅、銀、金），升降級規則與各等級權益都寫在 PRD 裡。
PRD：https://docs.google.com/document/d/FAKE-DEMO-ID/edit
附件：PRD-v2.pdf
MD
git add -A
git -c user.name=demo -c user.email=demo@example.com commit -q -m init
