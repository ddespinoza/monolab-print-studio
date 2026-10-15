# Monolab Print Studio — Greenfield build brief for Claude Code

You are a senior full-stack engineer. Build the complete project described below from scratch in an empty repository. Work INTERACTIVELY per §1a: at every checkpoint, ask the owner questions, present options with a recommendation, and get confirmation before proceeding. When blocked by a missing external credential, proceed in MOCK mode (§10), note it in DECISIONS.md, and keep asking.

## 1. Product

A 3D-printing order-intake website for "Monolab Print Studio" (single operator). Customers upload an STL file, preview it in 3D, fill in a one-page order form, and submit. The site must behave like a lightweight replacement for a Google Apps Script pipeline, but as a standalone web app:

1. Stores the STL file in a Google Drive folder.
2. Appends the order as a new row to the "Pedidos" tab of a Google Sheet that is the order queue and the single source of truth.
3. Sends an instant confirmation email to the customer and a notification email to monolabprintstudio@gmail.com.
4. A scheduled job polls the sheet: when the operator changes the row's Estado (status), the customer automatically receives a templated status email — the operator never leaves the spreadsheet.

Hard constraints:

- No database. The Google Sheet IS the database.
- No user accounts, no admin website of any kind. The spreadsheet is the ENTIRE operator panel, in three tabs: "Pedidos" (orders — every column operator-editable: customer email, WhatsApp, city, notes), "Plantillas" (email templates: one row per state — Asunto + Mensaje, operator-editable, §7/§8), and "Config" (key/value: retiro address, schedule). Every operator change happens in the sheet — nothing else will ever be built for management.
- UI copy: Spanish (Latin American, friendly-professional). Code, identifiers, comments, commits, docs: English.
- 1–10 STL files per order. Order-level material/color/infill applies to every file in the order.
- Public email identity: contacto@monolabprintstudio.cl masks monolabprintstudio@gmail.com. Inbound mail is received by forward-only Postfix on the VPS and delivered to the Gmail inbox; outbound site mail is sent via Gmail SMTP as contacto@ (verified "Send mail as" alias). The Gmail address must never appear anywhere customer-facing.
- Delivery is pickup-only ("Retiro"): the site never says shipping is unavailable — it simply states "Retiro en {dirección}", with the address read live from the sheet's Config tab.

### 1a. Collaboration protocol — ask, don't assume

The owner is the product owner; every non-obvious decision goes through them.

Checkpoints (HARD STOPS — ask, summarize, wait for approval):

1. Phase 0 stack review — present the verified stack, versions, and any recommended deviation from §2.
2. Mockups complete (phase 4) — visual approval of docs/mockups/ in the browser before any real UI code.
3. Sheet tabs (Pedidos schema, Plantillas, Config) + seeded email copy — the sheet is the owner's dashboard and the templates are their voice; approve both before wiring.
4. Before each live integration (Drive, Sheets, SMTP, cron) — show setup:check / test:live output and confirm.
5. Final review — walk through the DoD (§14) item by item with the owner.

Question format: one topic per question; numbered options; recommended option first with a one-line why; state what changes if declined. Batch small related questions (max ~5 per checkpoint). Between checkpoints, proceed without asking on anything this spec already fixes. Record every question, the options offered, and the owner's choice in DECISIONS.md.

## 2. Stack (fixed — do not substitute)

| Concern             | Choice                                                                                                                                              |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Framework           | Next.js (latest stable, App Router) + TypeScript strict                                                                                             |
| Styling             | Tailwind CSS (latest stable) themed with the fixed §3a palette; no component library                                                                |
| 3D viewer           | three.js (threejs.org; STLLoader + OrbitControls), client component, dynamically imported                                                           |
| Google Drive/Sheets | googleapis with a Google Cloud service account                                                                                                      |
| Email (outbound)    | Nodemailer over Gmail SMTP with an app password, sending as contacto@monolabprintstudio.cl via a verified "Send mail as" alias (§9b)                |
| Edge                | Cloudflare free plan — DNS, proxy, TLS, caching (§2a); never Workers/Pages                                                                          |
| Tests               | Vitest (unit + integration, TDD, mocked boundaries) · Playwright (smoke E2E in mock mode) · gated live tests against real Google/SMTP (never in CI) |
| Tooling             | npm, ESLint + Prettier, conventional commits                                                                                                        |

Explicitly NOT allowed: databases, ORMs, auth libraries, state-management libraries, UI kits, i18n frameworks, Docker, CI beyond a minimal lint+test workflow.

Open source only: every dependency and font must be MIT / Apache-2.0 / BSD / ISC / CC0 / SIL-OFL (Inter and Montserrat are SIL OFL). No proprietary SDKs; no paid or metered services beyond the free tiers of Google/Cloudflare/Gmail already specified. Run a license audit in phase 1 (e.g., license-checker), record the report in DECISIONS.md, and get owner approval for any exception.

