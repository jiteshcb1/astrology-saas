# 🗄️ Deliverable 4 — Database Schema / Data Model

**Product:** Astrology Consultant SaaS Platform
**Version:** 2.0 (Phase 1 — expanded scope)
**Engine:** PostgreSQL (managed), multi-tenant single database.
**Tenancy:** Tenant = **organization** (a consultant + their team). Tenant-scoped tables carry `org_id`, protected by Row-Level Security (RLS).

> **Design rules:**
> - **No wallet/escrow/fund-holding tables — by design.** We record payments that flow directly between seeker and consultant; we never custody funds.
> - **Double-booking is prevented at the database level** via a GiST exclusion constraint, not just app logic.

---

## 1. Conventions
- All tables: `id` (UUID PK), `created_at`, `updated_at`.
- FKs suffixed `_id`. Money = integer minor units (paise) + `currency`.
- Flexible config = `jsonb`. Encrypted secrets suffixed `_enc`.
- Enums shown inline (implement as Postgres enums or check constraints).

---

## 2. Entity Catalog
| # | Table | Purpose |
|---|---|---|
| 1 | `users` | All humans: super admins, consultants, team members, seekers (role-typed). |
| 2 | `organizations` | Tenant: the consultant's org (brand, slug, status). |
| 3 | `org_members` | Membership + role linking users to an org. |
| 4 | `consultant_profiles` | Public profile: bio, experience, socials, GST, contact number. |
| 5 | `org_branding` | Logo, theme color, font, default locale. |
| 6 | `subscription_plans` | Our plans (price, interval, included seats, features). |
| 7 | `subscriptions` | Org's active plan + seat count + status. |
| 8 | `feature_flags` | Table-driven toggles (global/plan/org). |
| 9 | `availability_schedules` | Named reusable schedules. |
| 10 | `availability_rules` | Weekly hours / ranges per schedule. |
| 11 | `availability_overrides` | Date-specific overrides. |
| 12 | `calendar_integrations` | Connected calendars/Meet per member. |
| 13 | `packages` | Event types: price, durations, location, schedule, limits. |
| 14 | `package_questions` | Booking questions per package. |
| 15 | `coupons` | Discounts per org/package. |
| 16 | `payment_methods` | Per-org: UPI QR/VPA or encrypted gateway keys + mode. |
| 17 | `bookings` | A seeker's booking: slot, status, answers, ToS, assigned host. |
| 18 | `booking_slots` | Reserved time ranges per host (carries the no-double-book constraint). |
| 19 | `payments` | Payment record: mode, status, proof, gateway ref/UTR. |
| 20 | `receipts` | Consultation receipts (consultant GST) + subscription invoices (our GST). |
| 21 | `seeker_profiles` | Lighter profile: reading notes + uploaded chart + share token. |
| 22 | `seeker_profile_entries` | Individual reading notes / uploaded files over time. |
| 23 | `feedback` | Post-call ratings/comments. |
| 24 | `notifications_log` | Email (later WhatsApp) dispatch log (idempotency, audit). |
| 25 | `verification_codes` | Email-OTP codes for Auth.js sign-in (code, expiry, consumed). |
| — | *Auth.js adapter tables* | `accounts`, `sessions`, `verification_tokens` created by the Auth.js Prisma adapter. |

---

## 3. Table Definitions (key fields)

### 3.1 `users`
`id, role (super_admin|consultant|team_consulting|team_accounts|seeker), name, email (citext unique), phone, auth_provider, password_hash (nullable), created_at`

### 3.2 `organizations`
`id, owner_user_id (FK→users, the consultant), name, slug (citext unique), status (active|suspended), created_at`

### 3.3 `org_members`
`id, org_id (FK), user_id (FK), role (consultant|team_consulting|team_accounts), status (active|invited|removed), is_billable_seat (bool), created_at`
> Drives **per-seat billing**: count active billable seats.

### 3.4 `consultant_profiles` (1:1 with org)
`id, org_id, display_name, bio, experience, specialities[], social_links(jsonb), gst_number, gst_legal_name, complaints_contact_number, created_at`

### 3.5 `org_branding` (1:1 with org)
`id, org_id, logo_url, theme_color (hex; contrast-validated), font_key, default_locale (hi|en|hinglish)`

### 3.6 `subscription_plans`
`id, name, price (paise), billing_interval (monthly|yearly), included_seats (int), per_seat_price (paise), features(jsonb), is_active`

### 3.7 `subscriptions`
`id, org_id, plan_id, seat_count (int), status (active|past_due|canceled), current_period_end, gateway_subscription_ref`

