# Decisions

ADR-lite: context, decision, consequence. Owner Q&A from each checkpoint is recorded verbatim.

## Checkpoint 1: Phase 0 stack review (2026-10-15)

| Question                     | Options offered                                                | Owner's choice                                                                           |
| ---------------------------- | -------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Drive auth                   | OAuth refresh token / Shared Drive + SA / OAuth for everything | OAuth refresh token (Sheets stays on the service account)                                |
| Inbound mail for contacto@   | Cloudflare Email Routing / Postfix / both                      | Cloudflare Email Routing (reverses spec 2a and 9b)                                       |
| Estado "Enviado"             | Reword / remove / keep                                         | Removed: 6 states                                                                        |
| Location and Node            | ~/monolab with Node 22 / Node 20 / other                       | /root/monolab; owner installed Node 24 (googleapis and license-checker need >=22 / >=24) |
| Phase 0 stack and deviations | Approve / keep TS 5 / change                                   | Approve all                                                                              |
| GitHub repo                  | Private / public / local only                                  | Private `ddespinoza/monolab-print-studio`                                                |

Isolation: the VPS is shared with Docker-proxied projects holding ports 80/443/8080/8000/6001/6002. The app binds 127.0.0.1:3100 only and everything lives in this folder.

## Versions verified (npm registry, 2026-10-15)

next 16.4.1, react 19.x, tailwindcss 4 (CSS-first `@theme`), three 0.186.1 (`three/addons/...`), googleapis 186, nodemailer 10.1.1, zod 4.6, vitest 5, playwright 1.64, sharp 0.35. create-next-app selected TypeScript 5, so TS 7 is not used.
Docs: Drive service accounts have no storage quota (developers.google.com/drive/api/guides/about-shareddrives); Cloudflare Email Routing adds MX + SPF + DKIM (developers.cloudflare.com/email-routing). SPF must be ONE merged record.

## Known issues

- `npm audit` reports high-severity `braces` via eslint-config-next (dev-only lint tooling). `audit fix --force` would downgrade to Next 14 config; not applied. Revisit when upstream updates.

## Light theme only (owner, 2026-10-15)

Decision: the site uses the light palette only; no `prefers-color-scheme: dark` styles, `color-scheme: light` is set in globals.css. Consequence: the dark prussian-blue sections (hero, footer) are still part of the light design as brand contrast bands.

## Phase 3 integration decisions (2026-10-15)

- **Drive upload is streaming multipart, not resumable.** Docs: developers.google.com/workspace/drive/api/guides/manage-uploads (googleapis 186.0.0). The Node client sends `multipart/related` for a stream `media` body; a failed upload is retried from the start (fresh stream per attempt). Resumable would need hand-written session handling for little gain at 95 MB. Revisit if uploads fail on slow links.
- **Retry:** "exactly one retry" in the spec conflicted with its two delays (500 ms, 2 s). Implemented as up to 2 retries with those delays, transient errors only (429, 5xx, network codes).
- **Cron writes per row**, not batched: the mail is sent, then that row is marked. This keeps the duplicate window to a single email if a write fails. Overlapping ticks throw "already running".
- **Cron reads the whole Pedidos range** (`A2:S`), not "last 500 rows", so no order can fall outside the window.
- **Sheets writes use `valueInputOption=RAW`** plus an apostrophe prefix for risky leading characters (= + - @), tested in order-row.
- **Plantillas rows hold subject and message only.** The standard footer (Atentamente...) is always appended at send time, so operators cannot delete it by accident.
- **Sheet API**: `updates.updatedRange` of values.append is parsed for the row link (developers.google.com/workspace/sheets/api/reference/rest/v4/spreadsheets.values/append).

## Checkpoint 2 (pre-mockups): prototype comparison (2026-10-15)

Source: the owner's first prototype, a Google Apps Script web app (resin printing, one-screen viewer and form). The owner also supplied the real logo (saved verbatim as `brand/logo-source.svg`; it contains the Gmail address on an email plate that every derivative strips; the prototype's own header leaks it).

