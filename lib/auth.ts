import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/db";
import { normalizeEmail, verifyOtp } from "@/lib/otp";
import { env } from "@/lib/env";

// Auth.js v5 (NextAuth) configuration.
// Two providers: Google OAuth, and a custom email + OTP (Credentials) flow.
// Safe to import with empty env — provider credentials are only exercised at request time.
//
// Dev Google redirect URI: http://localhost:3001/api/auth/callback/google
export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  // Credentials-based sign-in requires the JWT session strategy.
  // maxAge bounds how long cached (routing/UX) claims can be stale; authorization is always
  // decided against the live DB role in lib/rbac.ts#requireRole.
  session: { strategy: "jwt", maxAge: 8 * 60 * 60 },
  // Allow the configured AUTH_URL host in dev/preview without extra setup.
  trustHost: true,
  providers: [
    Google({
      // Honor the project's explicit env var names (Auth.js would otherwise expect AUTH_GOOGLE_*).
      clientId: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
    }),
    Credentials({
      id: "email-otp",
      name: "Email OTP",
      credentials: {
        email: { label: "Email", type: "email" },
        code: { label: "Code", type: "text" },
      },
      async authorize(credentials) {
        const rawEmail = typeof credentials?.email === "string" ? credentials.email : "";
        const code = typeof credentials?.code === "string" ? credentials.code : "";
        if (!rawEmail || !code) return null;

        const email = normalizeEmail(rawEmail);
        const valid = await verifyOtp(email, code);
        if (!valid) return null;

        // Upsert the user so OTP sign-in works alongside the Prisma adapter.
        // `update: {}` intentionally never overwrites `role` — provisioned roles are preserved;
        // brand-new users get the `seeker` schema default.
        const user = await prisma.user.upsert({
          where: { email },
          update: {},
          create: { email, emailVerified: new Date() },
        });

        return { id: user.id, email: user.email, name: user.name, image: user.image };
      },
    }),
  ],
  pages: {
    signIn: "/signin",
  },
  callbacks: {
    // On initial sign-in, cache identity + role/org for routing & UI. Authorization is decided
    // live in lib/rbac.ts#requireRole, so these claims are convenience-only.
    async jwt({ token, user }) {
      if (user?.id) {
        const dbUser = await prisma.user.findUnique({
          where: { id: user.id },
          select: {
            role: true,
            memberships: {
              where: { status: "active" },
              orderBy: { createdAt: "asc" },
              take: 1,
              select: { organizationId: true },
            },
          },
        });
        token.userId = user.id;
        token.role = dbUser?.role ?? "seeker";
        token.orgId = dbUser?.memberships[0]?.organizationId ?? null;
      } else if (token.userId && token.role !== "super_admin" && !token.orgId) {
        // SP-7.1 self-heal: a just-self-served user (org created AFTER this token was minted) gets their
        // role/org refreshed on the next request, so session.user.* matches the live membership. Only runs
        // while orgId is missing (every consultant has one post-provision), so it's a one-shot extra query.
        const dbUser = await prisma.user.findUnique({
          where: { id: token.userId },
          select: {
            role: true,
            memberships: { where: { status: "active" }, orderBy: { createdAt: "asc" }, take: 1, select: { organizationId: true } },
          },
        });
        if (dbUser) {
          token.role = dbUser.role;
          token.orgId = dbUser.memberships[0]?.organizationId ?? null;
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.userId ?? "";
        session.user.role = token.role ?? null;
        session.user.orgId = token.orgId ?? null;
      }
      return session;
    },
  },
});