### 3.8 `feature_flags`
`id, key, scope (global|plan|org), scope_id (nullable), enabled`
> Precedence: org > plan > global.

### 3.9 `availability_schedules`
`id, org_id, owner_member_id (FK→org_members), name, timezone, is_default (bool)`

### 3.10 `availability_rules`
`id, schedule_id (FK), weekday (0–6), start_time, end_time`
> Multiple rows per weekday = multiple ranges/day.

### 3.11 `availability_overrides`
`id, schedule_id (FK), date, is_unavailable (bool), start_time (nullable), end_time (nullable)`

### 3.12 `calendar_integrations`
`id, org_id, member_id (FK→org_members), provider (google|...), access_token_enc, refresh_token_enc, meet_enabled (bool), create_events_on (text), status (connected|expired|revoked)`

### 3.13 `packages` (event types)
`id, org_id, title, slug, description, allowed_durations (int[]), default_duration_min, allow_booker_choose_duration (bool), price (paise), currency, discount_type (none|percent|flat), discount_value, location_type (google_meet), schedule_id (FK→availability_schedules), buffer_before_min, buffer_after_min, min_notice_min, slot_interval_min, freq_limit (jsonb e.g. {per_day, per_week, per_month}), assignment_mode (round_robin), is_active`
> **Per-package price + payment requirement.** `assignment_mode` is round_robin in Phase 1.

### 3.14 `package_questions`
`id, package_id (FK), label, field_type (name|email|phone|short_text|long_text|multi_email), requirement (required|optional|hidden), sort_order`

### 3.15 `coupons`
`id, org_id, package_id (nullable), code, discount_type (percent|flat), discount_value, usage_limit, used_count, valid_until, is_active`
> Unique `(org_id, code)`.

### 3.16 `payment_methods`
`id, org_id, mode (upi_qr|gateway), upi_vpa, qr_image_url, gateway_provider (razorpay|cashfree|phonepe), connection_type (manual_keys|oauth), gateway_key_id_enc, gateway_key_secret_enc, oauth_token_enc (nullable, future), is_active`
> **Manual keys now**; `connection_type` + `oauth_token_enc` reserved so OAuth slots in later with no schema break. Secrets envelope-encrypted.

### 3.17 `bookings`
`id, org_id, seeker_user_id (FK→users), package_id (FK), assigned_member_id (FK→org_members, the round-robin host), duration_min, status (pending_payment|pending_verification|confirmed|completed|canceled|rescheduled), answers (jsonb, booking-question responses), tos_accepted_at, reschedule_count, meet_link, created_at`

### 3.18 `booking_slots` (atomic no-double-book)
`id, booking_id (FK), host_member_id (FK→org_members), slot_range (tstzrange)`
> **Constraint:** `EXCLUDE USING gist (host_member_id WITH =, slot_range WITH &&) WHERE (status active)` → DB rejects overlapping reservations for the same host even under concurrency.

### 3.19 `payments`
`id, booking_id (FK), org_id, mode (upi_qr|gateway), amount (paise), currency, status (initiated|pending_verification|success|failed|refunded), proof_image_url, utr_reference, gateway_payment_ref (unique), gateway_event_id (unique, idempotency), verified_by (nullable FK→users), created_at`

### 3.20 `receipts`
`id, type (consultation|subscription), booking_id (nullable FK), org_id, issued_to, gst_number_used, amount (paise), pdf_url, issued_at`
> Consultation → consultant GST; subscription → our GST.

### 3.21 `seeker_profiles` (1:1 per seeker per org)
`id, org_id, seeker_user_id (FK), share_token_hash (sha256, nullable), share_expires_at (nullable), share_revoked (bool), created_at`
> Public link = CSPRNG token; only its **hash** stored; expiry + revoke supported.

### 3.22 `seeker_profile_entries`
`id, profile_id (FK), author_member_id (FK→org_members), entry_type (reading_note|uploaded_chart|file), note_text, file_url, created_at`
> Reading notes + **manually uploaded chart files** accumulate here.

### 3.23 `feedback`
`id, booking_id (FK), org_id, seeker_user_id (FK), rating (1–5), comment, is_public (bool), created_at`

### 3.24 `notifications_log`
`id, booking_id (nullable FK), channel (email|whatsapp), template_key, recipient, status (queued|sent|failed), idempotency_key (unique), sent_at`

