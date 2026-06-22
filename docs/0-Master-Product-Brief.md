# 🔮 Astrology Consultant SaaS — Master Product Brief (v2)

> A booking, scheduling, branding, teams, and consultation-management platform for astrologers and allied consultants. Sold on subscription. The platform is a **tool, not a marketplace** — money flows directly between consultant and client, never through us.

**Version:** 2.0 · **Date:** June 2026 · **Phase:** 1 (expanded scope) · **Build context:** Solo founder / small team

---

## 1. The product in one screen
- **What:** Each consultant gets a branded, localized (Hindi/English/Hinglish) booking page, a native Cal.com-style scheduling engine, per-package pricing, their own payment collection (UPI QR or their own gateway via manual keys), a team layer (Consulting + Accounts roles, per-seat) with **round-robin auto-assignment**, a lighter seeker profile (reading notes + uploaded chart + history, shareable/printable), receipts under their own GST, and a feedback loop.
- **Why it's safe/lean:** we never touch funds (outside RBI PA regime), we sell software on subscription, and service liability sits with the consultant (protected by ToS + ratings).
- **Who:** Super Admin (you), Admin (consultant) + their team members, and Advice Seekers (the consultant's clients).

## 2. The five documents
| # | Document | File |
|---|---|---|
| 0 | This master brief | `0-Master-Product-Brief.md` |
| 1 | Product Requirements (PRD) | `1-PRD-Astrology-SaaS.md` |
| 2 | Technical Architecture | `2-Tech-Architecture-Astrology-SaaS.md` |
| 3 | Feature Roadmap | `3-Feature-Roadmap-Astrology-SaaS.md` |
| 4 | Database Schema | `4-Database-Schema-Astrology-SaaS.md` |
| 5 | Implementation Plan (AI-ready) | `5-Implementation-Plan-Astrology-SaaS.md` |

## 3. Locked decisions (v2)
- **Model:** subscription SaaS, never a marketplace; money never touches us.
- **Infrastructure (locked PB-1):** Cloudflare (domain + DNS + R2 storage + CDN/SSL/WAF + **app hosting via Pages/Workers + OpenNext adapter**) · Neon (pure Postgres + DB branching) · Auth.js (self-hosted in Neon; Google + email-OTP) · Resend (email: OTP + receipts + links) · Sentry (monitoring). The OpenNext adapter runs Next.js in **full Node.js mode**, so PDF generation + crypto + gateway work on Cloudflare. **Database stays Neon Postgres, not Firebase** — variable-length booking durations create overlapping time ranges that need a Postgres GiST exclusion constraint (one-line, atomic) which Firestore cannot express. Every layer has a free tier (~₹0/mo through early users).
- **Payments:** UPI QR + manual proof (small astrologers) and **manual BYO gateway keys** (Razorpay first) for instant confirm. **OAuth "Connect" deferred** to Phase 2. **Route avoided.**
- **Scheduling:** built natively (Cal.com-inspired, trimmed) — not integrated. Atomic no-double-book at the DB level.
- **Teams:** two roles only (Consulting, Accounts), **per-seat billed**; calls **always auto round-robin** (booker never picks host).
- **Packages:** map to event types, **per-package pricing**.
- **Seeker profile:** lighter — reading notes + **manually uploaded chart files** + booking history; public unguessable share link + PDF. **Chart generation dropped.**
- **Birth data:** captured as ordinary required booking questions if the astrologer wants it (no chart engine consuming it).
- **Branding:** logo, theme color, font (Devanagari/English); languages Hindi/English/Hinglish; single complaints/feedback contact number shown prominently; consultant preview of page + receipts.
- **Entry/auth:** lean landing page; Google sign-in or email + OTP.
- **Notifications:** email in Phase 1; **WhatsApp deferred** to Phase 1.5 (cheap but onboarding friction).

## 4. Build approach (from the Implementation Plan)
- **Six sequential sub-phases:** Foundation/Super Admin → Consultant Core → Scheduling Engine → Public Booking + Payments → Teams & Round-Robin → Seeker Profile/Feedback/Polish.
- **First revenue-capable milestone = end of SP-4** (works for a single consultant before teams).
- **Three parallel tracks:** Design System (continuous), Integrations (adapters + mocks), External approvals (Razorpay Partner, WhatsApp BSP, legal opinion).
- **Every step is AI-ready** for Claude Code: objective, dependencies, build checklist, paste-ready prompt, Definition of Done.

## 5. Research-backed guardrails
- **Stay outside RBI PA regime** by never collecting/settling funds; bill consultants a subscription rather than taking a per-transaction split (which would require Route and trigger PA licensing). Get a written legal opinion before launch.
- **Atomic scheduling** via a Postgres GiST exclusion constraint — double-booking prevented by the database, not just app logic.
- **Encrypt gateway secrets** (envelope encryption); **hash share-link tokens**; treat birth details/reading notes as sensitive.
- **WhatsApp** is cheap (~₹0.13/utility message) but deferred for onboarding friction; **email first**.
- **Chart generation**, if ever revived, needs the Swiss Ephemeris commercial license or a permissive ephemeris — but it's out of scope now.

## 6. Open items to resolve during build (Track X)
- Razorpay Partner/OAuth onboarding terms + timeline (for Phase 2).
- WhatsApp BSP choice + verification (for Phase 1.5).
- Legal opinion on PA scope + ToS drafting (before public launch).
- Subdomain vs path-based booking URLs (path-based for Phase 1).
- Indic font licensing confirmation (Noto family is a safe default).
- Envelope-encryption master-key home: Cloudflare Worker secret for MVP; managed KMS later.

---

## 📝 Summary
This brief is the index and source of truth for v2. The scope expanded from the original lean MVP to include a **native scheduling engine, teams with round-robin, and per-seat billing** in Phase 1, while **dropping chart generation** and keeping the seeker profile lighter (uploaded charts instead of generated ones). Payments use **manual BYO-keys** now with **OAuth deferred**, and the whole build is sequenced into **six AI-ready sub-phases plus three parallel tracks**, detailed in the Implementation Plan.
