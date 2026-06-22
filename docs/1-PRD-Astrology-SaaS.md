# 📋 Deliverable 1 — Product Requirements Document (PRD)

**Product:** Astrology Consultant SaaS Platform
**Version:** 2.0 (Phase 1 — expanded scope)
**Date:** June 2026
**Build context:** Solo founder / small team
**Model:** Subscription SaaS (platform, not marketplace — funds never touch us)

---

## 1. Overview

### 1.1 Problem statement
Astrologers, palmists, and allied consultants in India run their consulting business across scattered tools: Instagram DMs for discovery, WhatsApp for booking, manual UPI for payments, Google Calendar (or memory) for scheduling, and no system of record for clients. It is error-prone, unprofessional, and hard to scale or delegate to a team. No single, affordable, branded tool is built for *their* workflow and *their* (often Hindi/Indic-speaking) clientele.

### 1.2 Solution
A subscription platform giving each consultant a branded, localized booking page, a native Cal.com-style scheduling engine, package-based pricing with discounts/coupons, their own payment collection (UPI QR or their own gateway), automated receipts and call links, a team layer (sales/consulting + accounts roles) with auto round-robin call distribution, a lightweight seeker profile (reading notes + uploaded chart + history, shareable/printable), and a feedback loop — without the platform ever holding money or owning service quality.

### 1.3 Product principles
1. **We are software, not a fund-handler.** Money flows directly between consultant and seeker.
2. **Make the consultant (and their brand) look good; keep ourselves invisible.** They market our product on their channels.
3. **Lean to first revenue**, but Phase 1 is now broader: native scheduling + teams are core, not deferred.
4. **Mobile-first, Indic-first.** Most seekers are on phones and prefer Indic languages.
5. **Build for delegation.** A consultant's team must be able to run calls and manage accounts.

---

## 2. Goals & Success Metrics

### 2.1 Goals
- Consultant: signup → branded booking page → first paid, scheduled call in **under 45 minutes** (slightly higher than before due to richer setup).
- The platform **never** touches client funds.
- A seeker books and pays on mobile in **under 3 minutes** (gateway mode).
- A consultant can add a team member and have calls auto-distributed with **zero manual assignment**.

### 2.2 Success metrics (Phase 1)
| Metric | Target |
|---|---|
| Time to first published page | < 45 min from signup |
| Seeker booking completion rate (gateway) | > 70% |
| Manual-proof (QR) confirmation time (median) | < 6 hrs |
| Consultant 30-day retention | > 60% |
| Receipt + call-link delivery success (email) | > 99% |
| Round-robin mis-assignment / double-booking rate | ~0% (hard invariant) |

---

## 3. Goals vs. Non-Goals

### 3.1 In scope (Phase 1)
- Landing page + auth (Google sign-in, email + OTP).
- Super Admin portal: tenant CRUD, plans + per-seat add-ons, subscription billing, feature flags, oversight, catalogs.
- Consultant onboarding wizard (profile/slug/timezone → connect calendar → confirm).
- Native scheduling engine: event-types (= packages) with per-package pricing, durations, availability schedules, limits (buffers/notice/intervals/frequency), booking questions.
- Branding (logo, theme color, font incl. Devanagari/English), languages (Hindi/English/Hinglish).
- Payments: UPI QR + manual proof; **manual BYO-keys** gateway (Razorpay first). Payment step inside booking; gateway/UPI/GST entry in settings.
- Teams: Sales/Consulting + Accounts roles, per-seat billing; **round-robin auto-assignment**.
- Seeker profile (lighter): reading notes + uploaded chart file + booking history; public share link + PDF.
- Receipts (consultant GST) + booking confirmations/call links via **email**; reschedule within limit; post-call feedback (email + on-platform).
- Single complaints/feedback contact number, shown prominently.
- Consultant preview of booking page + receipt design.

### 3.2 Out of scope (Phase 1 — explicitly deferred)
- Escrow, wallets, fund-holding of any kind (forever, by design).
- Dispute arbitration / platform-side refunds.
- **OAuth "Connect" gateway onboarding** → later phase (manual keys first).
- **Birth-chart generation engine** → dropped (astrologers upload their own chart files).
- WhatsApp notifications → fast-follow (email first).
- Additional gateways (Cashfree/PhonePe), Zoom, public ratings directory → later.
- Native mobile app (responsive web only).

---

## 4. Personas

### 4.1 Super Admin — "Operator" (You)
Runs the platform like a PM. Controls tenants, plans, per-seat billing, feature visibility, read-only oversight, catalogs (themes/fonts/integrations). Low action volume, high stakes.

### 4.2 Admin — "Consultant" (Ravi, established astrologer)
Has an Instagram following, wants a professional branded page, instant payment confirmation, his own earnings, and a small team to run overflow calls. Connects his own Razorpay. Cares how the page looks in Hindi.

