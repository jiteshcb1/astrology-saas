# 🗺️ Deliverable 3 — Feature Roadmap (Phased)

**Product:** Astrology Consultant SaaS Platform
**Version:** 2.0
**Date:** June 2026
**Approach:** Ship lean to first revenue, but Phase 1 now includes native scheduling + teams. Built in **sub-phases** (see Implementation Plan for step-by-step).

---

## 0. Roadmap Philosophy
- **Phase 1 is bigger than a classic MVP** because the native scheduling engine and teams are core to the value prop — but each sub-phase still ends in something usable.
- **Build by stakeholder layer, with parallel tracks** where dependencies allow (detailed in the Implementation Plan).
- **Defer by default.** OAuth payments, WhatsApp, chart generation, extra gateways → later.
- **Sequence reduces risk:** prove the money flow and the booking/scheduling flow before polishing.

---

## 🟢 Phase 1 — Core Platform (path to first revenue)

Delivered in sub-phases (full step-by-step in the Implementation Plan):

**1A — Foundation & Super Admin**
- Repo, environments, auth (Google + email OTP), role model, multi-tenant scaffolding.
- Super Admin: consultant CRUD, plans + per-seat add-ons, subscription billing setup, feature flags, oversight (read-only), catalogs (themes/fonts/integrations).

**1B — Consultant Core (Admin)**
- Onboarding wizard (profile/slug/timezone → connect Google Calendar → confirm).
- Branding (logo, theme, font incl. Devanagari) + language set (Hindi/English/Hinglish).
- Payment setup: UPI QR/VPA + manual BYO gateway keys (encrypted) + GST.

**1C — Scheduling Engine**
- Packages (event types) with per-package pricing, durations, location (Meet).
- Availability schedules (weekly hours, multi-range, copy-day, overrides, tz).
- Limits (buffers, min notice, intervals, frequency caps).
- Booking questions (name/email/phone/custom; Required/Optional/Hidden).
- Atomic slot booking (no double-book).

**1D — Public Booking + Payments**
- Branded, localized booking page + package list + slot picker.
- Required questions + ToS at checkout.
- Payment step: UPI QR + proof; gateway instant confirm via webhook.
- Email receipts (consultant GST) + call links + calendar/Meet event.

**1E — Teams & Round-Robin**
- Invite Sales/Consulting + Accounts members (per-seat).
- Round-robin auto-assignment across consulting members.
- Role-isolated team surfaces (consulting: assigned calls + notes/chart upload; accounts: payments/receipts).

**1F — Seeker Profile, Feedback & Polish**
- Seeker profile: reading notes + uploaded chart + booking history; public share link + PDF.
- Reschedule within limit; post-call feedback (email + on-platform).
- Complaints/feedback contact number on page; consultant preview (page + receipt).

---

## 🟡 Phase 1.5 — Fast Follow (polish the money & trust loop)
- WhatsApp receipts + reminders (via BSP).
- Auto-expiry of unconfirmed manual-proof bookings (free the slot).
- More calendar integrations (Outlook, Apple via .ics).
- No-show/cancellation policy automation; reschedule reason capture.
- Coupon analytics + basic consultant dashboard metrics (Insights).
- More Indic languages + expanded font library.
- Reconciliation dashboard for gateway payments.

---

## 🟠 Phase 2 — Growth (expand reach & conversion)
- **OAuth "Connect" gateway onboarding** (Razorpay Partner) replacing manual keys as default.
- Additional gateways: Cashfree, PhonePe (behind existing interface).
- Public ratings/reviews on booking pages (trust engine).
- Package variety: bundles, multi-session, gift packages, recurring.
- Zoom as a Meet alternative.
- Seeker accounts: booking history, saved consultants.

---

## 🔵 Phase 3 — Scale & Differentiation
- **Optional birth-chart generation** (revisit Swiss Ephemeris license) if demand proven.
- PWA / native mobile app.
- Optional consultant directory/discovery (kept separate from money flow).
- Advanced analytics + revenue insights.
- Internationalization beyond India (currency, gateways, locales).

---

## Sequencing Rationale
| Phase | Why now |
|---|---|
| 1A | Nothing exists without auth, roles, tenancy, and the operator's control plane. |
| 1B–1D | Prove the two make-or-break loops: money flow + booking/scheduling. |
| 1E | Teams/round-robin is core value but builds on a working single-consultant flow. |
| 1F | Profile/feedback/polish complete the experience and trust. |
| 1.5 | Remove friction + trust gaps (WhatsApp, expiry, policies). |
| 2 | Widen once the loop converts (OAuth, gateways, ratings). |
| 3 | Differentiate/scale once retention proven (charts, mobile, discovery). |

---

## Risk-Driven Notes
- **Scheduling engine is the top technical risk** — atomic no-double-book + cross-calendar availability must be right before teams layer on.
- **WhatsApp deferred** — cheap (~₹0.13/utility msg) but WABA/template-approval friction isn't worth MVP time; email first.
- **Ratings (Phase 2)** are the main reputational shield — don't delay past Phase 2.
- **OAuth payments (Phase 2)** depend on Razorpay Partner approval — apply early, in parallel.
- **Per-seat billing** must be correct from 1A's billing setup, since teams (1E) depend on it.

---

## 📝 Summary
- **Phase 1** = full core platform in six sub-phases (Foundation/Super Admin → Consultant Core → Scheduling → Booking/Payments → Teams/Round-Robin → Profile/Feedback/Polish).
- **Deferred:** WhatsApp (1.5), OAuth payments + gateways + ratings (2), chart generation + mobile + discovery (3).
- Sequencing is **stakeholder-layered with parallel tracks**, risk-front-loaded onto the scheduling engine and money flow.

| Phase | Theme | Headline outcome |
|---|---|---|
| 🟢 1 | Core platform | Paid, scheduled, branded, team-distributed calls |
| 🟡 1.5 | Fast follow | Smoother, more trustworthy loop (WhatsApp, expiry) |
| 🟠 2 | Growth | OAuth payments, more gateways, ratings |
| 🔵 3 | Scale | Charts, mobile, discovery |
