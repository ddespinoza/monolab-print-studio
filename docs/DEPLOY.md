# Deployment

Requirements: Node 24 (`nvm install 24`), npm, a persistent disk for `DATA_DIR`, and a single running instance (the rate limiter and the order-number lock live in process memory). Not suitable for serverless hosts: uploads are up to 95 MB per request (Vercel caps bodies at 4.5 MB). Traffic reaches the app through Cloudflare (docs/CLOUDFLARE.md).

## Environment

Copy `.env.example` to `.env` and fill it using docs/GOOGLE-SETUP.md. Production must have `MOCK_APIS=false` (the app refuses to start otherwise).

| Variable                                   | Purpose                                                                            |
| ------------------------------------------ | ---------------------------------------------------------------------------------- |
| `NODE_ENV`                                 | `production`                                                                       |
| `PORT`, `HOST`                             | listen port and address (`127.0.0.1` on the host; `0.0.0.0` inside a container)    |
| `DATA_DIR`                                 | `tmp/` uploads live here; must persist between restarts                            |
| `SITE_URL`                                 | public URL, used in email links                                                    |
| `WHATSAPP_NUMBER`                          | digits with country code (`56948623705`)                                           |
| `CRON_SECRET`                              | Bearer token for `/api/cron/tick`                                                  |
| `CONFIRM_SECRET`                           | signs the quote links (32+ characters); changing it invalidates links already sent |
| `MAX_UPLOAD_MB`                            | per file, max 100 (default 95)                                                     |
| `GOOGLE_*`, `DRIVE_FOLDER_ID`, `SHEET_TAB` | Sheets service account, Drive OAuth, ids                                           |
| `SMTP_*`, `FROM_EMAIL`, `OPERATOR_EMAIL`   | Gmail SMTP and addresses                                                           |

## Option A: Coolify (recommended on this VPS)

The VPS already runs Coolify with a Traefik proxy on ports 80/443. Deploying through Coolify touches nothing outside its own app entry.

1. Coolify > Projects > New resource > **Private repository (with deploy key)** > `ddespinoza/monolab-print-studio`, branch `main`. Build pack: **Nixpacks**.
2. Environment variables: everything in the table above, with `PORT=3000` and `HOST=0.0.0.0`.
3. Persistent storage: mount a volume at `/app/data` (so `data/tmp` survives redeploys).
4. Domains: `https://monolabprintstudio.cl,https://www.monolabprintstudio.cl`. Coolify's Traefik requests certificates by itself; with Cloudflare in front set SSL mode **Full (strict)** only after a certificate exists (or use a Cloudflare Origin certificate in Traefik).
5. Scheduled task (Coolify > the app > Scheduled Tasks): every 5 minutes, command:
   `curl -fsS -H "Authorization: Bearer $CRON_SECRET" http://127.0.0.1:3000/api/cron/tick`
6. Increase any proxy body or timeout limits if you add one; Traefik itself imposes none by default.

## Option B: systemd on the host

Bind the app to localhost and let an existing proxy route to it. Template (create it yourself; nothing here installs automatically):

```
# /etc/systemd/system/monolab.service
[Unit]
Description=Monolab Print Studio
After=network.target

[Service]
WorkingDirectory=/root/monolab
EnvironmentFile=/root/monolab/.env
ExecStart=/root/.nvm/versions/node/v24.22.0/bin/npm run start
Restart=on-failure

[Install]
WantedBy=multi-user.target
```

Build first: `npm ci && npm run build`. Then `systemctl enable --now monolab`. The proxy must reach `127.0.0.1:3100`. A Traefik container cannot see the host's loopback, so either route through the Docker bridge address (set `HOST=172.16.0.1` and firewall port 3100 from the internet) or run a host-side proxy. Do not publish port 3100.

Crontab line (host option):
`*/5 * * * * curl -fsS -H "Authorization: Bearer YOUR_CRON_SECRET" http://127.0.0.1:3100/api/cron/tick >/dev/null 2>&1`

## Updating

`git pull && npm ci && npm run build`, then restart (`systemctl restart monolab`, or a Coolify redeploy). Check `npm run setup:check` after changing credentials.

## Operations notes

- Logs are JSON lines on stdout (`journalctl -u monolab`, or Coolify logs). `order failed`, `status notification failed` and `confirmation email failed` need attention.
- The tick is at-least-once: if the Sheets write fails after an email is sent, that email may repeat once on the next tick.
- Never delete order rows in the middle of the sheet: new order numbers come from the highest `ML-` id in column A.
