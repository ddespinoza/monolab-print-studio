# Architecture

Status: skeleton (Phase 1). Updated every phase.

- Next.js App Router, single page `/`, API routes `/api/uploads`, `/api/orders`, `/api/cron/tick`.
- Google Sheet is the database (tabs Pedidos, Plantillas, Config). Drive holds the STL files (OAuth user credentials). Gmail SMTP sends mail as contacto@.
- Order flow: files upload one by one to `data/tmp` -> order JSON with tokens -> Drive subfolder + sheet row + 2 emails.
- Cron tick (every 5 min, localhost) sends status emails when Estado differs from Estado notificado.
- Binds 127.0.0.1:3100 only (shared VPS). See docs/SPEC.md for the full brief; DECISIONS.md for deviations.
