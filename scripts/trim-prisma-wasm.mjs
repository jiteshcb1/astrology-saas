// Post-OpenNext-build trim (SP go-live): Prisma 7 bundles the query-compiler WASM (base64) for 5 databases
// × fast/small — ~75 MB of raw dead weight. We only use postgresql. This empties the base64 payload of every
// non-postgresql variant so the Worker bundle fits Cloudflare's size limit. Pure bundling change — no app
// behaviour changes (Prisma only ever loads the active provider's compiler at runtime).
import { readdirSync, statSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = ".open-next";
const KEEP = "postgresql";
// query_compiler_{fast|small}_bg.<provider>.wasm-base64.{js|mjs}  (the no-provider generated file is left alone)
const TARGET = /^query_compiler_(?:fast|small)_bg\.([a-z]+)\.wasm-base64\.(?:js|mjs)$/;
const BASE64 = /"[A-Za-z0-9+/=]{200,}"/g; // the giant embedded base64 string literal

let files = 0;
let saved = 0;

function walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    let st;
    try {
      st = statSync(p);
    } catch {
      continue;
    }
    if (st.isDirectory()) {
      walk(p);
      continue;
    }
    const m = name.match(TARGET);
    if (!m || m[1] === KEEP) continue; // not a provider variant, or it's the one we keep
    const before = readFileSync(p, "utf8");
    const after = before.replace(BASE64, '""');
    if (after === before) continue;
    writeFileSync(p, after);
    const delta = Buffer.byteLength(before) - Buffer.byteLength(after);
    files += 1;
    saved += delta;
    console.log(`  trimmed ${name} (-${(delta / 1048576).toFixed(2)} MB, provider=${m[1]})`);
  }
}

console.log("[trim-prisma-wasm] emptying unused Prisma DB-provider WASM (keeping postgresql)…");
try {
  statSync(ROOT);
} catch {
  console.error(`[trim-prisma-wasm] ${ROOT} not found — run the OpenNext build first.`);
  process.exit(1);
}
walk(ROOT);
console.log(`[trim-prisma-wasm] done: ${files} files trimmed, ${(saved / 1048576).toFixed(1)} MB raw removed.`);
