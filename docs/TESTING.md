# Testing

1. Unit + integration (Vitest, mocked boundaries): `npm test`. Runs in CI.
2. Smoke (Playwright, MOCK_APIS=true): `npm run smoke` (Phase 8). Local only.
3. Live (gated, real Google and SMTP): `npm run test:live` (Phase 3). Never in CI.
