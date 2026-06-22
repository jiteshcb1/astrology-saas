# 🛠️ Deliverable 5 — Implementation Plan (AI-Ready, Step-by-Step)

**Product:** Astrology Consultant SaaS Platform
**Version:** 1.0
**Date:** June 2026
**Audience:** Solo founder / small team building with the help of Claude Code.
**Written from the lens of:** a 10-year Product Engineer + Product Manager + Product Designer.

> **How to use this document with Claude Code.** Each step has an ID (e.g. `SP-1.2`), an objective, dependencies, a concrete build checklist, and a ready-to-paste **Claude Code prompt**. Work top to bottom within a track; respect the dependency notes for parallel tracks. After each step, run the **Definition of Done** checks before moving on. Keep this file in your repo (e.g. `/docs/implementation-plan.md`) so Claude Code can read it for context.

---

## 0. How This Plan Is Structured

### 0.1 The build philosophy (why this order)
The product is **interdependent across stakeholders** — a booking can't exist without a package, a package can't exist without an org, an org can't exist without auth. So we build **foundations first**, then move **outward by stakeholder layer**, running **parallel tracks** wherever a dependency doesn't block.

Three guiding rules from experience:
1. **Build the control plane before the features.** Auth, roles, tenancy, and a thin Super Admin come first — everything hangs off them.
2. **Build the riskiest core early.** The scheduling engine (atomic no-double-book + cross-calendar availability) is the highest technical risk; get it right before teams layer on.
3. **Prove the money + booking loop end-to-end on one consultant** before adding teams, profiles, and polish.

### 0.2 Sub-phases (sequential spine)
- **SP-1 Foundation & Super Admin**
- **SP-2 Consultant Core (Admin)**
- **SP-3 Scheduling Engine**
- **SP-4 Public Booking + Payments**
- **SP-5 Teams & Round-Robin**
- **SP-6 Seeker Profile, Feedback & Polish**

### 0.3 Parallel tracks (run alongside the spine)
- **Track D (Design System):** tokens, components, localization scaffolding — start at SP-1, feeds every UI step.
- **Track I (Integrations):** Google Calendar/Meet, email, payment SDKs — built as adapters, consumed by SP-3/SP-4.
- **Track X (External approvals):** Razorpay Partner/OAuth application, WhatsApp BSP onboarding, legal opinion on PA scope — paperwork that takes calendar time; start day 1, lands in later phases.

### 0.4 What "AI-ready" means here
Each step is scoped so a single Claude Code session can complete it without holding the whole system in context. Prompts specify: the files to touch, the contracts (types/schemas), the tests to write, and the Definition of Done. Build vertically (DB → API → UI → test) per step.

---

## 1. Pre-Build Setup (do once, before SP-1)

### Step PB-1 — Decisions & accounts
**Objective:** lock external choices so code doesn't churn.

**Finalized infrastructure stack (locked):**
| Concern | Provider | Notes / free tier |
|---|---|---|
| Domain + DNS | **Cloudflare** | Where `astro.<domain>`/`<domain>/<slug>` resolves; also hosts SPF/DKIM/DMARC records for email. |
| Storage | **Cloudflare R2** | S3-compatible, **zero egress fees**; logos, payment-proof screenshots, uploaded chart files. |
| CDN / SSL / WAF | **Cloudflare** | Free tier; protects + caches public booking pages. |
| App hosting | **Cloudflare (Pages/Workers via OpenNext adapter)** | Runs Next.js in **Node.js runtime mode** (nodejs_compat) — supports PDF generation + crypto + Prisma/Postgres. Consolidates hosting with DNS/R2/CDN. |
| Database | **Neon (managed PostgreSQL)** | Pure Postgres + per-PR DB branching; required for the GiST exclusion constraint (no-double-book) which Firestore cannot express for variable-duration overlaps; works from Workers via serverless driver. |
| Auth | **Auth.js (self-hosted in Neon)** | Google provider + custom email-OTP; users live in our own DB; free. |
| Email | **Resend** | 3,000 emails/mo free (100/day cap); React Email (JSX templates); sends **OTP codes + receipts + call links**. |
| Errors/monitoring | **Sentry** | Free tier. |
| Consultant payments | **Razorpay (manual BYO-keys)** | Direct-to-consultant; set up in SP-2.4 (Phase 1). |
| Our subscription billing | **Razorpay Subscriptions / Stripe** | Our revenue; set up in SP-1.6. |

> **Why Cloudflare hosting (and not Firebase DB):** The OpenNext adapter runs Next.js in full Node.js mode on Cloudflare Workers (enable `nodejs_compat`, compatibility date ≥ 2024-09-23), so PDF generation and crypto work — hosting consolidates cleanly with DNS/R2/CDN. The database stays **Neon Postgres** (not Firestore) because the booking engine uses **variable-length durations (15/30/45/60 min, booker-selectable)** that create overlapping time ranges; detecting overlap needs range conditions on two fields at once, which Firestore cannot express in a single query, whereas Postgres enforces it natively with a one-line GiST exclusion constraint. Neon sits just outside Cloudflare but integrates with Workers.