Phase 0 stack review: before scaffolding, verify each row of this table against current official documentation — three.js (threejs.org: STLLoader + OrbitControls import paths), Next.js App Router, googleapis (Drive resumable upload, Sheets values append/update), Nodemailer + Gmail SMTP, Postfix + postsrsd, Cloudflare limits (100 MB body / ~100 s origin / cache rules). Confirm latest stable versions and API shapes, present findings plus any recommended deviation to the owner, and only deviate from this table with explicit sign-off recorded in DECISIONS.md.

Engineering philosophy you must respect: DRY, KISS, YAGNI, SOLID at the module level, 12-factor config. Prefer deletion over abstraction. Introduce an abstraction only on the third duplication.

### 2a. Cloudflare edge layer (free plan)

The domain runs on Cloudflare: DNS + proxy + TLS + caching in front of the VPS origin. Non-negotiable constraints this imposes on the build:

- Request bodies are capped at 100 MB and origin responses at ~100 s → the order API is two-phase (§6): files upload one per request in the background; finalization is small JSON. MAX_UPLOAD_MB defaults to 95.
- All `/api/*` paths must bypass cache (GET /api/cron/tick would otherwise be served from Cloudflare cache) — add the cache rule.
- Rate limiting must read CF-Connecting-IP (§11) or every visitor collapses into one bucket.
- mail.monolabprintstudio.cl and the MX record stay DNS-only (grey cloud); never proxy SMTP. Do NOT enable Cloudflare Email Routing — the VPS forwarder (§9b) owns inbound mail.
- Origin TLS: Full (strict) with a Cloudflare Origin CA certificate (no certbot renewal automation needed). The crontab hits localhost directly, bypassing Cloudflare.
- docs/CLOUDFLARE.md must cover: adding the site, delegating nameservers at the NIC Chile registrar, the record table (proxied @ and www → VPS; DNS-only mail + MX; SPF/DMARC TXT), the /api/* cache-bypass rule, TLS mode, and a post-setup verification checklist (site loads over HTTPS, /api/cron/tick is never cached, a large STL uploads end-to-end).

## 3. Pages

A sticky header carries the horizontal logo lockup (§3b) and anchor navigation (Inicio, Cómo funciona, Materiales, FAQ, Contacto). Single page `/` (mobile-first), sections in order:

1. Hero: studio name, one-line value prop, CTA button scrolling to #pedido.
2. "Cómo funciona": 3 steps (Sube tu archivo → Configura tu pedido → Lo imprimimos y te avisamos para el retiro).
3. #pedido: upload dropzone + 3D viewer + metrics + order form (the core).
4. "Materiales": static cards from config (name, description, typical uses).
5. FAQ: short accordion (5–6 items) from config.
6. Contact: WhatsApp button + public email contacto@monolabprintstudio.cl + retiro address + schedule — retiro/schedule values are read live from the sheet's Config tab (the Gmail address never appears on the site).
7. Footer: minimal.

On successful submit, replace the form section with an inline success panel: order ID, summary, "guarda este número", and a WhatsApp button with prefilled text including the order ID. No page navigation.

Floating WhatsApp button on all viewports (bottom-right), number from config.

### 3a. Design system (fixed palette) & mockups

The palette is FIXED — implement exactly these tokens as CSS custom properties in globals.css, exposed as Tailwind theme tokens, and use nothing else:

| Token            | Hex     | Role                                                                                                                        |
| ---------------- | ------- | --------------------------------------------------------------------------------------------------------------------------- |
| --prussian-blue  | #14213d | Brand primary: hero background, header, footer, contrast sections, secondary buttons (white text ≈ 15:1)                    |
| --orange         | #fca311 | Accent/CTA: primary buttons (prussian-blue text on orange ≈ 7.5:1), highlights, focus rings, progress bars, WhatsApp button |
| --orange-dark    | #d97706 | Accent hover/active states only                                                                                             |
| --bg-app         | #ffffff | Page background                                                                                                             |
| --bg-surface     | #f8fafc | Cards, panels, form fields                                                                                                  |
| --bg-canvas      | #eef2f6 | Alternating sections, viewer canvas background, chips                                                                       |
| --border-light   | #e2e8f0 | Default borders, dividers                                                                                                   |
| --border-medium  | #cbd5e1 | Inputs, emphasized borders                                                                                                  |
| --text-main      | #0f172a | Headings, primary text                                                                                                      |
| --text-secondary | #334155 | Body text                                                                                                                   |
| --text-muted     | #64748b | Captions, helper text, placeholders                                                                                         |

Hard rules:

- WCAG discipline: orange on white is ≈ 2:1 — NEVER body text or meaning-carrying icons on light backgrounds. Orange is for CTA fills (with prussian-blue text), large accents, focus rings, and elements on prussian-blue backgrounds. Never white text on orange.
- No ad-hoc colors: components reference tokens only; no hex literals outside globals.css token definitions and the email hex map (grep-verifiable).
- Spacing/radius/shadows come from Tailwind defaults — no custom design values beyond the palette.
- Typography: Inter (SIL OFL), self-hosted via next/font, system-ui fallback; Tailwind's type scale. All fonts open source — no font services or CDNs.
- 3D viewer: canvas background --bg-canvas; default model material --prussian-blue with subtle flat lighting.

Mockups (docs-driven design):

- docs/mockups/ holds static HTML mockups committed BEFORE the real UI phase: every §3 section in desktop + mobile, the order-flow states (empty dropzone → files with progress bars → success panel), and palette.html — a style guide rendering every token, buttons, inputs, chips, and states.
- Mockups share one tokens.css with the app; they are the visual contract, and the React UI must match them section by section.

### 3b. Brand & logo (source of truth)

The provided logo SVG is committed verbatim as `public/brand/logo-source.svg` — never referenced by any page (it contains the Gmail address, which must never render customer-facing). Derive from it, preserving geometry and gradients:

- `logo-full.svg` — full lockup with the email plate REMOVED (owner-approved default; only add contacto@monolabprintstudio.cl if the owner later requests it).
- `logo-horizontal.svg` — icon left + wordmark right, ≤56 px tall, for the sticky header on light backgrounds; `logo-horizontal-dark.svg` variant for dark backgrounds.
- `logo-icon.svg` — the wireframe-printer mark alone, transparent background, gold-gradient strokes intact — favicon, loading states, og-image.

Brand rules:

- Brand extension tokens added to globals.css alongside §3a: --bg-deep #0d172a, --bg-deepest #080e1a, --gold-light #ffd166, --gold-dark #e5a93c, --border-brand #1f2e4d. Hero and footer background: linear-gradient(135deg, #14213d, #0d172a 50%, #080e1a) mirroring the logo's blueBg. The gold gradient is reserved for the logo and hero accents — buttons stay solid orange (§3a).
- In pages, the wordmark renders as real text (Inter 900, uppercase, wide tracking) beside logo-icon; SVG <text> appears only inside generated PNGs, never in live pages.
- `npm run brand` (sharp as devDependency) renders from the SVG variants: favicon.ico, icon-192/512, apple-touch-icon, and og-image.png (1200×630: icon + MONOLAB PRINT STUDIO + tagline on the blueBg gradient). Outputs committed to public/; og:image meta tag set.
- Emails use a typographic header (SVG does not render in email clients), optionally a hosted logo PNG from SITE_URL.
- Grep-verifiable: no served asset, page, mockup, or email contains "monolabprintstudio@gmail.com" — only logo-source.svg holds it, and it is never served.
- Phase 4 mockups must place the real logo variants.

### 3c. Voice & tone (all Spanish copy: site, emails, error messages)

- Formal (usted), cercano y servicial: trato humano, nunca robótico ni efusivo.
- Estructurado y breve: frases cortas, un tema por párrafo, máximo 5 líneas por bloque, resúmenes en viñetas, un solo CTA visible.
- Caring: siempre indicar qué ocurrió, qué sigue y cómo contactarnos; sin excusas largas ni relleno.
- Sin tecnicismos (el cliente no necesita saber de "Drive" ni "cron"): hablar de "su pedido" y "sus archivos".
- Errores en el mismo tono: qué ocurrió, qué puede hacer, cómo contactarnos. Ej.: "No pudimos enviar su pedido. Inténtelo nuevamente o escríbanos por WhatsApp."

## 4. Upload + viewer behavior (multiple files)

1. Drag & drop or click; multiple selection allowed (add files one by one or in batches). Accept only `.stl` (ASCII and binary). Reject anything else with a clear Spanish message. Limits: max 10 files per order, each ≤ MAX_UPLOAD_MB (env, default 95 MB — Cloudflare caps proxied request bodies at 100 MB).
2. Show every accepted file as a chip/list item: name, size in MB, per-file metrics (§4.5), a per-file upload progress bar, and a remove (×) button. Each file uploads to the server in the background as soon as it is accepted (retry on failure); the submit button stays disabled until every upload has settled (§6).
3. Parse each file client-side with three.js STLLoader. On parse failure mark that file with a Spanish error and let the user remove or re-add it; other files are unaffected.
4. The viewer renders ONE file at a time; clicking a file chip selects it. Auto-fit camera, rotate/zoom/pan (mouse + touch), solid shading.
5. Compute per file: bounding box X/Y/Z in mm (assume model units are millimeters; show this assumption in the UI) and mesh volume in cm³ (signed-tetrahedron method, absolute value, 1 decimal). Display per-file metrics in the file list plus the order total volume (sum, 1 decimal).
6. These client-computed metrics are submitted with the form and written to the sheet. The server does NOT re-parse files — document this trust boundary in code.

## 5. Order form

Client info (all Spanish labels, inline validation errors in Spanish):

- Nombre completo* (text, 2–80)
- Email* (email)
- WhatsApp* (phone)
- Ciudad* (text, 2–60)
- Retiro: no input field — an info line under the form shows "Retiro en: {dirección}" read from the Config tab (pickup-only; no shipping fields)

Print options (order-level; applies to all files in the order):

- Material* (select from config list, e.g. PLA, PLA Silk, PETG, ABS, TPU, Resina)
- Color (free text, ≤40)
- Relleno (select 10/20/50/100 %, default 20)
- Cantidad (number 1–100, default 1 — number of copies per file)
- Notas (textarea, 0–500)
- Hidden honeypot field "empresa" — if filled, silently accept and discard without touching Google APIs.

One zod schema shared by client and server (single source: src/lib/validation.ts).

## 6. Order API (two-phase, Cloudflare-safe)

Cloudflare's proxy caps any single request at 100 MB and ~100 s — so files and order finalization travel separately.

`POST /api/uploads` (multipart, ONE file):

1. Validate extension + size; sanitize filename (`[^A-Za-z0-9._-]` → `_`, collapse repeats, trim, ≤80 chars); stream-write to `./data/tmp/{randomToken}.stl`.
2. Respond `201 { token, name, size }`. Per-IP rate limit: 20 uploads / 10 min.

`POST /api/orders` (JSON — client info + print options + tokens[]):

1. Validate with zod: 1–10 tokens, each resolving to an existing tmp file; honeypot silently accepted and discarded (no Google calls).
2. Generate the order number: sequential `ML-0001`, `ML-0002`, … The sheet is the source of truth — read column A, take the max numeric suffix, add 1, zero-pad to 4 digits (grows naturally past 9999). Guard two concurrent submissions with an in-process async mutex plus verify-and-retry on append (max 3 attempts). Empty sheet → ML-0001.
3. Create a Drive subfolder named after the order number inside `DRIVE_FOLDER_ID`; move every tmp file into it with its sanitized name; mime application/octet-stream; resumable upload; files never public; delete each tmp file after its upload.
4. Append one row (§7) to the sheet tab (env `SHEET_TAB`, default "Pedidos"). Parse the append response to build a direct link to the new row: `https://docs.google.com/spreadsheets/d/{SHEET_ID}/edit#gid=0&range=A{row}:S{row}`.
5. Send the customer confirmation email and the operator notification email (§9).
6. Respond `201 { id }`. On any Google/SMTP failure: log (structured), respond `503`; the client shows a retry message plus a WhatsApp fallback.

Tmp files from abandoned carts are swept by the cron tick (§8) — no orphan storage growth, no cleanup cron of its own.

## 7. Sheet schema (one header row; orders appended below)

| Col | Header              | Example                                                          |
| --- | ------------------- | ---------------------------------------------------------------- |
| A   | ID Pedido           | ML-0001                                                          |
| B   | Fecha               | 2025-06-12 14:03                                                 |
| C   | Estado              | Nuevo                                                            |
| D   | Nombre              | Ana Pérez                                                        |
| E   | Email               | ana@example.com                                                  |
| F   | WhatsApp            | +57 300 123 4567                                                 |
| G   | Ciudad              | Medellín                                                         |
| H   | Entrega             | Retiro                                                           |
| I   | Archivos (Drive)    | link a la carpeta ML-0001                                        |
| J   | Nº archivos         | 2                                                                |
| K   | Volumen total (cm³) | 108.4                                                            |
| L   | Detalle archivos    | caja.stl — 96.3 cm³ (120×80×40) ⏎ tapa.stl — 12.1 cm³ (60×40×20) |
| M   | Material            | PETG                                                             |
| N   | Color               | Negro                                                            |
| O   | Relleno (%)         | 20                                                               |
| P   | Cantidad            | 2                                                                |
| Q   | Notas               | text                                                             |
| R   | Estado notificado   | Nuevo                                                            |
| S   | Última notificación | 2025-06-12 14:04                                                 |

Valid values for Estado (a setup script installs this dropdown on the column via Sheets API data validation): Nuevo, En cola, Imprimiendo, Listo, Enviado, Entregado, Cancelado.

Every column is operator-editable; the cron re-reads rows on every tick, so a corrected email or note flows automatically. To RE-send a status email, clear "Estado notificado" — the next tick re-notifies with the current template.

Tab "Plantillas" — columns: Estado | Asunto | Mensaje, one row per auto-email state (§16 is the seeded content). Variables {{nombre}}, {{orderId}}, {{resumen}}, {{whatsappLink}}, {{sitio}}, {{retiro}} are substituted at send time; unknown variables stay literal; a missing or malformed row falls back to the built-in default — a typo in the sheet can never break the mail flow.

Tab "Config" — key/value rows: RETIRO_DIRECCION, RETIRO_HORARIO. The site reads Config server-side with a 5-minute cache; templates resolve {{retiro}} from here.

## 8. Status-notifier cron

`GET /api/cron/tick` — requires `Authorization: Bearer ${CRON_SECRET}`. Idempotent:

1. Read the Pedidos tab (columns A–S, last 500 rows) and the Plantillas tab — fresh on every tick, so operator edits apply within one tick.
2. For each row where Estado ≠ "Estado notificado" and Estado ≠ "Nuevo": render that state's template (Plantillas row if present and valid, else the built-in §16 default), send to the row's email, then write "Estado notificado" = Estado.
3. Per-row errors: log and continue.
4. Sweep `./data/tmp`: delete files older than 24 h (orphaned uploads from abandoned orders). Response: `{ processed, failed, swept, fallbacks }` (fallbacks = emails sent on built-in defaults because the Plantillas row was missing/invalid).

Trigger via system crontab (document the exact line in docs/DEPLOY.md):
`*/5 * * * * curl -fsS -H "Authorization: Bearer ${CRON_SECRET}" https://YOUR-DOMAIN/api/cron/tick >/dev/null 2>&1`

