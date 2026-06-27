# 6 — Production Deployment Runbook (SP-6.4)

Go-live target: **https://astro.hifiai.in** on Cloudflare Workers via OpenNext.

The app is already deploy-ready — `opennextjs-cloudflare build` has stayed green throughout development (no edge
runtime, no `middleware.ts`/`proxy.ts`, Workers-safe Node APIs under `nodejs_compat`). This runbook is the ordered
set of **manual** steps to take it live. Steps marked **[manual]** require interactive auth on your own
accounts (Cloudflare / Google / Hostinger / Neon) and cannot be automated from the repo.

---

## 0. Pre-launch toggles — ✅ cleared 2026-06-27

These deliberate development settings have now been flipped for go-live:

| Setting | File | State |
| --- | --- | --- |
| `EMAILS_GLOBALLY_PAUSED` | `lib/platform-settings.ts` | **`false` — email ACTIVE.** Sends are now governed by the per-type/master switches in `/superadmin/settings` (default enabled). |
| `MASTER_OTP_ENABLED` | `lib/otp.ts` | **`false` — fixed `123456` backdoor DISABLED.** Sign-in uses real issued OTP codes only. |
| `SUPERADMIN_EMAIL` | env | **Set to `chhabra.jitesh4@gmail.com`** (a real address; already a `super_admin`). |

> A leftover dev `super_admin` row (`admin@astro.local`) also exists from early seeding — harmless (no one can
> authenticate as it: no Google account, no deliverable OTP), but you may demote it for tidiness.

Also note: `sendEmail` short-circuits under the test runner (`process.env.VITEST`), so the suite never hits Resend.

---

## 1. Pre-flight (local) — confirm still deploy-ready

```bash
npm run lint
npm run build
npx opennextjs-cloudflare build      # must complete; produces .open-next/worker.js
wrangler login                       # [manual] interactive — authorizes wrangler to your Cloudflare account
```

---

## 2. Environment variables matrix

Set **secrets** with `wrangler secret put <NAME>` (encrypted, never in the repo). Set **plaintext vars** either with
`wrangler secret put` too (simplest) or as a `"vars": { ... }` block in `wrangler.jsonc`. Sensitive = Secret.

| Variable | Type | Prod value / notes | Differs from dev? |
| --- | --- | --- | --- |
| `DATABASE_URL` | **Secret** | Neon **pooled** connection string, must include `sslmode=require` | same Neon project as dev |
| `AUTH_SECRET` | **Secret** | `openssl rand -base64 32` (or `npx auth secret`) | new random value for prod |
| `AUTH_URL` | var | `https://astro.hifiai.in` | **yes** (dev: `http://localhost:3001`) |
| `GOOGLE_CLIENT_ID` | var | OAuth client ID | same client OK |
| `GOOGLE_CLIENT_SECRET` | **Secret** | OAuth client secret | same client OK |
| `RESEND_API_KEY` | **Secret** | Resend prod key (verified sending domain) | yes (dev can be blank) |
| `EMAIL_FROM` | var | `Astro Consultancy <bookings@mail.hifiai.in>` (Resend-verified) | default is fine |
| `ENCRYPTION_MASTER_KEY` | **Secret** | `openssl rand -base64 32`. **Set once — never rotate:** changing it makes ALL existing encrypted payment secrets undecryptable. | must match whatever encrypted existing rows |
| `BILLING_WEBHOOK_SECRET` | **Secret** | strong random; billing webhooks are rejected when empty | yes |
| `BILLING_CRON_SECRET` | **Secret** | strong random; cron + `/api/debug/sentry` are rejected when empty | yes |
| `R2_ACCOUNT_ID` | var | Cloudflare R2 account id | same |
| `R2_ACCESS_KEY_ID` | **Secret** | R2 S3 access key | same |
| `R2_SECRET_ACCESS_KEY` | **Secret** | R2 S3 secret | same |
| `R2_BUCKET` | var | `astro-uploads` (exists since PB-1) | same |
| `GOOGLE_AI_STUDIO_API_KEY` | **Secret** | Gemini key (SP-4.6, `lib/gemini.ts`). Empty → AI helpers hidden (non-fatal). | optional |
| `SENTRY_DSN` | **Secret** | server DSN (inert when empty) | yes |
| `NEXT_PUBLIC_SENTRY_DSN` | var | browser DSN (inlined into the client bundle) | yes |
| `SUPERADMIN_EMAIL` | var | **real** operator address (see blocker §0) | yes |
| `PLATFORM_GST_NUMBER` / `PLATFORM_LEGAL_NAME` | var | receipt identity | optional |

