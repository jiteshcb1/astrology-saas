import { redirect } from "next/navigation";

// SP-6.2 — "Try the demo" entry. A literal route (wins over [slug] by static-over-dynamic precedence) that
// forwards to the seeded demo consultant's real public page in demo mode (banner + no-write booking flow).
export default function DemoEntry() {
  redirect("/pandit-demo-sharma?demo=1");
}