Email states and templates (Spanish, in src/lib/templates.ts):

- En cola → received & queued
- Imprimiendo → in production
- Listo → ready for pickup/delivery
- Enviado → shipped
- Entregado → delivered, thanks + reorder CTA
- Cancelado → cancelled, apology + WhatsApp CTA

## 9. Email design

- Single Nodemailer transporter (Gmail SMTP: smtp.gmail.com:465, app password), lazy init, 10 s timeout, fail fast. Gmail SMTP allows ~500 messages/day — adequate for this volume.
- All customer-facing mail uses From: contacto@monolabprintstudio.cl (display name "Monolab Print Studio"), Reply-To the same. Operator notifications are delivered to monolabprintstudio@gmail.com — the Gmail address is internal only.
- Templates are pure functions returning `{ subject, html, text }`: minimal semantic HTML with inline styles, order ID prominent, a summary table, a WhatsApp deep link (wa.me/<number>?text=... including the order ID), and the site URL. Colors follow the §3a palette via a shared hex-constant map with inline styles (email clients ignore CSS variables). Built-in defaults come VERBATIM from §16; at send time a valid Plantillas row overrides them (§7, §8).
- The operator notification email additionally contains: the Drive file link, the direct sheet-row link, and the file metrics.

### 9b. Inbound forwarding on the VPS (contacto@ → monolabprintstudio@gmail.com)

