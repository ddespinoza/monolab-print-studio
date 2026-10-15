# Handoff: site is live, improvements in progress

Date: 2026-10-15. Read `DECISIONS.md` (source of truth for behaviour) and `docs/ARCHITECTURE.md` first.

## State

- **Live**: https://monolabprintstudio.cl (and www). Coolify app `monolab-print-studio`, Nixpacks, auto from GitHub `main`
  (repo ddespinoza/monolab-print-studio). Cloudflare proxied, SSL Full (strict), Email Routing `contacto@` -> operator Gmail.
- **Email works end to end**: SMTP login OK, Gmail "Send mail as contacto@" alias verified, test mails delivered with
  sender `contacto@monolabprintstudio.cl`. `SMTP_PASS` (Gmail app password) is set in Coolify and local `.env` only.
- **Verified**: 224 unit tests, 4 Playwright smoke tests, lint, tsc, build, `npm run check:rules`, `setup:check`, `test:live` all pass.
- **Not yet done**: real order on the live site (receipt, Cotizado email with link, confirm page, Estado -> Confirmado);
  ~90 MB upload through Cloudflare; final DoD walkthrough.

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

## Improvements done so far (2026-10-15)

Plan and status per phase: `docs/IMPROVEMENT-PLAN.md`; every decision: `DECISIONS.md`. Operator guide: `docs/OPERADOR-es.md`.

- **Live and deployed**: dental hero with hexagon pattern, "Quiénes somos" with the representative's photo, Teléfono field (Chilean format) instead of WhatsApp, mobile pass, viewer loading screen, branded HTML emails, restyled /confirmar page, FAQ entry on file storage, contact email button.
- **Sheet control**: `POST /api/send` (actions `row`, `pending`, `test`, `purge`), Config `ENVIO_AUTOMATICO` (live value NO = manual), `Envíos` log tab, `Enviar` checkbox column U. Apps Script source: `docs/apps-script/Monolab.gs` (the owner pastes it into the ORDERS sheet; re-paste after changes). `SHEET_SECRET` is in `.secrets/sheet-secret` and Coolify.
- **File retention**: deleting an order's Drive folder is a manual operator step (menu "Eliminar archivos del pedido"), because the site promises deletion after the order.
- **Phase 5 (SEO and performance)**: committed and pushed; see the last section of DECISIONS.md. Check whether it was deployed before assuming it is live.

## Still open (owner decisions)

- Pickup schedule is decided: by appointment only (live in Config). Address (Río Guadiana 8672, Las Condes) and phone (+56 9 4862 3705) are decided and live.
- Payment step (Pagado state, transfer-details email, ledger) and resin stock tab from the prototype sheet: not decided.
- Optional: automatic deletion of order files N days after delivery; turning off Cloudflare JS Detections / Web Analytics to improve live Lighthouse scores.
- Not yet tested live: the Apps Script itself (menu and checkbox) and a customer clicking the real confirm link.
- Owner cleanup list above still applies (rotate tokens, replace the service-account key).

## Working notes

Node 24 (`. ~/.nvm/nvm.sh`). Before any push: `npm run lint && npx tsc --noEmit && npm test && npm run check:rules`, and `npx playwright test` for UI changes. Deploy = push to main, then Coolify `POST /api/v1/deploy?uuid=<app uuid>` (local API on 127.0.0.1:8000, token in `.secrets/coolify-token`).
