# Handoff: site is live, next step is improvements

Date: 2026-10-15. Read `DECISIONS.md` (source of truth for behaviour) and `docs/ARCHITECTURE.md` first.

## State
- **Live**: https://monolabprintstudio.cl (and www). Coolify app `monolab-print-studio`, Nixpacks, auto from GitHub `main`
  (repo ddespinoza/monolab-print-studio). Cloudflare proxied, SSL Full (strict), Email Routing `contacto@` -> operator Gmail.
- **Email works end to end**: SMTP login OK, Gmail "Send mail as contacto@" alias verified, test mails delivered with
  sender `contacto@monolabprintstudio.cl`. `SMTP_PASS` (Gmail app password) is set in Coolify and local `.env` only.
- **Verified**: 224 unit tests, 4 Playwright smoke tests, lint, tsc, build, `npm run check:rules`, `setup:check`, `test:live` all pass.
- **Not yet done**: real order on the live site (receipt, Cotizado email with link, confirm page, Estado -> Confirmado);
  ~90 MB upload through Cloudflare; real pickup address/schedule in the sheet Config tab (RETIRO_DIRECCION / RETIRO_HORARIO are
  placeholders and show on the site and in the "Listo" email); final DoD walkthrough.

## How to work
- Node 24: `. ~/.nvm/nvm.sh`. Dev uses `MOCK_APIS=true` (files in `data/mock`). Live scripts need `MOCK_APIS=false`.
- Deploy: push to `main`, then Coolify `POST /api/v1/deploy` (token and ids are in `.secrets/`, gitignored). Never print secrets.
- Push uses the deploy key in `.deploy/` (gitignored, `core.sshCommand` already set).
- Rules that must keep passing: no Gmail address in customer-facing files, no hex colours outside `src/styles/tokens.css`
  (`npm run check:rules`), formal "usted" Spanish, light theme only, patient initials only (never in subject lines).
- **Shared VPS**: never kill processes by name/pattern (another site's container shows up in host `ps`). Only stop PIDs you started.
  Do not touch other projects or the Traefik/Coolify config.

## Open cleanup (owner)
Change the Gmail account password; rotate the Coolify API token; replace the Google service-account key and delete the Drive copy;
delete the Cloudflare token (expires 2026-10-22); revoke the temporary Gmail permission of the OAuth app.

## Next: website improvements
The owner wants to improve the website. Ask what they want, then follow the normal flow: mockup for visible changes if they ask,
tests first for logic, `npm run lint && npx tsc --noEmit && npm test && npm run check:rules`, push, deploy, check live.