Postfix on the VPS receives mail for monolabprintstudio.cl and forwards contacto@ to the Gmail inbox; postsrsd rewrites envelope senders so forwarded mail passes Gmail's SPF checks instead of landing in spam. Runs as a system service, binds only port 25, and must not interfere with the web app (Next keeps 80/443/3000; nothing else on the VPS changes).

The build must produce:

- docs/EMAIL-DOMAIN.md — keystroke-level guide: DNS records (A `mail` → VPS IP; MX `@` → `mail.monolabprintstudio.cl` prio 10; TXT `@` `"v=spf1 mx include:_spf.google.com ~all"`; optional `_dmarc` `"v=DMARC1; p=none"`); Postfix install on Debian/Ubuntu (Internet Site, hostname mail.monolabprintstudio.cl); `virtual_alias_domains` + `/etc/postfix/virtual` mapping `contacto@monolabprintstudio.cl → monolabprintstudio@gmail.com`; `reject_unauth_destination` (never an open relay); no local mailboxes; postsrsd with `srs_domain = monolabprintstudio.cl`; firewall port 25; the VPS-provider port-25 unblock step (most providers block it by default — must be requested, document per-provider notes); rDNS/PTR note; a warning that mail DNS records must remain DNS-only (grey cloud) with Cloudflare Email Routing left disabled (cross-ref docs/CLOUDFLARE.md); then the Gmail "Send mail as" alias verification (the verification email arrives through the forward — order matters); finally a test checklist: external mailbox → contacto@ → Gmail inbox, reply round-trip, spam-folder debugging steps.
- scripts/setup-mail-server.sh — idempotent bash script applying the Postfix + postsrsd config on Debian/Ubuntu (args: DOMAIN, GMAIL_TARGET), safe to re-run, prints a green/red summary. Warning in README: run on the VPS, never in development.
- A grep-level verification that no Gmail address appears in any customer-facing page, email, or template.