| Question      | Options offered                                                 | Owner's choice                                                                                                                                                                                     |
| ------------- | --------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Technology    | Resin only / resin + FDM / FDM only                             | **Resin only** (Anycubic Photon Mono 4 Ultra, build volume 153.4 x 77.0 x 165.0 mm; types Estándar, Tough, extensible in Config). Drops relleno, color, PLA/PETG; supersedes spec 5 print options. |
| 3D tools      | build-volume check / + scale and auto-fit / everything          | **Everything from the prototype**: build plate, auto-fit, scale slider and presets, 90° rotation, view presets (iso/top/front/side), wireframe, simple and advanced modes, multi-model view.       |
| Layout        | landing + split #pedido / app screen / landing stacked          | **Landing sections, split layout (viewer left, form right) in #pedido.**                                                                                                                           |
| Quote step    | link / link with decline / email parsing                        | **Unique signed link in the email**; click updates the sheet automatically (no inbox parsing).                                                                                                     |
| Quote price   | Cotización column / in template / none                          | **Operator types it in a "Cotización" column**; the site never computes prices.                                                                                                                    |
| After confirm | Confirmado then En cola / straight to En cola / separate column | **Estado becomes "Confirmado"**; the operator moves it to En cola.                                                                                                                                 |

Consequences (to implement after mockup approval, tests first):

- States become Nuevo, Cotizado, Confirmado, En cola, Imprimiendo, Listo, Entregado, Cancelado (Enviado stays removed). Cotizado and Confirmado get templates; Cotizado carries the price text and the confirm link.
- Pedidos gets a "Cotización" column; Material column holds the resin type; Ciudad, Color and Relleno are dropped (confirm the exact schema at checkpoint 3).
- New public route `/confirmar/[token]`: GET renders a page with a button, POST does the confirmation. Confirmation needs a POST because mail scanners prefetch GET links. Token = HMAC-SHA256(orderId + Cotización text) with a new `CONFIRM_SECRET`, so editing the quote invalidates the old link. It is valid only while Estado is Cotizado. On success: Estado = Confirmado, "Estado notificado" = Confirmado, customer receives the Confirmado email, operator is notified. This relaxes spec 15 ("no public status pages"): the page shows no order data beyond the ID and the quote text.
- Client metrics now include the applied scale %; submitted volume and size are the scaled values, and the sheet stores the scale per file. The server still trusts them (documented trust boundary).
- Tone stays formal (usted), per spec 3c, replacing the prototype's informal "tú".
- Open point for mockup review: the prototype had no Ciudad field; mockups drop it (pickup only).

## Checkpoint 2b: dental service details (2026-10-15)

Context: the service is resin printing for dentists (odontólogos). Owner's mockup feedback approved the "Solicitar cotización" CTA, formal usted tone and the header; it did not approve the removal of Ciudad/Color/Relleno, which was then asked explicitly.

| Question               | Options offered                               | Owner's choice                                                                                                                                                                  |
| ---------------------- | --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Extra fields           | (free text)                                   | **Nombre del paciente** (new, later reduced to initials) next to the requester's name (the dentist), and **Tiempo de entrega**: Flash (2 días) 10.000 CLP, or 7 días 7.500 CLP. |
| Delivery prices        | per file / per order flat / no prices on site | **Flat fee per order.** Shown as information; the site still never computes the quote. Sheet stores the chosen option and fee.                                                  |
| File formats           | STL+OBJ+PLY / STL + attachments / both        | **STL, OBJ and PLY, all with 3D preview.** Supersedes spec 4 ("STL only") and the spec 15 "formats other than STL" exclusion.                                                   |
| Ciudad, Color, Relleno | drop all / keep Color / keep Ciudad+Color     | **Drop all three.**                                                                                                                                                             |
| Drive layout           | (free text)                                   | One folder per order, **named with the patient name** (e.g. `ML-0001 - Nombre Paciente`), inside DRIVE_FOLDER_ID.                                                               |

Consequences:

- Pedidos columns (to confirm at checkpoint 3): add Nombre del paciente and Tiempo de entrega (+ tarifa); remove Ciudad, Color, Relleno.
- Validation: loaders and filename rules extend to .stl/.obj/.ply; metrics run on each loader's non-indexed geometry (OBJ/PLY need de-indexing before computeMetrics).
- Drive folder name is built from the sanitised patient name (same filename sanitiser, no PII beyond what the owner asked for).
- Privacy flag for the owner: patient names are personal (health-adjacent) data. They will live in the sheet and in Drive folder names; recommendation is to keep the patient name OUT of customer emails and the notification subject lines, and to mention data handling in the site footer. Not decided yet; raise at checkpoint 3.