> `NODE_ENV` is `production` automatically on Workers — do not set it manually.

Example:
```bash
wrangler secret put DATABASE_URL
wrangler secret put AUTH_SECRET
wrangler secret put GOOGLE_CLIENT_SECRET
wrangler secret put RESEND_API_KEY
wrangler secret put ENCRYPTION_MASTER_KEY
wrangler secret put BILLING_WEBHOOK_SECRET
wrangler secret put BILLING_CRON_SECRET
wrangler secret put R2_ACCESS_KEY_ID
wrangler secret put R2_SECRET_ACCESS_KEY
wrangler secret put GOOGLE_AI_STUDIO_API_KEY
wrangler secret put SENTRY_DSN
# plaintext vars — either `wrangler secret put` each, or add a "vars" block in wrangler.jsonc:
wrangler secret put AUTH_URL                # https://astro.hifiai.in
wrangler secret put GOOGLE_CLIENT_ID
wrangler secret put R2_ACCOUNT_ID
wrangler secret put R2_BUCKET
wrangler secret put EMAIL_FROM
wrangler secret put SUPERADMIN_EMAIL
wrangler secret put NEXT_PUBLIC_SENTRY_DSN
```

---

## 3. Google OAuth redirect URIs — [manual]

Google Cloud Console → **APIs & Services → Credentials** → open the OAuth 2.0 Client used by the app →
**Authorized redirect URIs** → add **both** production URIs (keep the existing localhost ones for dev):

```
https://astro.hifiai.in/api/auth/callback/google      (sign-in)
https://astro.hifiai.in/api/calendar/callback         (Track-I Google Calendar connect)
```

On the **OAuth consent screen**, confirm these scopes are present (for calendar):
```
https://www.googleapis.com/auth/calendar.events
https://www.googleapis.com/auth/calendar.readonly
```
Save. (Changes can take a few minutes to propagate.)

---

## 4. DNS — [manual] (domain: astro.hifiai.in, zone stays at Hostinger)

**Important:** Cloudflare Workers can only serve a custom hostname whose **zone is on Cloudflare**. A plain Hostinger
`CNAME astro → astro-consultancy.workers.dev` will **not** serve `astro.hifiai.in` on its own. Pick one path:

### Path A — delegate just the `astro` subdomain to Cloudflare (recommended; keeps hifiai.in at Hostinger)
1. In the **Cloudflare dashboard → Add a site**, enter `astro.hifiai.in` (a subdomain zone). Cloudflare assigns two
   nameservers, e.g. `xxx.ns.cloudflare.com` / `yyy.ns.cloudflare.com`.
2. At **Hostinger** (DNS zone for `hifiai.in`), add **NS records** delegating the subdomain:
   ```
   Type: NS   Name: astro   Value: xxx.ns.cloudflare.com
   Type: NS   Name: astro   Value: yyy.ns.cloudflare.com
   ```
   (The rest of `hifiai.in` stays at Hostinger.)
3. Once the subdomain zone is **Active** in Cloudflare: open the Worker `astro-consultancy` → **Settings → Domains &
   Routes → Add → Custom Domain** → `astro.hifiai.in`. Cloudflare creates the DNS record + TLS cert automatically.
   (Optionally uncomment the `routes` block in `wrangler.jsonc` to manage this from config instead.)

### Path B — fastest interim (no DNS work)
Deploy and run on the free Workers URL: `https://astro-consultancy.<account>.workers.dev`. Temporarily set
`AUTH_URL` + the Google redirect URIs to that host, then switch to `astro.hifiai.in` once Path A is done.

