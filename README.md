# Monolab Print Studio

Order intake for a dental resin 3D-printing service. Customers upload STL, OBJ or PLY files, preview them in 3D, and request a quote. The Google Sheet is the database and the operator's only panel; status and quote emails go out by themselves.

- Spec and decisions: `docs/SPEC.md` (original brief) and `DECISIONS.md` (every change and why).
- Architecture: `docs/ARCHITECTURE.md`. Tests: `docs/TESTING.md`.
- Setup: `docs/GOOGLE-SETUP.md`, `docs/CLOUDFLARE.md`, `docs/EMAIL-DOMAIN.md`, `docs/DEPLOY.md`. Operator guide (Spanish): `docs/OPERADOR-es.md`.

## Develop

```
nvm use            # Node 24
npm ci
cp .env.example .env   # MOCK_APIS=true works with no credentials
npm run dev        # http://127.0.0.1:3100
npm test           # unit and integration
npm run smoke      # Playwright, in mock mode
npm run lint && npm run build
```

Mock mode writes a fake sheet, Drive and outbox under `data/mock/`. To simulate the operator, edit `data/mock/pedidos.json` (Estado `Cotizado`, fill Cotización) and call `GET /api/cron/tick` with the Bearer secret.

Real services: `npm run setup:oauth`, `npm run setup:sheet`, `npm run setup:check`, `npm run test:live` (see docs/GOOGLE-SETUP.md).

Run `npm run brand` after replacing `brand/logo-source.svg`. `npm run check:rules` verifies that no Gmail address reaches a customer-facing file and that colours come only from the tokens.

## Inicio rápido (español)

1. `nvm use && npm ci && cp .env.example .env`
2. Para probar sin credenciales deje `MOCK_APIS=true` y ejecute `npm run dev`; abra http://127.0.0.1:3100.
3. Para producción siga `docs/GOOGLE-SETUP.md`, luego `docs/CLOUDFLARE.md` y `docs/DEPLOY.md`.
4. La rutina diaria del operador está en `docs/OPERADOR-es.md`.