## Patient identity: initials only (owner, 2026-10-15)

Decision: the form asks for the patient's **initials** (2 to 8 characters: letters, dots and spaces), never the full name, to protect sensitive personal data. Supersedes the "patient name" wording in checkpoint 2b and settles most of its privacy flag.
Consequences: validation accepts only that pattern (tests first); the sheet column is "Iniciales paciente"; the Drive folder is `ML-0001 - A.P.`; emails and notifications may show the initials. The dentist's full name is still collected, because emails address them by name; revisit if the owner wants that reduced too.

## Data model after checkpoints 2 and 2b (implemented, tests first)

- **Pedidos columns A-T** (20): ID Pedido, Fecha, Estado, Odontólogo, Email, WhatsApp, Iniciales paciente, Entrega (Flash/Normal), Tarifa entrega (CLP), Archivos (Drive), Nº archivos, Volumen total, Detalle archivos (with `· escala N %` when not 100), Resina, Copias, Notas, **Cotización**, **Confirmado**, Estado notificado, Última notificación. To be confirmed by the owner at checkpoint 3.
- **8 states**: Nuevo, Cotizado, Confirmado, En cola, Imprimiendo, Listo, Entregado, Cancelado. Cron skips a Cotizado row whose Cotización cell is empty (counted as `skipped`) so a quote is never sent without a price.
- **Quote link**: `signConfirmToken` = HMAC-SHA256 of order id + quote text with `CONFIRM_SECRET` (>= 32 chars). `/confirmar/[token]` shows a button (POST confirms). `confirmOrder` writes Estado/Confirmado/notified marks in one `values.batchUpdate`, then emails the customer and the operator; a failed email never undoes the confirmation. Double clicks are guarded in-process.
- **New copy to approve at checkpoint 3**: the Cotizado and Confirmado email texts (not in the original appendix) were drafted in the same formal tone.
- **Coordinate convention** (viewer and build volume): STL axes as exported, Z up. Build volume 153.4 (X) x 77.0 (Y) x 165.0 (Z) mm; the prototype compared the Y extent against 165 (a Y-up assumption). Rotation buttons let the customer fix files exported in another orientation.
- WhatsApp number: +56 9 4862 3705 (`WHATSAPP_NUMBER=56948623705`).

## Next.js rendering mode (2026-10-15)

Context: create-next-app (Next 16.4.1) enabled `cacheComponents` and `partialPrefetching`, which forbid `export const dynamic`. Docs: node_modules/next/dist/docs/01-app/03-api-reference/04-functions/connection.md and 01-app/01-getting-started/08-caching.md.
Decision: both flags removed. The home page, `/confirmar/[token]` and the API routes are `force-dynamic`, and the sheet Config values are cached 5 minutes in the runtime instead.
Consequence: no partial prerendering; first paint waits for the (cached) Config read. Security headers added in next.config.ts (nosniff, frame deny, referrer policy, permissions policy, HSTS).

## Phase 5-8 implementation notes (2026-10-15)

- **Orders return 201 even if an email fails after the row is saved** (spec said 503 on any Google/SMTP failure). A 503 after the row exists would make the customer resubmit and create a duplicate. The failure is logged. Drive or Sheets failures before the row still return 503.
- **Blocking rules**: the submit button stays disabled while any file is reading or uploading, after a failed upload (retry or remove it), or when a model still exceeds the build volume at its scale. Files that failed to parse are ignored.
- **Honeypot** returns `201 {id: "ML-0000"}` and writes nothing.
- **tmp files** are stored as `data/tmp/<32-hex>.bin` (format-agnostic) and swept after 24 h by the tick.
- **Not yet done**: Plantillas/Config/Pedidos tab seeding script, `setup:sheet`, `setup:oauth`, `setup:check`, and the operator docs (Phase 7 tail and Phase 9).

## License audit (2026-10-15, `npm run license`, production dependencies)

Totals: MIT 48, Apache-2.0 15, BSD-3-Clause 3, ISC 2, MIT-0 1, 0BSD 1, plus the items below. Fonts: Inter (SIL OFL) is bundled at build by `next/font`; no font CDN at runtime. Dev-only tools (sharp for `npm run brand`, Playwright, Vitest) are outside the production set.

