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
