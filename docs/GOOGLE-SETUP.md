# Google and Gmail setup

You need four things: a **service account** (for the Sheet), an **OAuth refresh token** (for Drive), the **Drive folder**, and a **Gmail app password** (to send mail). Work in this order. Everything goes into `.env` (never committed).

Why two Google credentials: a service account has no storage quota of its own, so it cannot save files into a personal Gmail Drive. Drive therefore uses your own Gmail account through OAuth. See DECISIONS.md.

## 1. Google Cloud project and APIs

1. Open https://console.cloud.google.com and create a project named `monolab`.
2. APIs & Services > Library: enable **Google Sheets API** and **Google Drive API**.

## 2. Service account (Sheets)

1. IAM & Admin > Service Accounts > Create service account, name `monolab-sheets`. No roles needed.
2. Open it > Keys > Add key > Create new key > **JSON**. A file downloads.
3. From that file copy into `.env`:
   - `GOOGLE_SERVICE_ACCOUNT_EMAIL` = `client_email`
   - `GOOGLE_PRIVATE_KEY` = `private_key`, as one line keeping the literal `\n` sequences, in double quotes.
4. Create the Google Sheet (any name, e.g. "Monolab Pedidos"). Share it with the service account email as **Editor**.
5. `GOOGLE_SHEET_ID` is the long id in the sheet URL: `docs.google.com/spreadsheets/d/<ID>/edit`.
6. Leave `SHEET_TAB=Pedidos`. Run `npm run setup:sheet` (below) to create the tabs.

## 3. OAuth client (Drive)

1. APIs & Services > OAuth consent screen > User type **External**. App name `Monolab`, your email as support and developer contact.
2. Scopes: add `.../auth/drive`. Test users: add the Gmail account that will own the folder.
3. **Publishing status: click "Publish app" so it is "In production".** In "Testing" the refresh token expires after 7 days and uploads will start failing. Google shows an "unverified app" warning for your own account; choose Advanced > continue. Verification is not needed for personal use.
4. Credentials > Create credentials > OAuth client ID > **Desktop app**. Copy `GOOGLE_OAUTH_CLIENT_ID` and `GOOGLE_OAUTH_CLIENT_SECRET` into `.env`.
5. Run `npm run setup:oauth` (on the VPS: `! npm run setup:oauth` from Claude Code). Open the URL, approve with the Gmail account that owns the folder, then paste the address the browser ends on (the page fails to load; that is expected). Copy the printed `GOOGLE_OAUTH_REFRESH_TOKEN=...` line into `.env`.

## 4. Drive folder

1. In that same Gmail account's Drive, create a folder `Monolab Pedidos`. Open it and copy the id from the URL (`drive.google.com/drive/folders/<ID>`) into `DRIVE_FOLDER_ID`.
2. Each order creates a subfolder named like `ML-0001 - A.P.` inside it. Files are never shared publicly.

## 5. Gmail app password (sending)

1. Google Account > Security > turn on **2-Step Verification**.
2. Security > 2-Step Verification > App passwords > create one named `Monolab`.
3. `.env`: `SMTP_USER` = the Gmail address, `SMTP_PASS` = the 16-character app password. `OPERATOR_EMAIL` = where new-order notifications go. Keep both Gmail addresses private: they are never shown on the site.
4. Make `contacto@monolabprintstudio.cl` a verified sender: Gmail > Settings > Accounts > Send mail as > Add another email address > SMTP `smtp.gmail.com`, port 465, same app password. The verification code arrives through the forwarding set up in docs/EMAIL-DOMAIN.md, so do that first.

## 6. Other `.env` values

`WHATSAPP_NUMBER=56948623705` (digits, country code), `SITE_URL=https://monolabprintstudio.cl`, `FROM_EMAIL=contacto@monolabprintstudio.cl`, `CRON_SECRET` and `CONFIRM_SECRET` (generate with `openssl rand -hex 32`), `MOCK_APIS=false`.

## 7. Verify

```
npm run setup:sheet   # creates tabs, headers, Estado dropdown, email templates, Config defaults
npm run setup:check   # env, Sheets access, Drive folder access, SMTP login (read-only)
npm run test:live     # writes a TEST folder and row, sends one email to OPERATOR_EMAIL, then cleans up
```

After `setup:sheet`, open the **Config** tab and replace the pickup address and schedule placeholders.
