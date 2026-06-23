# CLAUDE.md — Astro Consultancy

Persistent project context. **Read this first** every session. Keep these decisions consistent.

## What this is
Multi-tenant (organization-based) subscription SaaS for astrology consultants in India:
booking + scheduling + payments managed by each consultant. The repo began as a **scaffold**
(skeleton that runs and builds); product features are built sub-phase by sub-phase per the
planning docs below.

## Locked tech stack (versions actually in use — do NOT substitute)
| Concern | Choice | Version |
| --- | --- | --- |
| Framework | Next.js, App Router, TypeScript, ESLint | `next@16.2.9` |
| UI | React | `react@19.2.4` |
| Styling | Tailwind CSS | v4 (`@tailwindcss/postcss`) |
| Hosting | Cloudflare Workers via OpenNext | `@opennextjs/cloudflare@^1.19.11`, `wrangler@^4.103` |
| Database | Neon Postgres | — |
| ORM | Prisma (driver adapters) | `prisma@^7.8.0`, `@prisma/client@^7.8.0` |
| DB driver | Neon serverless | `@prisma/adapter-neon@^7.8.0`, `@neondatabase/serverless@^1.1.0` |
| Auth | Auth.js v5 (NextAuth) + Prisma adapter | `next-auth@^5.0.0-beta.31`, `@auth/prisma-adapter@^2.11.2` |
| Email | Resend | `resend@^6.14.0` |
| Storage | Cloudflare R2 via S3-compatible client | `@aws-sdk/client-s3` + `@aws-sdk/s3-request-presigner` |
| Monitoring | Sentry | `@sentry/nextjs@^10.59.0` |

## Folder layout (locked)
- **Root-level** `app/` and `lib/` — **no `src/` directory**. Import alias `@/*` → repo root
  (see `tsconfig.json`).
- `lib/` holds the clients: `db.ts`, `auth.ts`, `email.ts`, `storage.ts`, `otp.ts`, `env.ts`.
- Routes in `app/`: `app/page.tsx`, `app/layout.tsx`, `app/api/health/route.ts`,
  `app/api/auth/[...nextauth]/route.ts`.

## Cloudflare / OpenNext (full Node runtime)
- CLI is **`opennextjs-cloudflare`**. Config files: `wrangler.jsonc` (not toml),
  `open-next.config.ts` (minimal `defineCloudflareConfig()`).
- `wrangler.jsonc`: `main: .open-next/worker.js`, **`compatibility_flags: ["nodejs_compat"]`**,
  **`compatibility_date: "2025-03-01"`** (must be `>= 2024-09-23` for nodejs_compat v2),
  `assets` binding `ASSETS`. R2 bucket binding is stubbed in comments for later.
- **Do NOT use `runtime = "edge"`** on routes — we rely on full Node APIs for Prisma + Neon.
- `next.config.ts`: calls `initOpenNextCloudflareForDev()` and sets `serverExternalPackages`:
  `["@prisma/client", ".prisma/client", "postgres", "@prisma/adapter-neon", "@neondatabase/serverless"]`.
- Scripts: `npm run preview` (build + local Workers preview), `npm run deploy` (build + deploy —
  needs `wrangler login` + secrets via `wrangler secret put`). Don't deploy unless asked.

## Prisma 7 + Neon (driver adapter)
- **Prisma 7 specifics that differ from older docs:**
  - The connection URL lives in **`prisma.config.ts`**, NOT in `schema.prisma`. The
    `datasource db` block has only `provider = "postgresql"`.
  - In `prisma.config.ts` use **`process.env.DATABASE_URL`** (undefined-safe), NOT the `env()`
    helper — `env()` throws when the var is unset and breaks `validate`/`generate` on blank env.
  - Prisma 7 does **not** auto-load `.env`; the `prisma:migrate` script runs
    `node --env-file=.env.local node_modules/.bin/prisma migrate dev`.
  - Generator is **`prisma-client-js`** (still works in v7, outputs to `node_modules/@prisma/client`),
    which is why `@prisma/client` / `.prisma/client` imports + serverExternalPackages are valid.
- Runtime client is a **singleton on `globalThis`** constructed with the Neon adapter
  (`new PrismaNeon({ connectionString })`, then `new PrismaClient({ adapter })`) — see `lib/db.ts`.
  The adapter is built even on blank env (it only connects on first query), so import is safe.
