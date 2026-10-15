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

## Phase 4: Spreadsheet control

10. Operator-controlled sending: Apps Script menu "Monolab" (send pending / send selected row), an "Enviar" checkbox column,
    and a Config switch for automatic or manual mode. Assumption: switch, default manual.
11. Dashboard tab: orders by state, pending emails, sent-email log.
12. Verify order upload to Sheets and Drive end to end, including the ~90 MB upload through Cloudflare.

## Phase 5: Technical, SEO, performance

13. Metadata, Open Graph image, LocalBusiness structured data, sitemap, robots.
14. Mobile Lighthouse, lazy-load three.js.
15. Final Definition-of-Done walkthrough.

## Open questions (unanswered at time of writing)

1. Manual-only sending or a switch? 2. WhatsApp removed entirely or only the form field? 3. What exactly failed with
   "orders must get uploaded"? 4. Photo or credentials for Antonio Alvear Muñoz?
