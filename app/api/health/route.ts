import { NextResponse } from "next/server";

// Liveness probe. Intentionally does not touch the DB or any external client so it always
// responds even with empty env / unconfigured services.
export async function GET() {
  return NextResponse.json({ status: "ok", service: "astro-consultancy" });
}