- `postinstall` runs `prisma generate`.

## Data model (foundation only — not the full schema)
`prisma/schema.prisma` (table names snake_cased via `@@map`):
`User`, `Organization` (tenant), `OrgMember` join + `Role` enum (`OWNER`, `CONSULTING`,
`ACCOUNTS`), `VerificationCode` (OTP, `@@map("verification_codes")`), plus Auth.js models
(`Account`, `Session`, `VerificationToken`). Grow this incrementally toward `docs/4` —
do NOT create all tables at once.

## Auth.js v5 (`lib/auth.ts`)
- `PrismaAdapter(prisma)`, **`session: { strategy: "jwt" }`** (required because Credentials is
  used alongside the adapter), `trustHost: true`.
- **Google provider** wired to **`GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`** explicitly (NOT
  the default `AUTH_GOOGLE_*` names).
- **Email + OTP** via the Credentials provider (`id: "email-otp"`): `authorize()` calls
  `verifyOtp()` and upserts the user. OTP backend in `lib/otp.ts` (`sendOtp`/`verifyOtp`) is
  **stubbed** — persists codes in `verification_codes`, logs the code in dev, no real email yet.
- Route handler: `app/api/auth/[...nextauth]/route.ts` → `export const { GET, POST } = handlers`
  (no edge runtime).
- Google **dev redirect URI**: `http://localhost:3001/api/auth/callback/google`.

## Stubbed clients (safe with empty env)
- `lib/email.ts` (Resend): single `sendEmail()`; console-logs when `RESEND_API_KEY` empty.
- `lib/storage.ts` (R2/S3): `putObject()` / `getSignedUrl()`; logs/placeholder when R2 env empty.
- **Sentry** (`instrumentation.ts`, `sentry.server.config.ts`, `sentry.edge.config.ts`,
  `instrumentation-client.ts`): each guarded by `if (process.env.SENTRY_DSN)` /
  `NEXT_PUBLIC_SENTRY_DSN`, so it's **fully inert when the DSN is empty**.
- `lib/env.ts`: centralized, undefined-safe env access; never throws on missing values.

## Middleware decision (important)
- There is **no `middleware.ts` / `proxy.ts` file** right now, intentionally.
- Next 16 deprecated `middleware.ts` in favor of **`proxy.ts`**, and now defaults proxy to the
  **Node.js runtime** — but **OpenNext on Cloudflare does NOT support Node.js middleware**, so a
  Node `proxy.ts` breaks `opennextjs-cloudflare build`. The scaffold's gate was a no-op (empty
  matcher), so it was removed to keep the Cloudflare build green.
- **To re-add route protection later:** create `proxy.ts` that is **edge-compatible** —
  `export const config = { runtime: "edge", matcher: [...] }` and
  `export { auth as proxy } from "@/lib/auth"`. Then confirm `npm run preview` still builds.

## Hard local constraints
- **Dev server runs on PORT 3001** (port 3000 is used by another project). `dev`/`start` scripts
  pin `-p 3001`; `AUTH_URL=http://localhost:3001`.
