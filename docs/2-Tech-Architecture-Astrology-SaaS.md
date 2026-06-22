# 🏗️ Deliverable 2 — Technical Architecture & Stack

**Product:** Astrology Consultant SaaS Platform
**Version:** 2.0 (Phase 1 — expanded scope)
**Date:** June 2026
**Optimized for:** Solo founder / small team — managed services, minimal DevOps.

---

## 1. Guiding Architectural Principles
1. **Money never touches our infrastructure.** We only *initiate* payments using the consultant's own credentials and *read* the success webhook. No funds, escrow, or wallets — ever.
2. **Lean ops.** Managed/serverless services so one or two people can run this. No Kubernetes/self-hosted DB in Phase 1.
3. **Org-based multi-tenancy.** Tenant = consultant *org* (with team members). One app, one database, scoped by `org_id` with row-level isolation.
4. **Config as data.** Feature flags, themes, fonts, plans live in the DB so Super Admin changes behavior without deploys.
5. **Mobile-first, Indic-first.** SSR for fast first paint; i18n + web-font loading first-class.
6. **Secure by default.** Consultant gateway secrets envelope-encrypted; secrets never logged.
7. **Pluggable payment connections.** The connection method (manual keys now, OAuth later) is abstracted behind an interface so adding OAuth doesn't disturb payment initiation.
8. **Atomic scheduling.** Double-booking is prevented at the database level, not just in app logic.

---

## 2. Recommended Stack
| Layer | Choice | Rationale |
|---|---|---|
| Frontend | Next.js (React) + Tailwind | SSR/ISR for fast branded booking pages; one framework for app + marketing + dashboards. |
| i18n | next-intl / i18next | Hindi/English/Hinglish; per-locale rendering. |
| Backend | Next.js API routes (NestJS later if logic grows) | Single deployable in Phase 1. |
| Database | **Neon (managed PostgreSQL)** | Pure Postgres + per-PR DB branching; **GiST exclusion constraints** for no-double-book; RLS for tenancy. |
| ORM | Prisma | Type-safe; easy migrations; Auth.js adapter. |
| Auth | **Auth.js (self-hosted in Neon)** | Roles (super_admin, consultant, team_consulting, team_accounts, seeker); Google provider + custom email-OTP; users live in our own DB (no auth-vendor sync). |
| File storage | **Cloudflare R2** | S3-compatible, **zero egress**; logos, payment-proof screenshots, uploaded chart files. |
| Hosting | **Cloudflare (Pages/Workers via OpenNext adapter)** | Runs Next.js in **Node.js runtime mode** (`nodejs_compat`) — supports PDF generation, crypto, and Prisma/Postgres; consolidates hosting with DNS/R2/CDN. |
| DNS / CDN / SSL / WAF | **Cloudflare** | Domain + routing; caches/protects public booking pages; hosts SPF/DKIM/DMARC. |
| Email | **Resend** | OTP codes + receipts + call links; React Email (JSX templates); 3,000/mo free tier. |
| WhatsApp (later) | BSP (Gupshup/AiSensy) | Deferred to fast-follow. |
| Consultant payments | Razorpay (manual BYO-keys) | Direct-to-consultant; UPI 0% TDR; best docs. Cashfree/PhonePe later. |
| Our subscription billing | Razorpay Subscriptions / Stripe | Recurring billing for plans + per-seat. |
| Calendar / Meet | Google Calendar + Meet API; .ics | Free; auto-creates Meet link + event on confirm. |
| Secrets | Envelope encryption (master key in a Cloudflare Worker secret / env now; managed KMS later) | Store consultants' gateway keys safely; no bundled cloud KMS in Phase 1. |
| Jobs | Cloudflare Cron Triggers / Queues (or Inngest/QStash) | Webhook reconciliation, manual-proof expiry, reminders, reassignment. |
| PDF | @react-pdf/renderer | Receipts + seeker-profile export; serverless-friendly. |
| Monitoring | Sentry + provider analytics | Errors, performance, audit. |