## 10. Configuration & mock mode

All config via env, validated once at boot with zod (fail fast, English error messages). Provide `.env.example` listing every var with a one-line comment:

GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_PRIVATE_KEY (with literal \n), DRIVE_FOLDER_ID, GOOGLE_SHEET_ID, SHEET_TAB, SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, FROM_EMAIL (default contacto@monolabprintstudio.cl), OPERATOR_EMAIL (default monolabprintstudio@gmail.com), WHATSAPP_NUMBER (digits only, with country code), SITE_URL, CRON_SECRET, MAX_UPLOAD_MB (default 95 — Cloudflare free plan caps request bodies at 100 MB), MOCK_APIS.

MOCK_APIS=true: orders are saved as JSON + file under ./data/mock/ and emails are logged instead of sent; the full UI flow works with zero Google credentials. Refuse to start if NODE_ENV=production and MOCK_APIS=true.

Site content (hero copy, materials, FAQ, contact, WhatsApp number) lives in src/lib/content.ts — all Spanish, editable in one file.

## 11. Engineering rules

- TypeScript strict; no `any`; explicit types at exported boundaries.
- Pure functions in src/lib; side effects only in route handlers and the thin drive/sheets/mailer wrappers.
- Each Google/SMTP wrapper: exactly one retry with exponential backoff (500 ms, 2 s) for transient 5xx/429/network errors only.
- One tiny logger module (console wrapper with level + timestamp); no external logging service.
- Upload progress bar in the UI (XHR or fetch stream).
- Accessibility: semantic landmarks, labels, visible focus, contrast. Viewer controls pointer/touch only (acceptable).
- Security headers via next.config; secrets only from env; no file paths in responses; Drive links contain file IDs only.
- Rate limiting keys on CF-Connecting-IP when present (fallback X-Forwarded-For / remote address) so the Cloudflare proxy does not merge all visitors into one bucket.
- Palette discipline (§3a): tokens only — no hex literals in components; orange never carries text on light backgrounds.
- Docs-first implementation: before coding any external integration (three.js loaders/controls, googleapis Drive/Sheets, Nodemailer, Postfix config, Cloudflare rules), review the official documentation for that exact version (Context7 MCP if available, otherwise the official site) and verify the API shape; record the doc URL + version in DECISIONS.md. Never implement an external API from memory.
- three.js is dynamically imported so the initial bundle stays small.
- Vitest coverage: stl-metrics (fixtures: 10 mm cube = 1.000 cm³; 20×10×5 mm box = 1.000 cm³), order-number (empty sheet → ML-0001; parses max existing suffix; zero-padding), validation accept/reject matrix including the 1–10 file limits, template renderer ({{var}} substitution, unknown-variable tolerance, Plantillas override + fallback to §16 defaults), Config-tab reader, cron diff logic as a pure function. Mock googleapis and nodemailer at the module boundary.

