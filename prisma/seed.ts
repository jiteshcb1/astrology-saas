import { prisma } from "../lib/db";
import { resolveSuperadminEmail } from "../lib/superadmin";

// SP-1.1 seed: create exactly one platform operator (super_admin).
// Idempotent — safe to run repeatedly. The address comes from SUPERADMIN_EMAIL; in production
// an explicit real address is required (see lib/superadmin.ts).
async function main() {
  const email = resolveSuperadminEmail(process.env.SUPERADMIN_EMAIL, process.env.NODE_ENV);

  const user = await prisma.user.upsert({
    where: { email },
    update: { role: "super_admin" },
    create: {
      email,
      role: "super_admin",
      name: "Super Admin",
      emailVerified: new Date(),
    },
  });

  console.log(`Seeded super_admin: ${user.email} (${user.id})`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