> **Why Cloudflare hosting + Neon Postgres (not Firebase):** The OpenNext Cloudflare adapter runs Next.js in **full Node.js mode** on Workers (enable `nodejs_compat`, compatibility date ≥ 2024-09-23), so PDF generation, crypto, and Prisma/Postgres all work — hosting consolidates cleanly with DNS/R2/CDN on one platform. The database stays **Neon Postgres** (not Firestore) because the booking engine uses **variable-length, booker-selectable durations** (15/30/45/60 min) that create overlapping time ranges; detecting overlap needs range conditions on two fields at once, which Firestore cannot express in a single query, whereas Postgres enforces it natively with a one-line **GiST exclusion constraint**. Neon sits just outside Cloudflare but integrates with Workers via its serverless driver. (Trade-off accepted: the OpenNext adapter needs some config — `nodejs_compat` flag, marking `@prisma/client`/`postgres` as external packages — and trails Vercel slightly on newest-feature parity; both are one-time/minor costs.)

---

## 3. System Architecture

### 3.1 Logical components
- **Marketing/Landing site** — entry point; consultant signup/login.
- **Public Booking Site** — per-consultant, branded, localized; slug-resolved; SSR.
- **Consultant Dashboard** — onboarding, packages (event types), availability, limits, booking questions, branding, payments, GST, teams, seeker profiles, feedback, preview.
- **Team Surfaces** — Consulting (assigned bookings, seeker notes/chart upload) and Accounts (payments/receipts) views with role isolation.
- **Super Admin Console** — tenant CRUD, plans + per-seat, feature flags, oversight, our billing, catalogs.
- **Scheduling Engine** — availability computation, slot generation, round-robin assignment, atomic booking.
- **Integration Layer** — Google Calendar/Meet, payment gateways (pluggable), email, (WhatsApp later).
- **Notification Service** — templated, localized email dispatch + idempotency log.
- **Jobs/Workers** — reconciliation, manual-proof expiry, reminders, seat-removal reassignment.

### 3.2 Booking request flow (text)
```
Seeker (mobile) → consultant.platform.com/<slug>
   → Next.js SSR resolves org + branding + packages + availability
   → seeker picks package + slot, fills required questions, accepts ToS
   → Checkout:
        Gateway mode → consultant's Razorpay (their keys) → money to consultant's bank
                     → webhook (payment.captured) → our backend (idempotent) → confirm
        QR mode → seeker pays externally → uploads proof + UTR → pending
                     → consultant/accounts confirms
   → Scheduling Engine: round-robin picks an eligible free consulting member (atomic)
   → Google Meet/Calendar: create link + event on assigned host
   → Notification Service: email receipt + call link
```

### 3.3 Multi-tenancy model
- **Single Postgres DB**; every tenant-scoped table carries `org_id`.
- **Row-Level Security** so a consultant/team member only accesses their org's rows; Super Admin bypasses for oversight.
- **Team members** are users linked to an org with a role (`team_consulting` | `team_accounts`).
- **Slug-based routing** maps public URL → org. Phase 1: path-based (`platform.com/<slug>`) for SSL simplicity.

---

## 4. Scheduling Engine (the biggest net-new build)

### 4.1 Concepts (mapped from Cal.id)
- **Event type = package**: title, slug, description, per-package price, allowed durations, default duration, location (Google Meet), assigned availability schedule, limits, booking questions.
- **Availability schedule**: named, reusable; weekly hours with multiple ranges/day, copy-to-day, date overrides, per-slot timezone display.
- **Limits**: before/after buffers, minimum notice, time-slot intervals, booking frequency caps (per day/week/month).