### 11a. Development methodology: docs-driven + test-driven

- Docs-driven: every phase begins by writing/updating the documentation for that slice — docs/ARCHITECTURE.md for structure and data flow, the relevant feature section, and a DECISIONS.md entry (ADR-lite: context → decision → consequence, ≤10 lines) for every non-obvious choice. Then implement to match the doc; if reality forces a divergence, update the doc in the same commit. Docs are the review contract — no phase ends with docs behind code.
- Test-driven: for every module in src/lib and every route handler, write the failing test first (red), implement until green, then refactor. No new module without its tests written first. Phase commits lead with the tests.
- Three test layers (defined in docs/TESTING.md):
  1. Unit + integration (Vitest) — fast, mocked boundaries; run on every commit and in CI.
  2. Smoke (Playwright, headless Chromium) — the critical path only, in MOCK_APIS=true: home → drop a fixture STL → viewer + metrics render → fill form → submit → success panel shows the sequential order number; the suite places a second order and asserts the next number (ML-0001 → ML-0002). Command: `npm run smoke`; it boots its own dev server and regenerates fixtures via `npm run fixtures` (fixture STLs are generated by a checked-in script, never committed as binary blobs).
  3. Live (gated) — `npm run test:live`: real Drive, real Sheets, real SMTP. Creates clearly-marked TEST resources (TEST-ML-XXXX folder + sheet row), verifies they exist, then deletes them; sends exactly one test email to OPERATOR_EMAIL. Refuses to run when MOCK_APIS=true or NODE_ENV=production. Never runs in CI.
- CI stays minimal: lint + unit/integration only. Smoke and live are local/pre-release commands.

## 12. Repository layout (target)

```
src/app/page.tsx
src/app/api/uploads/route.ts
src/app/api/orders/route.ts
src/app/api/cron/tick/route.ts
src/components/        (StlViewer, UploadDropzone, OrderForm, SuccessPanel, WhatsAppFloat, sections)
public/brand/         logo-source.svg (verbatim, NEVER served) + derived variants (§3b); npm run brand regenerates favicon/og-image into public/
src/lib/               (config, validation, order-number, stl-metrics, drive, sheets, mailer, templates, sheet-templates, sheet-config, status-notifier, logger, rate-limit, content)
tests/                 (Vitest unit/integration mirroring src/lib; tests/e2e/ Playwright smoke specs; tests/fixtures/ regenerated by npm run fixtures)
docs/ARCHITECTURE.md   living overview: components, order flow, data flow, failure modes — updated every phase (docs-driven, §11a)
docs/TESTING.md        the three test layers, exact commands, what each layer proves and does not
docs/mockups/          static HTML mockups + palette.html style guide (§3a) — the visual contract committed before the UI phase
docs/GOOGLE-SETUP.md   exact click-path: create GCP project, enable Drive + Sheets APIs, create service account + JSON key, share the Drive folder and the sheet with the SA email, create the Gmail app password
docs/DEPLOY.md         env table; any Node 20+ host with large request bodies (small VPS, Railway, Fly — NOT Vercel: 4.5 MB serverless body cap); runs behind Cloudflare (docs/CLOUDFLARE.md); crontab line; TLS/domain notes
docs/CLOUDFLARE.md     edge setup: nameserver delegation at NIC Chile, record table (proxied web, DNS-only mail), /api/* cache-bypass rule, TLS Full (strict) + Origin CA, verification checklist (§2a)
docs/OPERADOR-es.md    Spanish operator guide: where files land, how to change Estado, which email each state sends, editing Pedidos/Plantillas/Config tabs, the Estado-notificado re-send trick, template variables cheat-sheet, the daily routine
docs/EMAIL-DOMAIN.md   DNS + Postfix + postsrsd + Gmail alias setup for contacto@monolabprintstudio.cl → monolabprintstudio@gmail.com (§9b)
scripts/setup-mail-server.sh   idempotent VPS mail-forwarding installer (§9b)
scripts/setup-sheet.ts  seeds all tabs idempotently — Pedidos header + Estado dropdown, Plantillas rows from §16, Config defaults (`npm run setup:sheet`)
.github/workflows/ci.yml  lint + test on push
README.md              English, with a Spanish QUICKSTART section
DECISIONS.md           every judgment call beyond this spec + every §1a checkpoint Q&A (question, options, owner's choice) + doc URL/version cited per integration
```

