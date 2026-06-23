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

  await seedCatalogDefaults();
}

// Default platform catalogs (consumed by SP-2). Idempotent upsert by (type, key).
async function seedCatalogDefaults() {
  const items = [
    { type: "theme_color" as const, key: "night", label: "Midnight Indigo", value: { hex: "#14122b" }, sortOrder: 1 },
    { type: "theme_color" as const, key: "marigold", label: "Temple Marigold", value: { hex: "#e8a33d" }, sortOrder: 2 },
    { type: "theme_color" as const, key: "sand", label: "Sandalwood Ivory", value: { hex: "#f6efe2" }, sortOrder: 3 },
    { type: "theme_color" as const, key: "terra", label: "Terracotta", value: { hex: "#b9543a" }, sortOrder: 4 },
    { type: "font" as const, key: "fraunces", label: "Fraunces", value: { script: "latin", fontFamily: "Fraunces" }, sortOrder: 1 },
    { type: "font" as const, key: "inter", label: "Inter", value: { script: "latin", fontFamily: "Inter" }, sortOrder: 2 },
    { type: "font" as const, key: "marcellus", label: "Marcellus", value: { script: "latin", fontFamily: "Marcellus" }, sortOrder: 3 },
    { type: "font" as const, key: "noto-devanagari", label: "Noto Sans Devanagari", value: { script: "devanagari", fontFamily: "Noto Sans Devanagari" }, sortOrder: 4 },
    { type: "calendar_provider" as const, key: "google", label: "Google Calendar", value: {}, sortOrder: 1 },
  ];

  for (const item of items) {
    await prisma.catalogItem.upsert({
      where: { type_key: { type: item.type, key: item.key } },
      update: { label: item.label, value: item.value, sortOrder: item.sortOrder },
      create: item,
    });
  }
  console.log(`Seeded ${items.length} catalog defaults`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