### 4.3 Admin — "Consultant" (Sunita, small astrologer)
Operates via WhatsApp, takes UPI manually. Won't set up a gateway — uploads a UPI QR and goes. Our wedge into the long tail. No team.

### 4.4 Team member — "Consulting/Sales" (Amit, works for Ravi)
Takes calls on Ravi's behalf. Sees assigned bookings, the seeker's details and questions, writes reading notes, uploads charts. Cannot see account-wide payments.

### 4.5 Team member — "Accounts" (Priya, works for Ravi)
Manages money side only: payments list, receipts, GST, reconciliation. Does not take calls.

### 4.6 Advice Seeker — "Client" (Meena, on mobile)
Found Ravi via Instagram, taps his link. Wants the page in Hindi, a clear price, an easy slot pick, instant payment, and a call link by email/WhatsApp. Judges the consultant by how smooth this feels.

---

## 5. Functional Requirements (detailed)

### 5.1 Super Admin
| ID | Requirement | Priority | Acceptance criteria |
|---|---|---|---|
| FR-SA-1 | Consultant account CRUD (self-signup + manual create) | P0 | Create/view/edit/suspend; suspended → pages offline. |
| FR-SA-2 | Subscription plans + **per-seat team add-ons** | P0 | Define plans; price scales with team seats added. |
| FR-SA-3 | View subscription payments + issue our (platform) invoices | P0 | All charges listed; our GST invoice per charge. |
| FR-SA-4 | Feature flags (global / plan / consultant) | P0 | Toggle changes visibility without deploy; precedence consultant > plan > global. |
| FR-SA-5 | Read-only oversight of all tenants | P1 | View any consultant's seekers, bookings, calls, receipts (no edit). |
| FR-SA-6 | Manage platform's own gateway (subscription collection) | P0 | Configure our gateway for recurring billing. |
| FR-SA-7 | Manage catalogs (themes, fonts, calendar integrations) | P1 | Add/remove suggested themes/fonts/providers. |

### 5.2 Admin (Consultant)
| ID | Requirement | Priority | Acceptance criteria |
|---|---|---|---|
| FR-A-1 | Onboarding: profile, slug, business type, timezone | P0 | Wizard mirrors Cal.id 3-step; slug uniqueness enforced. |
| FR-A-2 | Connect Google Calendar (busy-check + create-events-on target) | P0 | Confirmed bookings create Meet + calendar event; "connect later" allowed. |
| FR-A-3 | Availability schedules (weekly hours, multi-range/day, copy-day, date overrides, per-slot tz) | P0 | Named schedules reusable across packages; seeker sees only valid free slots. |
| FR-A-4 | Branding (logo, theme color, font incl. Indic) + language set | P0 | Booking page reflects branding + Hindi/English/Hinglish switch. |
| FR-A-5 | Packages (= event types): title, slug, description, **per-package price**, durations, allow-booker-choose-duration | P0 | Each package has own price + payment requirement. |
| FR-A-6 | Package limits: before/after buffers, min notice, slot intervals, frequency caps | P0 | Booking respects all limits. |
| FR-A-7 | Booking questions per package (name/email/phone/custom; Required/Optional/Hidden) | P0 | Required enforced at checkout; phone toggle for WhatsApp later. |
| FR-A-8 | Payment setup: UPI QR/VPA + **manual BYO gateway keys** (encrypted) + GST details | P0 | Mode selectable; secrets encrypted; GST on receipts. |
| FR-A-9 | Teams: invite **Sales/Consulting** + **Accounts** members (per-seat) | P0 | Two roles only; seat count drives billing. |
| FR-A-10 | Round-robin auto-assignment across consulting members | P0 | Calls auto-distributed; booker never picks host; no double-booking. |
| FR-A-11 | Seeker profile: reading notes + upload chart + history; share link + PDF | P0 | Notes saved by admin/team; chart file uploaded; public token URL; PDF export. |
| FR-A-12 | Reschedule limit + complaints/feedback contact number | P1 | Reschedule blocked past limit; contact number shown on page. |
| FR-A-13 | Preview booking page + receipt design | P1 | Preview matches live render. |
| FR-A-14 | View own payments + receipts | P0 | Payments list; receipts under consultant GST. |

### 5.3 Team member (Consulting / Accounts)
| ID | Requirement | Priority | Acceptance criteria |
|---|---|---|---|
| FR-T-1 | Consulting: see assigned bookings + seeker details/questions | P0 | Only assigned calls visible; can join Meet. |
| FR-T-2 | Consulting: write reading notes + upload chart to profile | P0 | Notes/chart attach to correct seeker. |
| FR-T-3 | Accounts: view payments, receipts, GST, reconciliation | P0 | No access to call content; money views only. |
| FR-T-4 | Role isolation | P0 | Consulting cannot see account-wide payments; Accounts cannot see call notes. |