## 13. Build phases (commit after each, conventional commits)

0. Stack review & docs verification (§2): confirm versions and API shapes against official docs, plan the license audit, present findings — HARD STOP checkpoint (§1a).
1. Scaffold + docs skeleton: Next.js + TS + Tailwind + lint/format + CI skeleton; install the §3a design tokens (CSS variables in globals.css → Tailwind theme); write docs/ARCHITECTURE.md, docs/TESTING.md, and DECISIONS.md describing the intended structure BEFORE any feature code (docs-driven).
2. lib core (TDD — red, green, refactor): order-number, validation, stl-metrics; each commit leads with the failing tests and includes the updated doc section.
3. Integrations (TDD, mocked boundaries): sheets, drive, mailer, templates (§16 as built-in defaults), sheet-templates renderer with override/fallback, sheet-config reader, status-notifier diff logic; plus the gated `npm run test:live` harness.
4. Brand & mockups: derive the §3b logo variants (no Gmail address in anything served), run `npm run brand`, then the static HTML mockups in docs/mockups/ (§3a) — every §3 section in desktop + mobile, all order-flow states, palette.html style guide, real logo placements. Committed before any real UI; they are the visual contract.
5. UI built to match the mockups: page sections, dropzone + viewer + metrics, form + success panel, WhatsApp float.
6. API routes (uploads + orders) wired end-to-end + rate limit + mock mode (integration tests written first).
7. Cron route + status emails end-to-end (Pedidos + Plantillas tabs) + the 24 h tmp-file sweep + `npm run setup:sheet` seeding.
8. Smoke suite: Playwright specs + `npm run fixtures` + `npm run smoke` covering the full happy path in MOCK_APIS=true, including sequential numbering across two orders.
9. Operator docs: GOOGLE-SETUP, DEPLOY, CLOUDFLARE, OPERADOR-es, EMAIL-DOMAIN (§9b), README, .env.example, scripts/setup-sheet.ts, scripts/setup-mail-server.sh, and `npm run setup:check` (verifies env, Drive write access, Sheets write access, SMTP send as FROM_EMAIL; prints a green/red report).
10. Final pass: remove dead code, doc-drift review (code vs ARCHITECTURE.md vs this spec), mockup-vs-UI review, self-review against this spec item by item, fix findings, update DECISIONS.md.

## 14. Definition of done

