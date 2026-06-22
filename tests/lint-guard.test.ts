import { describe, expect, it } from "vitest";
import { ESLint } from "eslint";

// Proves the tenant-isolation lint guard actually rejects bare tenant access. Uses the project's
// real flat config (eslint.config.mjs) against a non-exempt virtual file path.
const eslint = new ESLint({ cwd: process.cwd() });

async function ruleMessages(code: string): Promise<string[]> {
  const results = await eslint.lintText(code, { filePath: "app/__lint_fixture__.ts" });
  return results
    .flatMap((r) => r.messages)
    .filter((m) => m.ruleId === "no-restricted-properties")
    .map((m) => m.message);
}

describe("tenant-isolation lint guard", () => {
  it("rejects bare prisma.orgMember and prisma.$transaction", async () => {
    const msgs = await ruleMessages(
      [
        "declare const prisma: { orgMember: { findMany: () => void }; $transaction: (f: () => void) => void };",
        "prisma.orgMember.findMany();",
        "prisma.$transaction(() => {});",
      ].join("\n"),
    );
    expect(msgs.some((m) => m.includes("prisma.orgMember"))).toBe(true);
    expect(msgs.some((m) => m.includes("tenantTransaction"))).toBe(true);
  });

  it("allows the sanctioned tenantDb / tenantTransaction calls", async () => {
    const msgs = await ruleMessages(
      [
        "declare function tenantDb(orgId: string): { orgMember: { findMany: () => void } };",
        'tenantDb("x").orgMember.findMany();',
      ].join("\n"),
    );
    expect(msgs).toHaveLength(0);
  });
});