### 5.4 Advice Seeker
| ID | Requirement | Priority | Acceptance criteria |
|---|---|---|---|
| FR-S-1 | Branded booking page (consultant details + packages) | P0 | Correct branding/bio/socials + active packages. |
| FR-S-2 | Language (Hindi/English/Hinglish) + font switch | P0 | Prominent switcher; full re-render. |
| FR-S-3 | Package detail → slot pick → book (Google Meet) | P0 | Live availability; slot held through checkout. |
| FR-S-4 | Required booking questions + ToS acceptance | P0 | Cannot pay without required answers + ToS (timestamped). |
| FR-S-5 | Pay (UPI QR + proof OR gateway) + receive receipt + link (email) | P0 | Gateway: instant confirm; QR: pending → consultant confirms. |
| FR-S-6 | Reschedule within limit + post-call feedback | P1 | Limit respected; feedback link post-call; rating shown publicly. |
| FR-S-7 | View own shared profile (if link shared) | P1 | Public token URL renders notes + chart + history. |

---

## 6. Key User Flows

### 6.1 Consultant onboarding
Landing → sign up (Google / email+OTP) → **Step 1 Profile** (slug, name, business type, timezone) → **Step 2 Connect Calendar** (Google busy-check + create-events target, or "later") → **Step 3 confirm** → dashboard checklist (view public page, create package, set availability, payment setup, invite team).

### 6.2 Package + payment setup
Create package (title/slug/description/price/durations) → set availability schedule → set limits → configure booking questions → set payment mode (UPI QR or BYO keys) + GST → preview → publish.

### 6.3 Instant booking (gateway mode)
Seeker opens branded page → picks package → picks slot → fills required questions → accepts ToS → pays via consultant's gateway → webhook confirms → **round-robin assigns a consulting member** → Meet + calendar event created → receipt + link emailed.

### 6.4 Manual booking (UPI QR mode)
Same until payment → seeker scans QR, pays externally, uploads proof + UTR → booking = pending verification → consultant/accounts confirms → assignment + Meet + receipt.

### 6.5 Call + profile
Assigned consulting member runs call → writes reading notes → uploads chart file → (optionally) shares seeker profile link / exports PDF.

### 6.6 Post-call feedback
Call completed → feedback link sent → seeker rates → consultant/team notified → rating displayed publicly.

---

## 7. Edge Cases & Error Handling
- **Webhook missed (gateway):** reconciliation job polls status; manual "mark paid" fallback.
- **Replayed webhook:** idempotency on gateway event id / payment ref → no double-confirm.
- **Manual proof fake/disputed:** consultant rejects; booking stays unconfirmed; platform not involved.
- **Slot taken mid-checkout:** slot held during checkout window; re-prompt on expiry.
- **Round-robin: no eligible host free:** slot not offered; if all become busy at confirm time, transactional re-check → seeker re-prompted.
- **Reschedule past limit:** blocked with consultant policy message.
- **Consultant suspended (non-payment):** page offline; confirmed calls retained.
- **Team seat removed:** their assigned upcoming calls reassigned via round-robin.
- **Missing Indic glyph:** fall back to Noto default.

---

## 8. Non-Functional Requirements
| Category | Requirement |
|---|---|
| Security | Gateway secrets envelope-encrypted; never logged; ToS acceptance timestamped; share tokens hashed at rest. |
| Localization | i18n (Hindi/English/Hinglish); correct Devanagari web-font loading. |
| Performance | Booking page fast on mid-range mobile; availability query optimized across team calendars. |
| Reliability | Idempotent webhooks; atomic slot booking (no double-book); reconciliation job. |
| Multi-tenancy | Strict per-org isolation; team members scoped to their org + role. |
| Accessibility | Enforce minimum contrast even with consultant-chosen themes. |
| Privacy | Public profile links unguessable + revocable/expirable; birth details treated as sensitive. |
| Compliance | Platform never collects/settles funds → outside RBI PA regime; consultant gateways carry PCI. |

---

## 9. Dependencies & Assumptions
- Google Calendar/Meet API available and free at expected volume.
- Razorpay BYO-keys usable under current terms (manual key entry).
- Consultants have (or can get) their own GST where applicable.
- Indic web fonts (Noto family) licensed for embedding.
- Email provider deliverability sufficient for receipts/links (WhatsApp later).

---

## 📝 Summary
- Phase 1 is now **broader**: native scheduling + teams + round-robin are core, alongside the original booking/payment/branding scope.
- **Chart generation dropped**; seeker profile kept lighter (notes + uploaded chart + history + share/PDF).
- **Payments: manual BYO-keys first**, OAuth later; money never touches us.
- Two team roles only (Consulting, Accounts), **per-seat billed**, calls **auto round-robin**.
- Requirements tabled per stakeholder with priorities + acceptance criteria; flows, edge cases, NFRs specified.