| Package                        | License                            | Why it is there                                                                                                                 | Status                                                                   |
| ------------------------------ | ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| `url-template`                 | "BSD*" (its package.json says BSD) | dependency of googleapis                                                                                                        | Treated as BSD-3-Clause: **no exception needed**                         |
| `monolab-print-studio`         | UNLICENSED                         | this private project                                                                                                            | Not a dependency                                                         |
| `@img/sharp-libvips-linux-x64` | LGPL-3.0-or-later                  | optional native dependency of `next` (image optimisation); dynamically linked prebuilt library, our code is not derived from it | **Exception, needs owner approval**                                      |
| `caniuse-lite`                 | CC-BY-4.0                          | browser-support data used at build time by Next's toolchain                                                                     | **Exception, needs owner approval** (attribution licence, data not code) |

If the owner declines the LGPL exception: set `images.unoptimized: true` and remove `sharp` from the install (`npm i --omit=optional`), which this app does not need because it serves only local SVG/PNG brand assets.

## Owner approvals (2026-10-15)

- **License exceptions approved**: `@img/sharp-libvips-linux-x64` (LGPL-3.0-or-later, optional dependency of `next`) and `caniuse-lite` (CC-BY-4.0, build-time data).
- **Deployment: Coolify** (Nixpacks, existing Traefik proxy). `nixpacks.toml` pins Node 24. Required in Coolify: `PORT=3000`, `HOST=0.0.0.0`, `NODE_ENV=production`, `MOCK_APIS=false` plus the secrets, a persistent volume at `/app/data`, a 5-minute scheduled task for the tick, and the domains. Production refuses to start without real credentials, so deployment waits for checkpoint 4.

## Coolify deployment (2026-10-15)

Created through the Coolify v4.4.6 REST API (no Coolify MCP was connected): project **Monolab Print Studio** (`temz6balhkt2zffr5ndhu6xj`), application `monolab-print-studio` (`je5meciuydwuwyxgrge4hwqb`), Nixpacks, port 3000, branch `main`, on server `localhost`. Nothing existing was modified.

- **Source access**: dedicated read-only GitHub deploy key (`coolify-readonly`); separate from the write key used for pushes from this VPS.
- **Environment**: 24 runtime variables with production-only `CRON_SECRET` and `CONFIRM_SECRET`; `NIXPACKS_NODE_VERSION=24` as a build variable (Coolify defaults it to 22).
- **Volume** `/app/data`; **scheduled task** `status-tick` every 5 minutes runs a Node `fetch` against `127.0.0.1:3000/api/cron/tick` with `CRON_SECRET` (first run logged `tick 200`).
- **Verified live over HTTP on the temporary sslip.io address**: home page renders with the live Config tab, tick answers 401 without the secret and `{"processed":0,...}` with it, security headers present, Node v24.10.0.
- **Pending**: attach the real domain (needs Cloudflare/DNS), set the real `SMTP_PASS` (currently a placeholder, so no email is sent), real pickup address in the Config tab, rotate the Coolify API token and the Google service-account key that were shared in chat.

## Cloudflare and domain go-live (2026-10-15)

Done through the Cloudflare API with a scoped, expiring token (DNS, Zone Settings, Cache Rules, Email Routing; limited to this zone). Zone `monolabprintstudio.cl` on the Free plan, nameservers delegated at NIC Chile.