### 3.25 `verification_codes` (email-OTP for Auth.js)
`id, email (citext), code (6-digit, hashed at rest recommended), expires_at (~10 min), consumed (bool), attempt_count (int), created_at`
> Used by the custom email-OTP flow in SP-1.2. Rate-limit issuance per email/IP; reject expired/consumed/over-attempt codes. Auth.js's own adapter tables (`accounts`, `sessions`, `verification_tokens`) are created automatically by the Prisma adapter and store OAuth links + sessions in the same Neon database.

---

## 4. Relationships (summary)
- `users` 1—* `org_members` *—1 `organizations` (a user can own/belong to an org; team members belong to one org).
- `organizations` 1—1 `consultant_profiles`, `org_branding`, active `payment_methods`, `subscriptions`.
- `organizations` 1—* `packages`, `coupons`, `availability_schedules`, `bookings`, `seeker_profiles`.
- `packages` 1—* `package_questions`; *—1 `availability_schedules`.
- `bookings` 1—1 `payments`, 1—1 `booking_slots`, 1—1 consultation `receipts`, 1—* `feedback`; *—1 `assigned_member`.
- `seeker_profiles` 1—* `seeker_profile_entries`.
- `feature_flags` resolved org > plan > global.

### 4.1 ER overview (text)
```
users ──*──< org_members >──*── organizations ──1:1── consultant_profiles
                                      │                 org_branding
                                      │                 payment_methods
                                      │                 subscriptions ──*:1── subscription_plans
                                      ├──1:*── packages ──1:*── package_questions
                                      │             *:1── availability_schedules ──1:*── availability_rules
                                      │                                            └──1:*── availability_overrides
                                      ├──1:*── coupons
                                      ├──1:*── bookings ──1:1── payments
                                      │              ├──1:1── booking_slots (GiST no-double-book)
                                      │              ├──1:1── receipts (consultation)
                                      │              └──1:*── feedback
                                      └──1:*── seeker_profiles ──1:*── seeker_profile_entries
org_members ──1:*── calendar_integrations          notifications_log
```

---

## 5. Indexing & Integrity Notes
- Unique: `users.email`, `organizations.slug`, `payments.gateway_payment_ref`, `payments.gateway_event_id`, `notifications_log.idempotency_key`, `coupons(org_id, code)`, `packages(org_id, slug)`.
- **Exclusion constraint** on `booking_slots(host_member_id, slot_range)` — the hard no-double-book invariant.
- Indexes: `bookings(org_id, status)`, `booking_slots(host_member_id, slot_range)` (GiST), `payments(booking_id)`, `feedback(org_id, is_public)`, `feature_flags(key, scope, scope_id)`, `org_members(org_id, role, status)`.
- Checks: `feedback.rating` 1–5; non-negative amounts; valid status transitions enforced in app layer.
- RLS: tenant-scoped tables filter by `org_id = current_org()`; super_admin bypasses for oversight; team members further scoped by role.

---

## 6. Schema Notes Tied to the Business Model
- **No escrow/wallet by design** — records payments, never custodies funds.
- **Per-seat billing** = count active billable `org_members`.
- **Round-robin** stored via `bookings.assigned_member_id` + `booking_slots` host range.
- **Atomic no-double-book** via GiST exclusion constraint.
- **Two receipt types, two GSTs** (consultant vs ours).
- **Payment connection future-proofed** (`connection_type` + reserved `oauth_token_enc`) so OAuth is additive.
- **Seeker profile is lighter** (notes + uploaded chart + history); **no chart-generation tables**.
- **Share links** store only token hashes; expiry + revoke.
- `tos_accepted_at` = per-booking legal shield.

---

## 📝 Summary
- **Org-based multi-tenant Postgres**, 24 core tables, RLS, 5 user roles.
- **No wallet/escrow** — we record, never custody, funds.
- **Atomic scheduling** via GiST exclusion on `booking_slots`; round-robin host stored on bookings.
- **Per-seat billing** from `org_members`; **per-package pricing** on `packages`.
- **Seeker profile lighter** (notes + uploaded chart + history); chart-generation tables removed.
- **Payment secrets encrypted**, connection method abstracted for future OAuth.

| Aspect | Decision |
|---|---|
| Engine | Managed PostgreSQL |
| Tenancy | Org-based, `org_id` + RLS |
| Money custody | None — no wallet/escrow |
| No double-book | GiST exclusion on booking_slots |
| Assignment | Round-robin → `assigned_member_id` |
| Billing | Per-seat via org_members + per-package price |
| Payment secrets | Envelope-encrypted; OAuth-ready |
| Seeker profile | Notes + uploaded chart + history (no generation) |
| Share links | Hashed token + expiry + revoke |