- `npm ci && npm run build && npm run lint && npm test` all green on a clean clone.
- `npm run smoke` green in mock mode: two orders placed end-to-end produce ML-0001 then ML-0002.
- `npm run test:live` green with real credentials: marked TEST resources created, verified, and cleaned up, and exactly one test email delivered to OPERATOR_EMAIL; the command refuses to run in mock mode or production.
- Operator-editable sheet proven: editing a Plantillas row changes the next status email; correcting a Pedidos email redirects it; clearing "Estado notificado" re-sends; a retiro address edited in Config appears on the site within 5 minutes.
- Behind Cloudflare: site serves over HTTPS with the /api/* cache-bypass rule active; /api/cron/tick is never served from cache; a 90 MB STL uploads end-to-end; rate limiting distinguishes visitors via CF-Connecting-IP.
- The shipped UI matches docs/mockups/ section by section, and no color literals exist outside the token definitions (globals.css) and the email hex map (grep-verifiable).
- No customer-facing asset, page, email, or mockup contains the Gmail address; header/footer/mockups use the derived §3b logo variants; favicon and og-image exist and the og:image meta tag is set.
- Every §1a checkpoint has a recorded Q&A entry in DECISIONS.md with the owner's choice; the license audit passes with no unapproved proprietary or copyleft-client dependencies; every external integration's DECISIONS.md entry cites the doc URL and version it was verified against.
- docs/ARCHITECTURE.md matches the shipped code (no doc drift); the git history shows docs committed alongside the code they describe.
- With MOCK_APIS=true, the full flow (upload → viewer → order → success panel) works with no credentials.
- With real credentials, one order produces a Drive subfolder, a sheet row, and two emails — manually verifiable in under 5 minutes using docs/GOOGLE-SETUP.md.
- A two-file order produces exactly one row (one order number, summed volume, per-file detail cell) and one Drive subfolder holding both files; the next submission receives the next sequential number (ML-0001 → ML-0002).
- Customer-facing emails show From contacto@monolabprintstudio.cl; a reply to it reaches monolabprintstudio@gmail.com through the VPS forward; the Gmail address appears nowhere customer-facing.
- Changing Estado in the sheet and hitting /api/cron/tick sends exactly one status email; re-running the tick sends none (idempotency proven).
- No TODOs, no dead code, no unused dependencies, no console.log outside the logger.

## 15. Explicitly out of scope (do not build)

Payments, cart, automatic quotes/pricing, user accounts, order history or public status pages, admin UI of any kind — the spreadsheet (Pedidos/Plantillas/Config) is the only operator panel —, per-file material/color/infill configuration (order-level only), formats other than STL, CMS, blog, i18n framework, analytics beyond meta/OG tags, microservices, external queues (Redis/RabbitMQ), Docker, mailbox hosting/webmail/IMAP on the VPS (Postfix is forward-only), cross-browser test matrices (smoke runs Chromium only), Cloudflare Workers/Pages/Tunnel (the origin remains the VPS), boleta/receipt/invoice generation (a Plantillas-style tab can hold text snippets later if ever needed).

## 16. Appendix — approved email copy (Spanish, verbatim; seeded into the Plantillas tab)

Tone per §3c. Variables: {{nombre}}, {{orderId}}, {{resumen}} (viñetas: archivos, material, color, relleno, cantidad), {{whatsappLink}} (wa.me con {{orderId}} precargado), {{sitio}}, {{retiro}} (dirección de retiro desde la pestaña Config). Subject lines always start with the order number for filtering/threading. Every customer email ends with the standard footer:

```
Atentamente,
Equipo Monolab Print Studio
{{sitio}}
```

### 1. Confirmación de recepción (auto on submit)

Asunto: `Pedido {{orderId}} — recibido`

```
Estimado/a {{nombre}}:

Hemos recibido su pedido {{orderId}}. Sus archivos y datos quedaron registrados.

Revisaremos su solicitud y le enviaremos la confirmación en breve.

Resumen del pedido:
{{resumen}}

¿Consultas? Escríbanos por WhatsApp: {{whatsappLink}}
```

### 2. En cola

Asunto: `Pedido {{orderId}} — en cola de impresión`

```
Estimado/a {{nombre}}:

Su pedido {{orderId}} fue confirmado y está en cola de impresión.

Le avisaremos cuando comience la producción.

¿Consultas? Escríbanos por WhatsApp: {{whatsappLink}}
```

### 3. Imprimiendo

Asunto: `Pedido {{orderId}} — en producción`

```
Estimado/a {{nombre}}:

Su pedido {{orderId}} está en producción.

Le informaremos en cuanto esté terminado.

¿Consultas? Escríbanos por WhatsApp: {{whatsappLink}}
```

### 4. Listo

Asunto: `Pedido {{orderId}} — listo para entrega`

```
Estimado/a {{nombre}}:

Su pedido {{orderId}} está terminado y listo para entrega.

Retiro en: {{retiro}}

Para coordinar el horario, responda este correo o escríbanos: {{whatsappLink}}
```

### 5. Enviado

Asunto: `Pedido {{orderId}} — en camino`

```
Estimado/a {{nombre}}:

Su pedido {{orderId}} fue despachado.

Le confirmaremos cuando haya sido entregado.

¿Consultas? Escríbanos por WhatsApp: {{whatsappLink}}
```

### 6. Entregado

Asunto: `Pedido {{orderId}} — entregado`

```
Estimado/a {{nombre}}:

Confirmamos la entrega de su pedido {{orderId}}.

Gracias por confiar en Monolab Print Studio.

Guardamos sus archivos: si desea repetir su pedido, solo escríbanos. {{whatsappLink}}
```

### 7. Cancelado

Asunto: `Pedido {{orderId}} — cancelado`

```
Estimado/a {{nombre}}:

Su pedido {{orderId}} ha sido cancelado.

Lamentamos cualquier inconveniente. Si desea retomarlo o tiene consultas, estamos a su disposición: {{whatsappLink}}
```

### 8. Notificación al operador (interna — solo para monolabprintstudio@gmail.com)

Asunto: `[Monolab] Nuevo pedido {{orderId}} — {{nombre}}`

```
Nuevo pedido {{orderId}}
Cliente: {{nombre}} — {{ciudad}} — {{whatsapp}}
Archivos: {{nArchivos}} ({{volumenTotal}} cm³) — {{driveLink}}
Fila en planilla: {{filaLink}}
Estado inicial: Nuevo.
```

All eight bodies ship verbatim; HTML versions render this text with §3a palette and inline styles.