- **DNS**: proxied `A @` and `A www` to the VPS; the onboarding placeholder `AAAA 100::` removed.
- **Old redirect**: the zone still had rules sending the bare domain to the Apps Script prototype (redirect plus a second rule). The owner removed them; they also blocked Let's Encrypt validation until removed. The prototype no longer serves the bare domain.
- **TLS**: origin certificate issued by Let's Encrypt through Coolify's Traefik (after the redirect was gone); Cloudflare SSL mode **Full (strict)**; Always Use HTTPS on.
- **Cache rule** `Bypass cache for API and confirm pages` (`/api/`, `/confirmar/`); verified `cache-control: no-store` and `cf-cache-status: DYNAMIC` on the tick.
- **Email Routing**: `contacto@monolabprintstudio.cl` forwards to the operator Gmail (destination already verified); MX, DKIM, a single merged SPF (`include:_spf.mx.cloudflare.net include:_spf.google.com`) and `_dmarc p=none`.
- **Verified live**: HTTPS on `monolabprintstudio.cl` and `www`, tick 401/200 behaviour, http to https redirect.
- **Not yet done**: Gmail "Send mail as contacto@" and the app password (until then the app's emails would not carry the public address, see below), real pickup address, rotate the shared tokens (Cloudflare expires 2026-10-22), a real end-to-end order and quote on the live site.

## Phase 2: phone field and representative details (2026-10-15)

- The order form asks for **Teléfono** instead of WhatsApp. The field is `telefono` in code, templates (`{{telefono}}`) and the sheet header (column F). Validation accepts Chilean numbers only: optional +56/56, then 9 digits starting 2-9. WhatsApp links (floating button, contact, emails) stay for now.
- The "Quiénes somos" section shows the representative's N° de Registro (727145) and RUN, supplied by the owner. The RUN is public on the site; remove it from `ABOUT.representative` in `src/lib/content.ts` if that changes.
- Existing live sheets keep the old "WhatsApp" header in F1 until renamed by hand (setup only writes headers into empty sheets); data is read by column position, so nothing breaks meanwhile.

## Phase 4a: send endpoint and manual/automatic switch (2026-10-15)

- **Switch**: Config key `ENVIO_AUTOMATICO` (SI/NO, default NO, accent and case insensitive). With NO the 5-minute tick sends nothing (it still sweeps tmp files and reports `automatic: false`). Deploying this code therefore turns off automatic status emails on the live site until the owner sets SI or uses the buttons.
- **Endpoint**: `POST /api/send`, bearer `SHEET_SECRET` (optional env, 16+ characters; unset or empty answers 503, so deploying without it is safe). Actions: `row` (orderId, optional `force`), `test` (preview to OPERATOR_EMAIL, subject prefixed `[PRUEBA]`, never marks the row) and `pending` (up to 50, one failure does not stop the rest). The orderId is the key, not the row number, because sorting the sheet moves rows.
- **Guards**: no template for Nuevo, no customer email, Cotizado without a Cotización text; an Estado already notified returns `already_sent` until `force` is sent. A failed sheet write-back after a successful send still reports `sent` with a warning, so the operator does not resend.
- **Log**: every attempt appends to the `Envíos` tab (date, order, Estado, recipient, Enviado/Falló, Botón/Prueba). A failed log write never fails the send.
- **One send job at a time**: the tick and the buttons share a lock; a second call answers 409 `busy`.
- **Sheet setup (run on the live sheet 2026-10-15)**: F1 renamed "WhatsApp" to "Teléfono", `Envíos` tab created, `ENVIO_AUTOMATICO=NO` added to Config. Not yet done: the Apps Script menu, `SHEET_SECRET` in Coolify and in Script Properties, deploy.

## Phase 4b-1 deployed and tested live (2026-10-15)

- Deployed commit `12e87ab`. `SHEET_SECRET` created (kept in `.secrets/sheet-secret`, set in Coolify as a runtime variable). The live site is in manual mode: the tick answers `automatic:false`.
- Live test with order ML-0002 (row 3, sent to OPERATOR_EMAIL, left as Cancelado): refusal of Cotizado without a quote, preview (`[PRUEBA]`), real quote send, `already_sent` on repeat, unknown order refused, `Listo` through `pending`, empty second `pending`. Row marks (S:T) and the Envíos log matched each step.
- Not tested live: the Apps Script itself (menu, checkbox) and the customer clicking the confirm link.
- Known issue: values starting with + = - @ are written RAW with a leading apostrophe, which Sheets shows literally (e.g. `'+56 9 ...` in Teléfono). RAW already prevents formula evaluation, so the apostrophe is unnecessary there.

**Correction (2026-10-15):** the apostrophe prefix from "Phase 3 integration decisions" was removed. Sheets writes use `valueInputOption=RAW`, which stores text as-is and never evaluates it, so the prefix was unnecessary; under RAW it is stored literally and showed as `'+56 9 ...` in Teléfono and leaked into emails built from sheet values. Order text is now stored unchanged (tested in order-row).
