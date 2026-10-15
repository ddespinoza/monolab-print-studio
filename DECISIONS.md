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
