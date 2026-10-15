# Testing

1. Unit + integration (Vitest, mocked boundaries): `npm test`. Runs in CI.
2. Smoke (Playwright, MOCK_APIS=true): `npm run smoke` (Phase 8). Local only.
3. Live (gated, real Google and SMTP): `npm run test:live` (Phase 3). Never in CI.

## Commands (current)

- `npm test`: unit and integration (Vitest), including the route handlers against the mock runtime.
- `npm run smoke`: regenerates fixtures (`npm run fixtures`), boots its own dev server on 127.0.0.1:3101 with `DATA_DIR=./data/smoke`, and runs the Playwright specs in Chromium: upload, metrics, two sequential orders (ML-0001, ML-0002), error messages, auto-fit and the oversize block.
- `npm run test:live`: real Drive, Sheets and SMTP (needs `.env` with credentials; refuses mock mode and production).
- `npm run check:rules`: no Gmail address in customer-facing paths, no hex literals outside the tokens and the email colour map.
