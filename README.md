# Astro Consultancy

Multi-tenant SaaS for astrology consultants in India — booking, scheduling, and
consultant-managed payments. Organization-based tenancy.

> **Status: scaffold.** This is the project skeleton only. All external clients (DB, auth,
> email, storage, Sentry, OTP) are wired but **stubbed** and safe to run with empty env vars.
> No product features are built yet.

## Tech stack

| Concern        | Choice                                                                 |
| -------------- | ---------------------------------------------------------------------- |
| Framework      | Next.js 16 (App Router, TypeScript, ESLint)                            |
| Styling        | Tailwind CSS v4                                                        |
| Hosting        | Cloudflare Workers via OpenNext (`@opennextjs/cloudflare`), Node runtime |
| Database       | Neon (Postgres) + Prisma 7 with the Neon serverless driver adapter     |
| Auth           | Auth.js v5 (NextAuth) — Google OAuth + custom email/OTP                |
| Email          | Resend (stubbed)                                                       |
| Storage        | Cloudflare R2 via S3-compatible client (stubbed)                       |
| Monitoring     | Sentry (inert until DSN is set)                                        |

## Getting started

```bash
npm install                 # installs deps + runs `prisma generate`
cp .env.example .env.local  # then fill in values (all blank by default)
npm run dev                 # http://localhost:3001
```

The dev server runs on **port 3001** (3000 is reserved for another project).

Verify it's up:

```bash
curl http://localhost:3001/api/health   # → {"status":"ok","service":"astro-consultancy"}
```

## Scripts

| Script                    | What it does                                                |
| ------------------------- | ----------------------------------------------------------- |
| `npm run dev`             | Next dev server on port 3001                                |
| `npm run build`           | Production build                                            |
| `npm run start`           | Serve the production build on port 3001                     |
| `npm run lint`            | ESLint                                                      |
| `npm run preview`         | OpenNext build + local Workers preview                      |
| `npm run deploy`          | OpenNext build + deploy to Cloudflare (**don't run yet**)   |
| `npm run prisma:generate` | Regenerate the Prisma client                                |
| `npm run prisma:migrate`  | `prisma migrate dev` (loads `.env.local` for `DATABASE_URL`) |
| `npm run cf-typegen`      | Generate Cloudflare binding types                           |

## Environment variables

Copy `.env.example` → `.env.local` and fill in. The app **runs with everything blank**
(clients fall back to console-logging stubs); real functionality needs the relevant values.

| Variable                 | Purpose                                                      |
| ------------------------ | ------------------------------------------------------------ |
| `DATABASE_URL`           | Neon Postgres connection string                              |
| `AUTH_SECRET`            | Auth.js secret (`npx auth secret`)                           |
| `AUTH_URL`               | Base URL — `http://localhost:3001` in dev                    |
| `GOOGLE_CLIENT_ID`       | Google OAuth client ID                                       |
| `GOOGLE_CLIENT_SECRET`   | Google OAuth client secret                                   |
| `RESEND_API_KEY`         | Resend API key (email)                                       |
| `R2_ACCOUNT_ID`          | Cloudflare R2 account ID                                     |
| `R2_ACCESS_KEY_ID`       | R2 S3-compatible access key                                  |
| `R2_SECRET_ACCESS_KEY`   | R2 S3-compatible secret                                      |
| `R2_BUCKET`              | R2 bucket name                                               |
| `SENTRY_DSN`             | Sentry DSN (server). Empty = monitoring disabled             |
| `NEXT_PUBLIC_SENTRY_DSN` | Sentry DSN (browser). Optional                               |
| `ENCRYPTION_MASTER_KEY`  | App-level encryption key (`openssl rand -base64 32`)         |

### Google OAuth

Dev redirect URI (set this in the Google Cloud console):

```
http://localhost:3001/api/auth/callback/google
```

## Database (Prisma)

Prisma 7 keeps the connection URL in `prisma.config.ts` (not `schema.prisma`) and uses a
driver adapter at runtime — see [`lib/db.ts`](lib/db.ts) (Neon serverless driver).

```bash
# Once DATABASE_URL is set in .env.local:
npm run prisma:migrate   # create & apply the first migration
```

Foundation models: `User`, `Organization`, `OrgMember` (+ `Role` enum), `VerificationCode`
(OTP), plus the Auth.js models. This is **not** the full product schema.

## Deploy (Cloudflare)

```bash
npm run preview   # build + run locally on the Workers runtime
npm run deploy    # build + deploy (requires `wrangler login` and configured secrets)
```

`wrangler.jsonc` sets `nodejs_compat` and a recent compatibility date for full Node APIs.
Set production secrets with `wrangler secret put <NAME>` (do not commit them).

## Project layout

```
app/                     # App Router routes
  api/health/            # liveness probe
  api/auth/[...nextauth] # Auth.js handler
lib/                     # clients: db, auth, email, storage, otp, env
prisma/schema.prisma     # foundation schema
prisma.config.ts         # Prisma 7 config (datasource URL lives here)
open-next.config.ts      # OpenNext Cloudflare config
wrangler.jsonc           # Cloudflare Workers config
instrumentation*.ts      # Sentry wiring (inert without DSN)
```

> Route protection (a Next 16 `proxy.ts`) is intentionally **not** included yet: OpenNext on
> Cloudflare requires edge-runtime middleware, so add an edge-compatible `proxy.ts`
> (`export const config = { runtime: "edge" }`, `export { auth as proxy } from "@/lib/auth"`)
> when you have routes to gate, and confirm `npm run preview` still builds.
