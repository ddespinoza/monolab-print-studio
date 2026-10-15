# Architecture

Status: skeleton (Phase 1). Updated every phase.

- Next.js App Router, single page `/`, API routes `/api/uploads`, `/api/orders`, `/api/cron/tick`.
- Google Sheet is the database (tabs Pedidos, Plantillas, Config). Drive holds the STL files (OAuth user credentials). Gmail SMTP sends mail as contacto@.
- Order flow: files upload one by one to `data/tmp` -> order JSON with tokens -> Drive subfolder + sheet row + 2 emails.
- Cron tick (every 5 min, localhost) sends status emails when Estado differs from Estado notificado.
- Binds 127.0.0.1:3100 only (shared VPS). See docs/SPEC.md for the full brief; DECISIONS.md for deviations.

## src/lib core (Phase 2)

Pure functions, no I/O.

- `order-number.ts`: next `ML-NNNN` from the sheet's ID column (max suffix + 1, padded to 4, grows past 9999).
- `stl-metrics.ts`: bbox in mm and volume in cm3 (signed tetrahedra, absolute value, 1 decimal). Runs in the browser; the server trusts these values and never re-parses files.
- `validation.ts`: the zod schema shared by client and server; Spanish messages; 1-10 files with unique 32-hex tokens; `ESTADOS` has 6 states.
- `sanitize.ts`: filename sanitising, spreadsheet formula escaping (`'` prefix), HTML escaping, line-break stripping.

## Integrations (Phase 3)

All wrappers take an injected client, so tests mock at the module boundary and `src/lib/google.ts` is the only place real credentials are built.

- `config.ts`: env validated once with zod; mock mode needs no credentials; refuses MOCK_APIS in production.
- `retry.ts`: transient-only retry (500 ms, 2 s). Used by sheets, drive, mailer.
- `sheets.ts` (service account): read IDs and orders, append (RAW), mark notified, delete row, read tabs. `order-row.ts` maps the 19 columns.
- `drive.ts` (OAuth user): order subfolder and streaming upload; files are never shared.
- `mailer.ts`: Nodemailer over Gmail SMTP; From and Reply-To are always FROM_EMAIL.
- `templates.ts`: approved copy as defaults, `{{var}}` rendering, HTML email with the palette hex map. `sheet-templates.ts` overrides them from the Plantillas tab with fallback. `sheet-config.ts` reads the Config tab with a 5 minute cache that serves stale data on failure.
- `status-notifier.ts`: `findPending` (pure diff) and `runTick` (dependency-injected; at-least-once; no overlap).
- `scripts/test-live.ts`: gated live check (real Drive, Sheets, SMTP; creates then deletes TEST resources).

## Brand and mockups (Phase 4)

- `brand/logo-source.svg` is the owner's artwork, verbatim, NOT under `public/` so it is never served (it carries the operator's Gmail address on an email plate). `npm run brand` (`scripts/brand.ts`) derives `public/brand/logo-{full,icon,horizontal,horizontal-dark}.svg`, favicon.ico, icon-192/512, apple-touch-icon and og-image.png, and fails if an "@" survives in a derivative.
- `src/styles/tokens.css` is the single palette file, imported by `globals.css` (Tailwind `@theme`) and linked by every mockup. Light theme only.
- `docs/mockups/` is the visual contract: `index.html` (all sections), `mobile.html`, `flow-1-empty`, `flow-2-files`, `flow-3-success`, `confirmar.html` (public quote-confirmation page), `palette.html`.
- `npm run check:rules` greps for the Gmail address in customer-facing paths and for hex literals outside tokens.css and the email hex map.

## Order flow and UI (Phases 5-8)

- **Browser**: `OrderSection` keeps all order state in `lib/order-state.ts` (pure reducer, tested). Each dropped file is parsed client-side (`model-loader.ts`: STL, OBJ, PLY via three.js addons), measured (`stl-metrics.ts`), then uploaded in the background with progress (`upload-client.ts`, raw `PUT /api/uploads`). three.js is loaded with a dynamic import inside `StlViewer`; `lib/viewer.ts` draws a Z-up scene with the build plate and reads its colours from the CSS tokens.
- **Server**: `lib/runtime.ts` builds the Sheets, Drive and mail adapters (real, or file-backed mocks in `lib/mock.ts` when MOCK_APIS=true) and the rate limiters. Routes are thin: `/api/uploads` (stream to `data/tmp`), `/api/orders` (zod, honeypot, `lib/orders.ts`), `/api/cron/tick` (`lib/status-notifier.ts`), `/api/confirmar` (POST from the confirmation page) and the page `/confirmar/[token]`.
- **Order creation** (`lib/orders.ts`): serialised in-process; reads ids, creates `ML-NNNN - initials` in Drive, uploads the files, appends the row, re-reads ids to detect a duplicate, then sends the two emails. The row is the commit point.
- **Quote confirmation**: tick sends the Cotizado email with a signed link; the page shows a button; its POST runs `confirmOrder` (sheet first, then emails).
- **Cron tick** also sweeps `data/tmp` files older than 24 h.
- Mock data lives in `data/mock/` (`pedidos.json`, `drive/`, `emails/`); to simulate the operator, edit `pedidos.json` (set Estado `Cotizado` and fill Cotización) and call the tick.
