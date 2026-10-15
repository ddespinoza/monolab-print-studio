#!/usr/bin/env bash
# Grep-verifiable rules: no operator Gmail address in anything served or customer-facing, and no hex
# colours outside the token definitions, the email hex map and the generated brand assets.
set -u
fail=0
if grep -rIl "gmail.com" public docs/mockups src/app src/components src/lib/templates.ts src/lib/content.ts 2>/dev/null ; then
  echo "FAIL: gmail address found in a customer-facing path"; fail=1
fi
if grep -rInE '#[0-9a-fA-F]{3,8}\b' src docs/mockups --include='*.ts' --include='*.tsx' --include='*.css' --include='*.html' \
  | grep -v 'src/styles/tokens.css' | grep -v 'src/lib/templates.ts' | grep -v 'src/lib/.*&#' | grep -vE '&#[0-9]+;'; then
  echo "FAIL: hex colour literal outside tokens.css and the email hex map"; fail=1
fi
[ "$fail" = 0 ] && echo "OK: brand rules hold"
exit "$fail"
