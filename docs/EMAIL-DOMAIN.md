# contacto@monolabprintstudio.cl

Customers only ever see `contacto@monolabprintstudio.cl`. The operator's Gmail address is internal.

- **Receiving**: Cloudflare Email Routing forwards `contacto@` to the Gmail inbox (docs/CLOUDFLARE.md, section 4). There is no mail server on the VPS.
- **Sending**: the site sends through Gmail SMTP (`smtp.gmail.com:465`, app password) with `From: contacto@monolabprintstudio.cl` and the same Reply-To. Gmail allows it once the address is a verified "Send mail as" alias.

## Order matters

1. Finish Cloudflare Email Routing and confirm that a test mail to `contacto@` lands in Gmail.
2. In Gmail: Settings > See all settings > Accounts > Send mail as > **Add another email address**. Name `Monolab Print Studio`, address `contacto@monolabprintstudio.cl`, untick "Treat as an alias" only if you want replies to be separate (leave it ticked). SMTP server `smtp.gmail.com`, port 465, SSL, your Gmail address and the app password.
3. Gmail sends a confirmation email to `contacto@`; it arrives through the forwarding. Click the link or enter the code.
4. Optionally make it the default "From" address and set "Reply from the same address the message was sent to".

## Test checklist

- [ ] External mailbox to `contacto@` arrives in Gmail (inbox, not spam).
- [ ] Reply from Gmail picking `contacto@` as From arrives at the external mailbox with that sender.
- [ ] `npm run test:live` delivers its one test email.
- [ ] If mail lands in spam: confirm one merged SPF record, check the message headers (`Authentication-Results`), and mark the first messages "Not spam".
