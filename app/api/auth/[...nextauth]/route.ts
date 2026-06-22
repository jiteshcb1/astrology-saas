// Auth.js v5 catch-all route handler. Runs on the default (Node-compat) runtime — NOT edge,
// because we need full Node.js APIs for Prisma + the Neon driver on Cloudflare.
import { handlers } from "@/lib/auth";

export const { GET, POST } = handlers;