**Actions:**
- Create accounts: **GitHub, Cloudflare (domain + R2 + Workers/Pages), Neon, Resend, Sentry.** (No separate hosting vendor — Cloudflare hosts; no separate auth vendor — Auth.js self-hosted; no separate storage vendor — R2 is in Cloudflare.)
- In Cloudflare: add the domain/subdomain; create an R2 bucket; generate R2 S3-compatible credentials; enable Workers/Pages.
- In Resend: add the sending domain and create the **SPF, DKIM, and DMARC DNS records in Cloudflare** (deliverability for OTP + receipts depends on this — do it now, not later).
- Draft the env var list: `DATABASE_URL` (Neon), `AUTH_SECRET` + `GOOGLE_CLIENT_ID/SECRET` (Auth.js), `R2_*` (storage), `RESEND_API_KEY` (email), `SENTRY_DSN`.
- Start **Track X** now: apply for a Razorpay account; begin Razorpay Partner enquiry (for Phase 2 OAuth); book a legal consult on "no-fund-handling = outside PA scope."

**Definition of Done:** all accounts exist; domain live in Cloudflare with R2 bucket created and Workers/Pages enabled; Resend domain verified with SPF/DKIM/DMARC in Cloudflare DNS; env var list drafted; Track X applications submitted.

> **Cost note:** every layer above has a real, time-unlimited free tier — the whole stack runs at ~₹0/month through build and early users. First likely paid upgrade: Resend Pro ($20/mo) if you exceed 3,000 emails/mo or the 100/day cap.

> **Secrets/encryption note:** without a bundled cloud KMS, the envelope-encryption master key for consultant gateway secrets (SP-2.4) needs a home. Phase 1 options, simplest first: (a) a strong master key stored as a **Cloudflare Worker secret** (encrypted env binding), used with libsodium/`crypto` envelope encryption (per-row data keys); (b) a dedicated managed KMS later (AWS KMS / Infisical / HashiCorp Vault) when scale or compliance warrants. Decide in PB-1; (a) is fine for MVP. Never store the master key in the database or repo.

### Step PB-2 — Repo & environment scaffolding
**Objective:** a deployable empty app.
**Claude Code prompt:**
> "Scaffold a Next.js (App Router) + TypeScript + Tailwind project configured to deploy to **Cloudflare Workers via the OpenNext adapter (`@opennextjs/cloudflare`)**. Enable the `nodejs_compat` compatibility flag and set the compatibility date to 2024-09-23 or later in `wrangler.jsonc`. Add `@prisma/client`, `.prisma/client`, and `postgres` to `serverExternalPackages` in `next.config.ts` so the workerd-specific Postgres entrypoint is used. Add Prisma (PostgreSQL, targeting Neon), ESLint/Prettier, Vitest, and a GitHub Actions CI workflow that runs lint + tests. Add a `/docs` folder. Set up `.env.example` with placeholders for: DATABASE_URL (Neon), AUTH_SECRET, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET (Auth.js), R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET (Cloudflare R2, S3-compatible), RESEND_API_KEY (email), SENTRY_DSN, ENCRYPTION_MASTER_KEY (Cloudflare Worker secret). Add a health-check API route and a minimal home page. Configure Prisma with a Postgres datasource and an empty schema. Configure the storage client to use the R2 S3-compatible endpoint. Provide `wrangler` dev + deploy scripts and verify `opennextjs-cloudflare preview` runs locally."
**Definition of Done:** app deploys to Cloudflare (Workers/Pages) via OpenNext; `nodejs_compat` enabled; CI green; health check returns 200; Prisma connects to Neon; R2 client configured.

### Step PB-3 — Design system foundation (Track D starts)
**Objective:** consistent UI + localization from day one.
**Claude Code prompt:**
> "Create a design-system foundation: Tailwind theme tokens (colors as CSS variables so they can be overridden per tenant; spacing, typography), a base component set (Button, Input, Select, Toggle, Modal, Card, Tabs, Table, Toast), and an i18n setup with next-intl supporting locales `en`, `hi`, and `hinglish`. Add a font-loading utility for Noto Sans + Noto Sans Devanagari with `font-display: swap` and a fallback. Provide a Storybook-like preview page listing all components. Enforce a minimum color-contrast helper."
**Definition of Done:** components render; locale switch works; Devanagari renders correctly.

---

## 2. SP-1 — Foundation & Super Admin

> **Goal:** the operator's control plane + the spine everything hangs off: auth, roles, multi-tenancy, plans, billing scaffolding, feature flags, oversight.

### Step SP-1.1 — Data model: core tenancy
**Objective:** users, organizations, org_members, roles.
**Depends on:** PB-2.
**Build checklist:** Prisma models for `users`, `organizations`, `org_members` with the 5-role enum; migration; seed a super admin.
**Claude Code prompt:**
> "Using the schema doc in /docs, implement Prisma models for users (role enum: super_admin, consultant, team_consulting, team_accounts, seeker), organizations (slug unique, status), and org_members (role, status, is_billable_seat). Generate the migration. Add a seed script creating one super_admin user. Add Row-Level-Security notes as comments for later. Write Vitest unit tests for model constraints (unique slug, unique email)."
**Definition of Done:** migration applies; seed creates super admin; tests pass.