### Path C — keep ALL DNS at Hostinger (Cloudflare for SaaS / Custom Hostnames)
More involved: enable **Cloudflare for SaaS**, add `astro.hifiai.in` as a Custom Hostname, point a Hostinger
`CNAME astro → <your SaaS fallback>.workers.dev`, and add the TLS-validation `TXT`/`CNAME` record Cloudflare requests.
Use only if you can't delegate the subdomain.

---

## 5. Neon database

- Confirm `DATABASE_URL` is the **Neon pooled** string and includes `sslmode=require` (the serverless driver also
  uses TLS over WSS; keep `sslmode=require` in the URL).
- Same Neon project as dev → already migrated + seeded. If any migration is pending, apply it safely:
  ```bash
  npx prisma migrate deploy        # applies pending migrations; never resets data
  ```
- Ensure the seeded `super_admin` user's email equals the **real** `SUPERADMIN_EMAIL`. If dev seeded a placeholder,
  re-run the seed with the prod env so the upsert sets the real address:
  ```bash
  # with prod DATABASE_URL + SUPERADMIN_EMAIL in env:
  npm run prisma:seed              # idempotent: upserts super_admin + catalogs
  npm run seed:demo                # idempotent: creates the demo consultant (/pandit-demo-sharma)
  ```

---

## 6. R2 storage

- The `astro-uploads` bucket already exists (PB-1) — **no bucket policy changes needed**.
- Just confirm the four vars are set: `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`.
- Access is via the S3-compatible client (`lib/storage.ts`), which builds the endpoint
  `https://<R2_ACCOUNT_ID>.r2.cloudflarestorage.com` — no Workers R2 binding required.

---

## 7. Build + deploy

```bash
npm run build
npx opennextjs-cloudflare build
npx wrangler deploy                 # or: npm run deploy  (build + deploy)
```

---

## 8. Sentry verification

1. Ensure `SENTRY_DSN` (+ `NEXT_PUBLIC_SENTRY_DSN`) are set as secrets/vars and redeploy.
2. Trigger the guarded test error:
   ```bash
   curl -X POST https://astro.hifiai.in/api/debug/sentry -H "x-cron-secret: <BILLING_CRON_SECRET>"
   ```
3. Confirm the event "SP-6.4 deliberate Sentry test error…" appears in the Sentry dashboard.
4. Remove `app/api/debug/sentry/route.ts` (or leave it — it's secret-guarded) once verified.

---

## 9. Deferred / post-launch (documented, not blocking go-live)

- **Cloudflare Cron Triggers** for the three cron routes (`/api/cron/billing-dunning`, `/api/cron/expire-holds`,
  `/api/cron/reconcile-seats`) are not yet wired (they need a scheduled handler that OpenNext routes to them). Until
  then: holds won't auto-expire, dunning + seat-reconcile won't run automatically. Wire these as a follow-up (or POST
  them from an external scheduler with the `x-cron-secret` header).
- The email-pause + OTP-backdoor toggles from §0.

---

## 10. Production verification checklist (the go-live gate)

Run after deploy + DNS active:

- ☐ `https://astro.hifiai.in/` (home) loads correctly
- ☐ `/signin` — Google OAuth completes end-to-end
- ☐ `/signin` — email + OTP completes *(needs emails un-paused to receive a real code; §0)*
- ☐ `/superadmin` is reachable by the `SUPERADMIN_EMAIL` account
- ☐ `/pandit-demo-sharma` (demo consultant) loads
- ☐ demo booking flow (`/pandit-demo-sharma?demo=1`) completes through the success screen with **no DB write**
- ☐ an OTP email actually arrives in an inbox *(after un-pausing emails)*
- ☐ `https://astro.hifiai.in/api/health` → `{"status":"ok","service":"astro-consultancy"}`
- ☐ the deliberate `/api/debug/sentry` error appears in the Sentry dashboard

When every box is checked, the platform is **live**. 🎉
