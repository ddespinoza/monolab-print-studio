# Improvement plan

Date: 2026-10-15. Draft from the audit of the live site and code. Flow for every phase: tests first for logic, then
`npm run lint && npx tsc --noEmit && npm test && npm run check:rules`, push, deploy, check live.

## Owner goals

Easier ordering, better look and brand, emails as polished as the website, phone number instead of WhatsApp in the form,
spreadsheet control over when emails are sent, a loading screen for files, and an intro that says the service is
dental-focused, uses the Anycubic Photon Mono 4 Ultra, is based in Santiago, Chile, and is represented by
Antonio Alvear Muñoz, Odontólogo.

## Audit findings

- Emails: `toHtml()` in `src/lib/templates.ts` wraps plain text; text-only header, no logo, no summary card, no button, bare confirm URL.
- WhatsApp is the contact field in the form, `validation.ts`, the sheet, templates, floating button, FAQ and footer.
- A 5-minute cron (`/api/cron/tick`) sends status emails automatically; the operator cannot choose when.
- `FileList` shows upload progress, but parsing has no clear loading state; first paint waits for the Config read.
- Hero says only "Impresión 3D en resina de precisión"; no mention of dentistry, Santiago or the representative.
- Pickup address and schedule are still placeholders (site, "Listo" email, footer).

## Phase 1: Content and brand

1. New hero and a "Quiénes somos" intro: dental focus, Santiago, Chile, Antonio Alvear Muñoz Odontólogo, Anycubic Photon Mono 4 Ultra with build volume.
2. Landing sections: dental use cases, delivery options and prices up front, improved FAQ.
3. Real pickup address and schedule in the sheet Config tab (needs owner input).

## Phase 2: Order form and viewer

4. Replace WhatsApp with Teléfono (Chilean format) in form, validation, sheet header, templates and operator notification.
   Assumption: the floating contact button and links stay unless the owner says otherwise.
5. Loading overlay while files are read, parsed and uploaded, with per-file stages.
6. Mobile pass on the split layout.

## Phase 3: Emails

7. Rebuild HTML email: logo header, status badge, order summary card, real "Confirmar cotización" button, footer with phone, address, Santiago. Plain-text fallback stays.
8. Mockups in `docs/mockups/` for approval before coding.
9. Restyle `/confirmar` to match.

## Phase 4: Spreadsheet buttons for emails

Goal: the operator presses a button in the sheet and the correct email for that order goes out (Cotizado, Listo, ...),
looking exactly like the site's emails and sent from contacto@. Nothing is sent unless the operator asks.

Design (recommended):

- **The site sends, the sheet only asks.** New endpoint `POST /api/send` on the app, authorised with a new secret
  `SHEET_SECRET` (separate from `CRON_SECRET`). It reuses the existing templates, SMTP, confirm link and `markNotified`, so
  the sheet cannot drift from the website. A bound Apps Script in the sheet calls it with `UrlFetchApp`; the secret lives
  in Script Properties, never in a cell.
- **Menu "Monolab"** in the sheet: "Enviar correo de la fila seleccionada", "Enviar todos los correos pendientes",
  "Enviar prueba a mi correo" (preview to OPERATOR_EMAIL only). Optional drawn buttons assigned to the same functions
  (drawings must be inserted by hand; the script cannot create them).
- **Which email:** the template for the row's current Estado. Guards: Cotizado without a Cotización text is refused;
  an Estado already notified asks "Ya se envió, ¿reenviar?" (explicit `force`); rows without an email are refused.
- **Automatic vs manual:** Config key `ENVIO_AUTOMATICO` (SI/NO), default NO. With NO the 5-minute cron stops sending
  status emails (it still sweeps tmp files); with SI the current behaviour stays. The first deploy switches the live site to
  manual, so decide before deploying.
- **Feedback in the sheet:** a toast per action ("Enviado a ..." / "Falló: ...") and a new tab `Envíos` (date, order,
  Estado, recipient, result), plus the existing Estado notificado and Última notificación columns.
- **Pedidos upload check:** the end-to-end order test on the live site (receipt, row, Drive folder, Cotizado email, confirm page)
  and the ~90 MB upload through Cloudflare.
- **Dashboard tab:** orders by Estado and emails pending, with plain sheet formulas.

Work order: (a) tests then `POST /api/send` plus the `ENVIO_AUTOMATICO` switch in `status-notifier`; (b) `Envíos` log
and `setup:sheet` additions; (c) the Apps Script source in `docs/apps-script/Monolab.gs` with install steps in
OPERADOR-es.md (about 5 minutes: Extensions > Apps Script > paste > authorise once); (d) set `SHEET_SECRET` in Coolify and
Script Properties; (e) live test with a real order.

Risks and open points:

- Apps Script must be installed by the owner: the service account and OAuth app have no script scopes, and granting them
  is not worth it for a one-time paste.
- Cloudflare could challenge requests from Google's servers; the existing cache rule bypasses /api/, and a WAF skip rule for
  the path is the fallback.
- Apps Script limits one execution to 6 minutes, which is far above one email per call; "enviar pendientes" sends in a
  loop of single calls so a failure on one order does not stop the rest.

## Phase 5: Technical, SEO, performance

13. Metadata, Open Graph image, LocalBusiness structured data, sitemap, robots.
14. Mobile Lighthouse, lazy-load three.js.
15. Final Definition-of-Done walkthrough.

## Open questions (unanswered at time of writing)

1. Manual-only sending or a switch (plan now recommends the switch, default manual)? 2. WhatsApp removed entirely or only the form field? 3. What exactly failed with
   "orders must get uploaded"? 4. Photo or credentials for Antonio Alvear Muñoz?
