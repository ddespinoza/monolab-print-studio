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