- `.env.local` is gitignored; `.env.example` is committed and documents every variable. Never
  commit real secrets. Env vars: `DATABASE_URL`, `AUTH_SECRET`, `AUTH_URL`, `GOOGLE_CLIENT_ID`,
  `GOOGLE_CLIENT_SECRET`, `RESEND_API_KEY`, `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`,
  `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `SENTRY_DSN`, `NEXT_PUBLIC_SENTRY_DSN`,
  `ENCRYPTION_MASTER_KEY`.
- ESLint flat config (`eslint.config.mjs`) ignores `.open-next/**` and `cloudflare-env.d.ts`
  (generated output) — keep these ignored so `npm run lint` stays clean.

## Invariants to preserve
- The app must **run, lint, and build with a completely empty `.env.local`** — every external
  client is stubbed/inert and must not crash on import when secrets are missing.
- Keep the app **deployable and green** after each change: `npm run build` and `npm run lint`
  pass; `opennextjs-cloudflare build` succeeds.

## Tenant data access (enforced invariant)
- **All access to tenant-scoped models goes through `lib/tenant-db.ts`** — `tenantDb(orgId)` for
  single ops and `tenantTransaction(({ db, tenant }) => …)` for transactions. The org filter is
  injected by the data layer (last-wins), so cross-tenant reads/writes are structurally impossible.
- **Bare `prisma.<tenantModel>` and bare `prisma.$transaction` are lint-banned** (ESLint
  `no-restricted-properties`, driven by `config/tenant-models.json`) everywhere except
  `lib/tenant-db.ts`, `lib/db.ts`, and `tests/**`. `"prebuild": "eslint"` makes a violation **fail
  `npm run build`**, not just `npm run lint`. Inside `tenantTransaction`, the handed-out `db` blocks
  tenant models at the type level and throws at runtime — a raw `tx` is never exposed.
- **To add a tenant-scoped model:** add its delegate key to `config/tenant-models.json`, add a
  scoped wrapper in `scope()` (`lib/tenant-db.ts`), and extend the `TenantModelKey` union. Then any
  bare `prisma.<newModel>` immediately fails lint/build.
- **Super-admin oversight** is the ONE sanctioned cross-tenant path: `lib/oversight.ts` (lint-exempt)
  reads tenant models across all orgs **read-only** and writes an `oversight.view` audit entry per
  read. Never add writes to tenant models there — mutations always go through `tenantDb`/`tenantTransaction`.
- Postgres RLS remains deferred (defense-in-depth, later); this app-layer guard is the Phase-1
  enforcement. `organizations`/`users` are not org-scoped here (tenant root / global).

## Verify changes
```bash
npm run lint
npm run build
npm run dev   # then: curl http://localhost:3001/api/health → {"status":"ok",...}
# Cloudflare path (no deploy):
npx opennextjs-cloudflare build
```

<!-- ───────────────────────────────────────────────────────────────────────── -->

## Project Planning Documents

The full planning artifacts live in `docs/`. Consult the relevant one BEFORE implementing a feature — these are authoritative and were produced through deep planning. Do not relitigate decisions already locked here or in the Master Brief.

- `docs/0-Master-Product-Brief.md` — **read first.** All locked product & tech decisions, index to everything else.
- `docs/1-PRD-Astrology-SaaS.md` — requirements, 6 personas, functional requirements with priorities & acceptance criteria, flows, edge cases, NFRs.
- `docs/2-Tech-Architecture-Astrology-SaaS.md` — architecture, org-based multi-tenancy + RLS, the native scheduling engine, payment flows, security.
- `docs/3-Feature-Roadmap-Astrology-SaaS.md` — phased roadmap. We are building **Phase 1**, broken into sub-phases SP-1 … SP-6.
- `docs/4-Database-Schema-Astrology-SaaS.md` — the full 25-table schema. NOTE: the current Prisma schema is a *starter subset*; grow it toward this doc sub-phase by sub-phase (don't create all 25 tables at once).
- `docs/5-Implementation-Plan-Astrology-SaaS.md` — the step-by-step build plan. Each sub-phase has objective, dependencies, checklist, and a definition of done. **Follow it in order.**
- `docs/user-flows-and-IA.html` — user flows + information architecture for all 4 personas (Seeker, Consultant, Team, Super Admin), including edge cases.
- `docs/mockups/` — the approved visual design (theme: warm / traditional / Indic-mystical — midnight indigo + temple marigold gold + sandalwood ivory + terracotta; fonts Fraunces + Marcellus + Inter + Noto Sans Devanagari). Match this look when building UI.

## How We Work

- **Build sub-phase by sub-phase.** Start at SP-1. Do not jump ahead or scaffold future phases early.
- **Use plan mode** at the start of each sub-phase. Present the plan, let me review, then implement.
- For each task, **read the relevant section** of `docs/5-Implementation-Plan-Astrology-SaaS.md` and any doc it references.
- **Locked decisions are authoritative** (see Master Brief + the stack section above). If you believe one should change, raise it explicitly with reasoning — don't silently substitute.
- Keep the app **deployable and green** after each sub-phase (build + lint pass; stubs safe with empty env).
- Grow the **Prisma schema incrementally** toward `docs/4`, only adding what each sub-phase needs.
- Local dev runs on **port 3001**. Hosting target is Cloudflare via OpenNext. DB is Neon (Postgres) via Prisma.