### Step SP-1.2 — Auth (Auth.js: Google + email OTP) + RBAC
**Objective:** sign in; enforce roles.
**Depends on:** SP-1.1, PB-3.
**Build checklist:** integrate **Auth.js** with the Prisma adapter (sessions/accounts in Neon); **Google provider**; **custom email-OTP flow** (generate 6-digit code → send via Resend → verify → expire); a `verification_codes` table (code, email, expires_at, consumed); rate-limiting on OTP requests; session carries `userId`, `role`, `orgId`; route guards/middleware per role.
**Claude Code prompt:**
> "Integrate Auth.js (NextAuth) with the Prisma adapter so sessions and accounts live in our Neon Postgres. Configure: (1) Google provider for 'Continue with Google'; (2) a custom email-OTP credential flow — generate a 6-digit code, store it in a `verification_codes` table (code, email, expires_at ~10 min, consumed bool, attempt_count), send it via Resend using a React Email template, and verify on submit (reject expired/consumed/too-many-attempts). Rate-limit OTP requests per email/IP. On first successful login create a `users` row. Add session claims for role and orgId. Implement Next.js middleware guarding routes by role: /superadmin/* → super_admin; /dashboard/* → consultant or team_*; public booking routes open. Write tests for: OTP expiry, OTP reuse rejection, rate-limit, and the role guard logic. Build sign-in + OTP-entry UI using the design system."
**Definition of Done:** can sign in via Google + email OTP; expired/reused codes rejected; rate-limit works; role guards block/allow correctly.

### Step SP-1.3 — Super Admin: consultant (org) CRUD
**Objective:** operator can create/list/edit/suspend consultants.
**Depends on:** SP-1.2.
**Build checklist:** `/superadmin/consultants` list + detail; create org (+owner user); suspend toggles org.status and takes page offline; manual create + invite email.
**Claude Code prompt:**
> "Build the Super Admin Consultants module: a table listing organizations with owner, plan, status; a create form that provisions an organization + owner user (role consultant) and sends an invite email (stub the email send); an edit page; a suspend/reactivate action that flips organizations.status. Suspended orgs' public pages must 404/҂offline (add a guard). Add tests for create + suspend."
**Definition of Done:** operator creates a consultant; suspend hides their page.

### Step SP-1.4 — Plans + per-seat model + subscription scaffolding
**Objective:** define plans; prepare per-seat billing.
**Depends on:** SP-1.1. **Parallel-OK** with SP-1.3.
**Build checklist:** `subscription_plans` (included_seats, per_seat_price, features jsonb), `subscriptions` (seat_count, status); Super Admin plan CRUD; assign plan to org. (Actual gateway charge wired in SP-1.6.)
**Claude Code prompt:**
> "Implement subscription_plans and subscriptions models per /docs. Build Super Admin UI to create/edit plans (name, price, interval, included_seats, per_seat_price, features as a key→bool map). Add the ability to assign a plan to an organization and set seat_count. Compute the effective monthly price = base + max(0, seat_count - included_seats) * per_seat_price. Unit-test the price computation."
**Definition of Done:** plans CRUD works; effective price computes correctly.

### Step SP-1.5 — Feature flags (config-as-data)
**Objective:** toggle features without deploys.
**Depends on:** SP-1.1.
**Build checklist:** `feature_flags` (scope global|plan|org); resolver with precedence org > plan > global; a `useFeature(key)` hook + server helper; Super Admin UI.
**Claude Code prompt:**
> "Implement a feature-flag system: feature_flags table (key, scope, scope_id, enabled). Write a resolver that, given a key and an org, returns enabled with precedence org > plan > global. Provide a server helper `isFeatureEnabled(key, orgId)` and a client `useFeature(key)` hook. Build a Super Admin UI to manage flags. Test the precedence logic thoroughly."
**Definition of Done:** flag set at org overrides plan/global; UI works.

### Step SP-1.6 — Our subscription billing (platform gateway)
**Objective:** charge consultants for the subscription + seats.
**Depends on:** SP-1.4, Track I (our gateway SDK).
**Build checklist:** integrate our Razorpay/Stripe subscriptions; create subscription on plan assignment; webhook for payment success/failure; dunning → grace → suspend on lapse; generate **our** GST invoice (`receipts.type=subscription`).
**Claude Code prompt:**
> "Integrate [our gateway] subscriptions for OUR revenue (charging consultants). On plan assignment, create a recurring subscription for base + per-seat. Handle webhooks for charge success/failure with idempotency. On repeated failure, set subscription.status=past_due, then suspend the org after a grace window (cron). Generate a subscription receipt (our GST) as a PDF via @react-pdf/renderer and store it. Tests for webhook idempotency + suspension."
**Definition of Done:** test charge succeeds; failure path suspends; our invoice PDF generated.

### Step SP-1.7 — Super Admin oversight + catalogs
**Objective:** read-only cross-tenant views + manage themes/fonts/integrations catalog.
**Depends on:** SP-1.3.
**Build checklist:** read-only lists of all orgs' seekers/bookings/receipts; catalogs for suggested theme colors, fonts, and available calendar providers (consumed later in SP-2).
**Claude Code prompt:**
> "Build Super Admin oversight: read-only paginated views across all organizations for bookings, seekers, and receipts (no edit). Add catalog management for suggested theme colors, font options (key + display name + script), and available calendar providers. Expose these catalogs via an internal API for the consultant app to consume. Tests for read-only enforcement."
**Definition of Done:** operator can view any tenant's data read-only; catalogs editable.