### 4.2 Availability computation
- A host's free set = (working hours ∩ overrides) − (busy across all connected calendars) − (existing platform bookings) − buffers, respecting min-notice and frequency caps.
- **Round-robin** (auto-assign): offered slots = **union** of all consulting members' free sets.
- Re-verify availability at confirm time (don't trust stale cache) to avoid double-booking.

### 4.3 Round-robin assignment (always auto)
1. For the chosen slot, compute eligible hosts (free, within limits).
2. Fairness order: (priority desc, weight-adjusted booking count asc, last-assigned asc) → pick top.
3. Atomic reservation in a DB transaction guarded by a **GiST exclusion constraint** on `(host_id, tstzrange)` → overlapping inserts rejected even under concurrency.
4. On host removal/no-show → reassign via the same path.

### 4.4 Why DB-level atomicity
App-only checks race under concurrency. `EXCLUDE USING gist (host_id WITH =, slot_range WITH &&)` makes the database the final arbiter — a hard invariant against double-booking.

---

## 5. Payments Architecture

### 5.1 Manual BYO-keys (Phase 1 chosen model)
- Consultant pastes their own gateway `key_id` + `key_secret` in settings.
- Secrets **envelope-encrypted** (KMS data key per row); plaintext only in memory at payment time; never logged.
- At checkout, backend creates the order/payment on the **consultant's** gateway account → funds settle to **their** bank.
- Subscribe to their webhook → on `payment.captured`, confirm booking.

### 5.2 Pluggable connection interface (future-proofing)
- A `PaymentConnection` interface abstracts *how* we hold credentials: `ManualKeysConnection` now; `OAuthConnection` later.
- Payment *initiation* and *webhook handling* depend on the interface, not the connection method → adding OAuth is additive, no rewrite.

### 5.3 Why not Route / Easy Split
Route/Easy Split make the platform the collector that splits funds — reintroducing fund-handling and RBI PA-style obligations. Manual/OAuth direct-settlement keeps us pure software.

### 5.4 Idempotency & reconciliation
- `payments.gateway_payment_ref` unique → replayed webhooks are no-ops; also dedupe on gateway event id.
- Cron reconciliation polls pending gateway payments for missed webhooks.
- Manual (QR) flow is consultant-confirmed, webhook-independent.

### 5.5 Subscription billing (our revenue)
- Separate, using **our** gateway (Razorpay Subscriptions / Stripe).
- **Per-seat**: base plan + N team seats; proration on add/remove.
- Failed payment → dunning → grace → suspend booking page on lapse.

---

## 6. Security, Compliance & Privacy
| Concern | Approach |
|---|---|
| Gateway secrets | Envelope encryption (KMS); never logged; decrypt only in-memory at use. |
| Auth & roles | Managed provider; RBAC for 5 roles; team isolation. |
| Tenant isolation | Postgres RLS + `org_id` scoping. |
| PCI scope | Hosted checkout keeps consultants at lightest tier; we never handle card data. |
| RBI PA regime | Out of scope by design — never collect/settle funds (confirm with legal opinion). |
| ToS shield | `bookings.tos_accepted_at` timestamped per checkout. |
| Share links | CSPRNG token; store SHA-256 hash only; expiry + revoke; `noindex` + `Cache-Control: private`. |
| Sensitive data | Birth details / reading notes treated as sensitive; access-scoped to org + role. |
| Audit | Notification log + super-admin action log. |

---

## 7. Localization & Theming
- **Locale**: seeker choice (Hindi/English/Hinglish) overrides consultant default; stored in URL/cookie.
- **Fonts**: curated set (Noto Sans Devanagari + Latin); per consultant choice; `font-display: swap`; fallback to Noto default for missing glyphs.
- **Theme**: consultant color injected as CSS variables; enforce minimum contrast ratio.

---

## 8. Environments & DevOps (lean)
| Environment | Purpose |
|---|---|
| Local | Postgres (Docker or a Neon dev branch) + seeded data; `opennextjs-cloudflare preview` runs the app in the workerd runtime locally. |
| Preview | Per-PR Cloudflare preview deploy + **Neon DB branch** (isolated copy for safe migration testing). |
| Production | Cloudflare (Pages/Workers via OpenNext) + Neon Postgres + Cloudflare R2 + envelope-encryption master key (Cloudflare Worker secret). |

- CI/CD: GitHub → Cloudflare deploy (Wrangler/OpenNext); migrations via Prisma on deploy.
- Backups: Neon point-in-time recovery.
- DNS/SSL/CDN/WAF via Cloudflare; SPF/DKIM/DMARC for Resend in Cloudflare DNS.
- Observability: Sentry + web-vitals; structured logs (no secrets).
- **OpenNext config:** enable `nodejs_compat`, set compatibility date ≥ 2024-09-23, and add `@prisma/client`, `.prisma/client`, `postgres` to `serverExternalPackages` so the workerd-specific Postgres entrypoint is used.

---

## 9. Scaling Path (later)
- Start monolith; extract Notification Service + Jobs first under load.
- Read replicas before sharding.
- Queue for notification fan-out (Inngest/QStash already).
- Add gateways (Cashfree/PhonePe) + OAuth behind existing payment interface.
- CDN/edge caching for public booking pages.

---

## 📝 Summary
- **Stack:** Next.js + Postgres + managed services — solo/small-team friendly.
- **Scheduling engine** is the biggest build: availability across team calendars, round-robin auto-assign, **DB-level atomic no-double-book** (GiST exclusion).
- **Payments:** manual BYO-keys now behind a **pluggable connection interface** so OAuth slots in later; **Route avoided**.
- **Tenancy:** org-based, RLS, 5 roles, slug routing.
- **Security/privacy:** envelope-encrypted secrets, hashed revocable share links, sensitive-data scoping; outside RBI PA regime by design.
