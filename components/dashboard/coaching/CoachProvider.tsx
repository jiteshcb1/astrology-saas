"use client";

import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { markCoachingSeenAction } from "./actions";

// Holds the per-user "seen" map (seeded from the server) + an optimistic local layer so a tour that's
// completed/skipped this session doesn't reappear before the next server fetch.
interface CoachCtx {
  isSeen: (area: string) => boolean;
  markSeen: (area: string) => void;
}
const Ctx = createContext<CoachCtx>({ isSeen: () => true, markSeen: () => {} });
export const useCoach = () => useContext(Ctx);

export function CoachProvider({ seen, children }: { seen: Record<string, boolean>; children: ReactNode }) {
  const [local, setLocal] = useState<Record<string, boolean>>(seen);
  const markSeen = useCallback((area: string) => {
    setLocal((m) => (m[area] ? m : { ...m, [area]: true }));
    void markCoachingSeenAction(area).catch(() => {});
  }, []);
  const isSeen = useCallback((area: string) => !!local[area], [local]);
  return <Ctx.Provider value={{ isSeen, markSeen }}>{children}</Ctx.Provider>;
}
