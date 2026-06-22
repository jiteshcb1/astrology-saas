import type { DefaultSession } from "next-auth";

// Augment Auth.js session/JWT with our identity + role/org claims.
// NOTE: these claims are used for routing (roleHome) and UI only — authorization is decided
// against the live DB role in lib/rbac.ts#requireRole, never from these cached values.

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: string | null;
      orgId: string | null;
    } & DefaultSession["user"];
  }
}

// JWT lives in @auth/core/jwt; "next-auth/jwt" only re-exports it, so augment the source.
declare module "@auth/core/jwt" {
  interface JWT {
    userId?: string;
    role?: string | null;
    orgId?: string | null;
  }
}