**✅ SP-1 milestone:** operator can onboard a consultant, assign a paid plan, toggle features, and oversee the platform.

---

## 3. SP-2 — Consultant Core (Admin)

> **Goal:** a consultant can onboard, brand their page, and set up how they get paid. (No bookings yet — that's SP-3/SP-4.)

### Step SP-2.1 — Onboarding wizard (Profile → Calendar → Confirm)
**Objective:** Cal.id-style 3-step onboarding.
**Depends on:** SP-1.2; Track I (Google Calendar) for step 2.
**Build checklist:** Step 1 profile (slug w/ uniqueness + live preview, full name, business type, timezone); Step 2 connect Google Calendar (busy-check toggles, create-events-on target, "connect later"); Step 3 confirm → dashboard checklist.
**Claude Code prompt:**
> "Build a 3-step consultant onboarding wizard matching the flow in /docs screenshots. Step 1: username/slug (live cal-style preview `platform.com/<slug>`, uniqueness check), full name, business type (select), timezone (default Asia/Kolkata, show current time). Step 2: Connect Google Calendar via the integration adapter — list calendars with busy-check toggles, a 'create events on' target select, and an 'I'll connect later' option. Step 3: confirmation → redirect to a dashboard 'Let's get you started' checklist. Persist to consultant_profiles + calendar_integrations. Tests for slug uniqueness."
**Definition of Done:** new consultant completes onboarding; slug reserved; calendar optional.

### Step SP-2.2 — Consultant profile (public bio data)
**Objective:** the data the booking page shows.
**Depends on:** SP-2.1.
**Build checklist:** edit bio, experience, specialities, social links, complaints/feedback contact number, GST details.
**Claude Code prompt:**
> "Build the consultant profile editor: bio, experience, specialities (tag input), social links (jsonb), complaints/feedback contact number (validated phone), and GST details (number + legal name). Save to consultant_profiles. Show inline validation. Tests for phone + GST format."
**Definition of Done:** profile saves; contact number + GST validated.

### Step SP-2.3 — Branding + language settings
**Objective:** light personalization.
**Depends on:** SP-2.1, SP-1.7 catalogs, Track D.
**Build checklist:** logo upload (storage), theme color from suggested set (contrast-validated), font choice (incl. Devanagari), default locale; live preview.
**Claude Code prompt:**
> "Build branding settings: logo upload to object storage, theme-color picker constrained to the Super Admin catalog (validate min contrast), font picker from the catalog (including Noto Sans Devanagari), and default locale (en/hi/hinglish). Persist to org_branding. Render a live preview of the booking-page header using these tokens (CSS variables). Tests for contrast validation."
**Definition of Done:** branding saves; preview reflects logo/color/font/locale.

### Step SP-2.4 — Payment setup (UPI QR + manual BYO-keys + GST)
**Objective:** how the consultant gets paid (money never touches us).
**Depends on:** SP-2.2; Track I (Razorpay SDK); secrets/KMS.
**Build checklist:** mode select (UPI QR or gateway); UPI: VPA + QR image upload; gateway: paste key_id + key_secret (**envelope-encrypted**); `connection_type=manual_keys` (reserve oauth fields); test-connection action.
**Claude Code prompt:**
> "Build payment-method settings per /docs. Two modes: (1) UPI QR — store VPA + uploaded QR image; (2) Gateway — paste Razorpay key_id + key_secret, encrypt the secret with envelope encryption (KMS data key per row), never log it, store connection_type='manual_keys' and leave oauth_token_enc null for future. Add a 'test connection' button that verifies the keys by calling a harmless Razorpay read endpoint server-side. Persist to payment_methods. Security tests: secret never returned to client, never logged."
**Definition of Done:** both modes save; gateway keys encrypted; test-connection works; secret never leaves server.

**✅ SP-2 milestone:** a consultant has a branded identity and a working way to collect payment — ready to define packages.

---

## 4. SP-3 — Scheduling Engine (highest technical risk)

> **Goal:** packages (event types), availability, limits, booking questions, and **atomic** slot reservation. Build and test this thoroughly before anything books against it.

### Step SP-3.1 — Availability schedules
**Objective:** reusable weekly availability.
**Depends on:** SP-2.1.
**Build checklist:** `availability_schedules` + `availability_rules` (multi-range/day, copy-to-day) + `availability_overrides` (date-specific); named, default-flaggable; per-slot timezone display.
**Claude Code prompt:**
> "Implement availability per /docs and the Cal.id screenshots: availability_schedules (name, timezone, is_default), availability_rules (weekday, multiple start/end ranges per day), availability_overrides (date, unavailable or custom hours). Build the editor UI: weekday toggles, multiple time ranges with add/remove, copy-to-other-days, a timezone select, and a date-overrides section. Tests: generating concrete free intervals for a given date range from rules + overrides."
**Definition of Done:** schedule produces correct free intervals incl. overrides.

### Step SP-3.2 — Packages (event types) with per-package pricing
**Objective:** the bookable products.
**Depends on:** SP-3.1.
**Build checklist:** create/edit package (title, slug, description, allowed_durations, default_duration, allow-booker-choose, **price**, location=Google Meet, schedule link); list with enable toggle + Edit/Copy/Preview/Duplicate/Delete.
**Claude Code prompt:**
> "Build the Packages (event types) module mirroring Cal.id event types. Create modal (title, URL slug under the consultant slug, description, duration). Edit page with tabs: Setup (allowed durations as multi-select, default duration, allow-booker-choose-duration toggle, per-package PRICE + currency, location fixed to Google Meet), Availability (assign a schedule). List view with per-package enable toggle and a … menu (Edit/Copy/Preview/Duplicate/Delete). Persist to packages. Tests for slug uniqueness per org and price persistence."
**Definition of Done:** packages CRUD; each has its own price; list actions work.

### Step SP-3.3 — Limits (buffers, notice, intervals, frequency)
**Objective:** protect the consultant's calendar.
**Depends on:** SP-3.2.
**Build checklist:** before/after buffers, minimum notice, time-slot intervals, booking-frequency caps (per day/week/month) on the package.
**Claude Code prompt:**
> "Add a Limits tab to packages: buffer before/after (selects), minimum notice (value + unit), time-slot intervals, and 'limit booking frequency' (e.g. 1 per day) with add-limit. Persist to packages fields per /docs. Update the slot-generation logic to respect buffers, min-notice, and frequency caps. Tests covering each limit type."
**Definition of Done:** generated slots respect all limits.

### Step SP-3.4 — Booking questions
**Objective:** what the seeker must answer.
**Depends on:** SP-3.2.
**Build checklist:** `package_questions` (name/email/phone/custom; Required/Optional/Hidden; types short/long/multi-email); reorder; defaults mirror Cal.id.
**Claude Code prompt:**
> "Build booking questions per package (Advanced tab in Cal.id): default questions (Name required, Email required, Phone hidden by default, 'What is this about?' short text optional, Additional notes long text optional, reschedule reason). Allow adding custom questions with field type and requirement (Required/Optional/Hidden) and reordering. Persist to package_questions. Render order + requirement drive the public booking form later. Tests for requirement enforcement schema."
**Definition of Done:** questions configurable; requirement + order persist.

### Step SP-3.5 — Slot generation API + atomic reservation
**Objective:** the core engine — and the no-double-book invariant.
**Depends on:** SP-3.1–3.3; Track I (calendar free/busy).
**Build checklist:** `getAvailableSlots(packageId, dateRange)` = schedule free intervals − calendar busy − existing bookings − buffers, respecting notice/intervals/frequency; `booking_slots` with **GiST exclusion constraint**; transactional reserve.
**Claude Code prompt:**
> "Implement the scheduling core. (1) `getAvailableSlots(packageId, from, to)` returning bookable start times by subtracting connected-calendar busy intervals and existing booking_slots from the package's schedule free intervals, then applying buffers, minimum notice, slot interval, and frequency caps. (2) Create booking_slots(host_member_id, slot_range tstzrange) with a Postgres GiST EXCLUDE constraint preventing overlapping ranges per host. (3) A transactional `reserveSlot` that inserts the slot and rejects (catching the exclusion violation) if it overlaps. Write concurrency tests that fire two overlapping reservations and assert exactly one succeeds."
**Definition of Done:** concurrent double-booking attempt → exactly one succeeds; slots correctly exclude busy times.

**✅ SP-3 milestone:** packages exist with availability, limits, and questions; slots generate correctly and cannot be double-booked. (Single-host for now; round-robin in SP-5.)

---

## 5. SP-4 — Public Booking + Payments (the money loop)

> **Goal:** a seeker can open a branded page, pick a slot, answer questions, pay, and receive a confirmation + receipt — proving the end-to-end loop on one consultant.

### Step SP-4.1 — Public booking page (branded + localized)
**Objective:** the seeker's entry.
**Depends on:** SP-2.3, SP-3.2; Track D.
**Build checklist:** SSR page at `/<slug>`; header (logo, name, bio); package list with durations + Schedule; language + font switch; complaints contact number visible.
**Claude Code prompt:**
> "Build the public booking page at /<slug> (SSR). Resolve org + branding + active packages. Header with logo, display name, bio. List packages (title, description, durations, Schedule button) like the Cal.id public page. Prominent language switch (en/hi/hinglish) + font, applying org_branding tokens. Show the complaints/feedback contact number. 404 if org suspended. Tests for branding + locale rendering."
**Definition of Done:** branded page renders; language/font switch works; suspended → 404.

### Step SP-4.2 — Slot picker + booking form
**Objective:** pick time + answer questions.
**Depends on:** SP-3.5, SP-3.4.
**Build checklist:** calendar + time-slot UI (12h/24h, timezone), duration toggle; render `package_questions` with requirement enforcement; ToS acceptance.
**Claude Code prompt:**
> "Build the slot picker + booking form. Calendar with available days, time-slot column (12h/24h toggle, timezone display) fed by getAvailableSlots. If allow-booker-choose-duration, show a duration selector. Render package_questions in order with required-field enforcement. Add a ToS checkbox (record acceptance timestamp). On submit, create a booking in status pending_payment and hold the slot for a checkout window. Tests: required questions block submit; slot held."
**Definition of Done:** seeker picks slot, answers required questions, accepts ToS → pending_payment booking with held slot.

### Step SP-4.3 — Payment step: gateway (instant) + UPI QR (manual proof)
**Objective:** collect payment without touching funds.
**Depends on:** SP-4.2, SP-2.4; Track I (Razorpay).
**Build checklist:** gateway: create order on consultant's keys → checkout → webhook `payment.captured` (idempotent) → confirm; QR: show consultant QR → upload proof + UTR → pending_verification.
**Claude Code prompt:**
> "Implement the payment step using the consultant's OWN gateway (BYO-keys) so funds settle to them. Gateway mode: server-side create an order with the consultant's encrypted keys, render checkout, and handle the payment.captured webhook with idempotency (unique gateway_payment_ref + gateway_event_id) to mark payment success and confirm the booking. UPI QR mode: display the consultant's QR/VPA, let the seeker upload a payment screenshot + UTR, set payment.status=pending_verification and booking.status=pending_verification. Reconciliation cron polls pending gateway payments. Tests: replayed webhook is a no-op; gateway confirm flips booking to confirmed."
**Definition of Done:** gateway payment confirms instantly + idempotently; QR path lands in pending_verification.

### Step SP-4.4 — Confirmation: Meet + calendar + receipt + email
**Objective:** deliver the goods on confirm.
**Depends on:** SP-4.3; Track I (Meet/Calendar, email, PDF).
**Build checklist:** on confirm → create Google Meet + calendar event on host; generate consultation receipt (consultant GST) PDF; email receipt + Meet link; log notification (idempotent).
**Claude Code prompt:**
> "On booking confirmation: create a Google Meet link + calendar event on the assigned host's connected calendar; generate a consultation receipt PDF (consultant's GST, invoice number series) via @react-pdf/renderer and store it; email the seeker the receipt + Meet link + booking details using localized templates; write a notifications_log row with an idempotency key. Tests: confirmation produces exactly one Meet event, one receipt, one email."
**Definition of Done:** confirmed booking → Meet link + receipt + email, no duplicates.

### Step SP-4.5 — Manual confirmation (QR) + consultant payments view
**Objective:** consultant confirms QR payments; sees their money.
**Depends on:** SP-4.3.
**Build checklist:** consultant/accounts "Confirm payment" on pending_verification → triggers SP-4.4 flow; consultant payments list + receipts view.
**Claude Code prompt:**
> "Build the consultant payments view: a list of payments (mode, amount, status, proof) and receipts. For pending_verification (QR) bookings, a 'Confirm payment' action (visible to consultant + accounts role) that verifies and runs the confirmation flow (Meet + receipt + email). A 'Reject' action keeps it unconfirmed. Tests for role visibility + confirm transition."
**Definition of Done:** consultant confirms a QR booking; payments list accurate.

**✅ SP-4 milestone:** full money + booking loop works end-to-end for a single consultant. **This is the first revenue-capable milestone.**

---

## 6. SP-5 — Teams & Round-Robin

> **Goal:** a consultant can add team members (per-seat) and have calls auto-distributed, with role isolation.

### Step SP-5.1 — Team invites + two roles + per-seat billing hook
**Objective:** add Consulting + Accounts members.
**Depends on:** SP-1.4/1.6 (billing), SP-1.2 (auth).
**Build checklist:** invite by email → `org_members` (role consulting|accounts, is_billable_seat=true); accept-invite flow; seat count updates subscription (proration).
**Claude Code prompt:**
> "Build Teams: invite a member by email with role team_consulting or team_accounts. Create an org_members row (status invited → active on accept). Each active member is a billable seat — update the subscription seat_count and reflect the per-seat price (proration handled by the gateway). Build the accept-invite + first-login flow. Tests: seat_count increments; only two roles allowed."
**Definition of Done:** invite → accept → seat billed; only the two roles exist.

### Step SP-5.2 — Role-isolated team surfaces
**Objective:** least-privilege views.
**Depends on:** SP-5.1.
**Build checklist:** Consulting view (assigned bookings + seeker details/questions, join Meet); Accounts view (payments/receipts/GST only); enforce isolation in queries + UI.
**Claude Code prompt:**
> "Build role-scoped dashboards. team_consulting sees only their assigned bookings with seeker details, answers, and the Meet link — NOT account-wide payments. team_accounts sees payments, receipts, GST, reconciliation — NOT call content/notes. Enforce isolation at the query layer (not just UI). Tests asserting each role cannot read the other's data."
**Definition of Done:** consulting can't see payments; accounts can't see call notes; enforced server-side.

### Step SP-5.3 — Round-robin auto-assignment
**Objective:** distribute calls fairly, always auto.
**Depends on:** SP-3.5, SP-5.1.
**Build checklist:** offered slots = union of consulting members' free sets; on confirm, pick eligible host (priority → least-recently-booked → last-assigned) inside the atomic transaction; write `assigned_member_id`; reassign on seat removal/no-show.
**Claude Code prompt:**
> "Extend scheduling for round-robin (booker never picks the host). For a package with multiple consulting members, getAvailableSlots returns the UNION of members' free slots. On reservation (inside the atomic transaction), select the host: filter to members free at that slot, then order by (priority desc, least-recently-booked, last-assigned asc) and pick the top; insert their booking_slot (GiST-guarded). Store bookings.assigned_member_id. Add reassignment when a member is removed or marked no-show. Concurrency tests: two bookings for the same slot go to different free hosts or exactly one if only one free."
**Definition of Done:** calls auto-distribute; no double-book; reassignment works.

**✅ SP-5 milestone:** teams operate; calls auto-distribute fairly with hard no-double-book.

---

## 7. SP-6 — Seeker Profile, Feedback & Polish

> **Goal:** complete the experience: lighter seeker profile, feedback loop, reschedule, previews.

### Step SP-6.1 — Seeker profile (notes + uploaded chart + history)
**Objective:** the consultant's record of the seeker.
**Depends on:** SP-4.4, SP-5.2.
**Build checklist:** `seeker_profiles` + `seeker_profile_entries`; consulting/admin write reading notes + upload chart file; booking history; visible to admin + team.
**Claude Code prompt:**
> "Build the seeker profile: for each seeker in an org, show booking history and a timeline of entries. Allow admin + team_consulting to add reading notes (rich text) and upload a chart file (image/PDF) stored in object storage. Persist to seeker_profiles + seeker_profile_entries. Visible to admin + team per role rules. Tests for entry creation + access scope."
**Definition of Done:** notes + chart uploads attach to the right seeker; visible to admin/team.

### Step SP-6.2 — Public share link + PDF export
**Objective:** share/print the profile safely.
**Depends on:** SP-6.1.
**Build checklist:** generate CSPRNG token, store **hash** only, expiry + revoke; public read-only profile page (`noindex`, private cache); PDF export of profile.
**Claude Code prompt:**
> "Add profile sharing: generate a 256-bit CSPRNG token, store only its SHA-256 hash with expiry + a revoke flag. Public route renders a read-only profile (notes + uploaded chart + history) when the token hash matches and isn't expired/revoked; set noindex + Cache-Control: private. Add a 'PDF export' of the profile via @react-pdf/renderer. Add UI to copy link, set expiry, and revoke. Tests: revoked/expired token denied; raw token never stored."
**Definition of Done:** share link works + revocable/expirable; PDF exports; only hash stored.

### Step SP-6.3 — Reschedule + post-call feedback
**Objective:** close the loop.
**Depends on:** SP-4.4.
**Build checklist:** reschedule within consultant limit (re-run availability + atomic move); after call → feedback link; rating + comment; notify consultant/team; show publicly.
**Claude Code prompt:**
> "Implement reschedule (seeker-initiated) honoring the consultant's reschedule limit: pick a new slot, atomically move the booking_slot, update Meet/calendar, increment reschedule_count, block past the limit with the policy message. Implement post-call feedback: after status=completed, email a feedback link; capture rating (1–5) + comment; notify consultant/team; display public feedback on the booking page. Tests: limit enforcement; feedback visibility."
**Definition of Done:** reschedule respects limit; feedback captured + shown.

### Step SP-6.4 — Previews + final polish
**Objective:** confidence + completeness.
**Depends on:** SP-2.3, SP-4.4.
**Build checklist:** consultant preview of booking page + receipt design; dashboard checklist completion; empty/error states; accessibility + contrast pass; localization sweep.
**Claude Code prompt:**
> "Add consultant previews: a 'Preview' of the public booking page (as a seeker sees it) and a 'Preview receipt design' rendering a sample consultation receipt PDF. Complete the onboarding checklist logic (mark steps done). Audit empty states, error toasts, loading skeletons, color-contrast on tenant themes, and ensure all user-facing strings are localized (en/hi/hinglish). Provide a short QA checklist in /docs."
**Definition of Done:** previews match live output; checklist completes; a11y + i18n pass.

**✅ SP-6 milestone (= Phase 1 complete):** full branded, team-enabled, payment-collecting consulting platform with seeker profiles, feedback, and reschedule.

---

## 8. Parallel Tracks (run alongside the spine)

### Track D — Design System (start PB-3, continuous)
- Tokens (tenant-overridable CSS variables), component library, i18n + fonts, contrast helper.
- **Consumed by:** every UI step. Keep components generic so dashboards, public pages, and Super Admin reuse them.
- **Designer lens:** define the booking-page layout, the dashboard shell (left nav like Cal.id), and receipt/PDF templates early; these are the high-visibility surfaces.

### Track I — Integrations (start SP-2, as adapters)
- **Google Calendar/Meet adapter:** OAuth connect, free/busy read, event + Meet create. Needed by SP-3.5 + SP-4.4.
- **Email adapter (Resend):** templated (React Email/JSX), localized sends + idempotency; used for OTP codes, receipts, call links, feedback links. Needed by SP-1.2 (OTP) and SP-4.4. Ensure SPF/DKIM/DMARC are verified in Cloudflare DNS (PB-1) before relying on deliverability.
- **Payment adapter:** `PaymentConnection` interface (ManualKeys now), order create + webhook verify. Needed by SP-2.4 + SP-4.3.
- **PDF adapter:** receipts + profile export. Needed by SP-1.6, SP-4.4, SP-6.2.
- **Build each as an isolated module with its own tests + a fake/mock** so spine steps can develop against the mock before the real integration is ready.

### Track X — External approvals (start PB-1, lands later)
- **Razorpay Partner / OAuth application** → enables Phase 2 OAuth connect. Apply now (weeks of lead time).
- **WhatsApp BSP onboarding** (Gupshup/AiSensy) → Phase 1.5. Begin verification early.
- **Legal opinion** on "no fund handling = outside RBI PA scope" + ToS drafting → before public launch.
- **GST/accounting** setup for OUR subscription revenue.

---

## 9. Dependency Map (what blocks what)

```
PB-1 ─ PB-2 ─ PB-3(Track D start)
                 │
SP-1 (Foundation/Super Admin) ── needs PB-2, PB-3
   SP-1.1 ─ SP-1.2 ─ SP-1.3
                 └─ SP-1.4 ─ SP-1.6 (needs Track I: our gateway)
                 └─ SP-1.5
                 └─ SP-1.7
                 │
SP-2 (Consultant Core) ── needs SP-1.2; SP-2.1 needs Track I: Google Cal
   SP-2.1 ─ SP-2.2 ─ SP-2.3(needs SP-1.7 catalogs, Track D)
                 └─ SP-2.4 (needs Track I: Razorpay, KMS)
                 │
SP-3 (Scheduling) ── needs SP-2.1
   SP-3.1 ─ SP-3.2 ─ SP-3.3
                 └─ SP-3.4
                 └─ SP-3.5 (needs Track I: calendar free/busy)
                 │
SP-4 (Booking+Payments) ── needs SP-3.5, SP-2.3, SP-2.4
   SP-4.1 ─ SP-4.2 ─ SP-4.3 ─ SP-4.4 (needs Track I: Meet/email/PDF) ─ SP-4.5
                 │
SP-5 (Teams/Round-Robin) ── needs SP-4 + SP-1.6 (billing)
   SP-5.1 ─ SP-5.2 ─ SP-5.3 (needs SP-3.5)
                 │
SP-6 (Profile/Feedback/Polish) ── needs SP-4.4, SP-5.2
   SP-6.1 ─ SP-6.2 ─ SP-6.3 ─ SP-6.4
```

**Safe parallelization for a small team:**
- While building **SP-1**, run **Track D** and start **Track I**'s Google Calendar + email adapters against mocks.
- **SP-2.4** (payments setup) and **SP-3** (scheduling) can progress in parallel once SP-2.1 exists — different modules.
- **Track X** runs the entire time, independent of code.

---

## 10. Engineering Standards (apply to every step)
- **Vertical slices:** DB migration → API → UI → tests, per step.
- **Tests first on invariants:** no-double-book, webhook idempotency, role isolation, secret handling, price/seat math.
- **No secrets in logs**, ever. Encrypt gateway secrets; store only token hashes for share links.
- **Idempotency everywhere** money or notifications are involved.
- **Feature-flag risky features** so they can ship dark.
- **Migrations are forward-only + reversible**; never edit a shipped migration.
- **Every money path has a reconciliation fallback** (cron) in case webhooks are missed.
- **Accessibility + localization are acceptance criteria**, not afterthoughts.

---

## 11. Product-Manager Checklist (per sub-phase)
- [ ] Each step has a clear user-facing outcome and a Definition of Done.
- [ ] Riskiest assumption tested earliest (scheduling atomicity, payment confirm).
- [ ] First revenue-capable milestone (end of SP-4) is reachable without teams.
- [ ] Per-seat billing correct before teams ship (SP-1.6 before SP-5).
- [ ] Legal opinion + ToS in hand before public launch (Track X).
- [ ] Analytics/events instrumented for the success metrics in the PRD.

## 12. Product-Designer Checklist (per sub-phase)
- [ ] Dashboard shell (Cal.id-style left nav) consistent across consultant + team + super admin.
- [ ] Booking page is mobile-first; language/font switch prominent; contrast safe on any theme.
- [ ] Receipt + profile PDF templates designed early (high-visibility, hard to retrofit).
- [ ] Empty/loading/error states for every list and form.
- [ ] Indic typography verified (Devanagari rendering, line-height, truncation).

---

## 📝 Summary
- **Six sequential sub-phases** (Foundation/Super Admin → Consultant Core → Scheduling → Booking/Payments → Teams/Round-Robin → Profile/Feedback/Polish), each ending in a usable milestone; **SP-4 is the first revenue-capable point.**
- **Three parallel tracks** — Design System (continuous), Integrations (adapters with mocks), External approvals (Razorpay Partner/WhatsApp/legal) — run alongside the spine.
- **Every step is AI-ready:** objective, dependencies, build checklist, a paste-ready Claude Code prompt, and a Definition of Done.
- **Invariants are front-loaded:** atomic no-double-book, webhook idempotency, role isolation, encrypted secrets, per-seat math.
- A **dependency map** shows exactly what can be built in parallel for a solo/small team.
