# Cloudflare setup (free plan)

Cloudflare provides DNS, the HTTPS proxy, caching rules and the inbound mail forwarding for `contacto@`. It never runs code for this site: no Workers, Pages or Tunnel. Limits that shape the app: a proxied request body is capped at 100 MB (hence `MAX_UPLOAD_MB=95` and one file per request) and an origin response times out at about 100 seconds.

## 1. Add the site and delegate the nameservers

1. Cloudflare dashboard > Add a domain > `monolabprintstudio.cl` > Free plan.
2. Cloudflare shows two nameservers. At the NIC Chile registrar (https://www.nic.cl, "Mi cuenta" > the domain > Servidores de nombre), replace the nameservers with those two. Propagation can take hours; Cloudflare emails you when it is active.

## 2. DNS records

| Type                | Name     | Content                            | Proxy                |
| ------------------- | -------- | ---------------------------------- | -------------------- |
| A                   | `@`      | the VPS public IP                  | **Proxied** (orange) |
| A                   | `www`    | the VPS public IP                  | **Proxied** (orange) |
| MX, TXT (SPF, DKIM) | `@`      | added by Email Routing (section 4) | DNS only             |
| TXT                 | `@`      | see the SPF note below             | DNS only             |
| TXT                 | `_dmarc` | `v=DMARC1; p=none`                 | DNS only             |

**SPF: only one TXT record may start with `v=spf1`.** Email Routing adds its own; Gmail sending needs Google's. Keep a single merged record:
`v=spf1 include:_spf.mx.cloudflare.net include:_spf.google.com ~all`
Mail sent through Gmail SMTP as `contacto@` is signed by Google, not by your domain, so DMARC alignment fails and `p=none` is the right policy (no mail is rejected). Volume is low, so this is acceptable.

## 3. TLS and caching

1. SSL/TLS > Overview > mode **Full (strict)**.
2. SSL/TLS > Origin Server > Create certificate (RSA, 15 years) for `monolabprintstudio.cl` and `*.monolabprintstudio.cl`. Install it in whatever terminates TLS on the VPS (see docs/DEPLOY.md).
3. Rules > Cache Rules > Create rule: name `Bypass API and confirm pages`; expression `starts_with(http.request.uri.path, "/api/") or starts_with(http.request.uri.path, "/confirmar/")`; action **Bypass cache**. Without it `GET /api/cron/tick` could be served from cache.
4. The crontab on the VPS calls `http://127.0.0.1:3100` directly, so it never touches Cloudflare.

## 4. Inbound mail: Email Routing (replaces running a mail server)

1. Email > Email Routing > Get started / Onboard domain. Accept the MX, SPF and DKIM records it proposes (then merge SPF as above).
2. Destination addresses > add the operator Gmail address > open the verification email in that inbox and confirm.
3. Routing rules > Create address: custom address `contacto` > action **Send to an email** > the Gmail address. Turn the rule on.
4. Do not create other MX records and do not proxy anything under `mail.` (not needed any more).
   Then continue with docs/EMAIL-DOMAIN.md (Gmail "Send mail as").

## 5. Verification checklist

- [ ] `https://monolabprintstudio.cl` loads over HTTPS with a valid certificate and the padlock.
- [ ] `curl -sI https://monolabprintstudio.cl/api/cron/tick` shows `401` and `cf-cache-status: DYNAMIC` or `BYPASS`, never `HIT`.
- [ ] A 90 MB STL uploads end to end (use a file near the limit; the progress bar completes and the order is created).
- [ ] An email to `contacto@monolabprintstudio.cl` from another mailbox reaches the Gmail inbox.
- [ ] A reply sent from Gmail as `contacto@` arrives with that sender and is not in spam.
- [ ] Two phones on different networks can each place an order without hitting each other's rate limit (the app keys on `CF-Connecting-IP`).
