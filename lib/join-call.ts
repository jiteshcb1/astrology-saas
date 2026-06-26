// SP-5.6 — pure state machine for the real-time "Join call" button (testable without rendering/timers).
// A session is joinable from 15 minutes before its start until it ends.
export const JOIN_WINDOW_MS = 15 * 60_000;

export type JoinState =
  | { kind: "join" } // within the window + has a link → show "Join call"
  | { kind: "prepare" } // no link, or the session is over → link to the booking
  | { kind: "soon"; mins: number } // before the window → "Join opens in N min"
  | { kind: "pending" }; // clock not known yet (pre-mount on the client)

export function joinCallState(nowMs: number | null, startMs: number | null, endMs: number | null, hasLink: boolean): JoinState {
  if (!hasLink || startMs === null) return { kind: "prepare" };
  if (nowMs === null) return { kind: "pending" };
  const end = endMs ?? startMs + 60 * 60_000;
  if (nowMs >= startMs - JOIN_WINDOW_MS && nowMs <= end) return { kind: "join" };
  if (nowMs > end) return { kind: "prepare" };
  return { kind: "soon", mins: Math.max(1, Math.ceil((startMs - JOIN_WINDOW_MS - nowMs) / 60_000)) };
}
