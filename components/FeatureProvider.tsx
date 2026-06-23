"use client";

import { createContext, useContext, type ReactNode } from "react";

// Holds the org's resolved flag map (hydrated server-side). useFeature(key) reads from it.
const FeatureContext = createContext<Record<string, boolean>>({});

export function FeatureProvider({
  features,
  children,
}: {
  features: Record<string, boolean>;
  children: ReactNode;
}) {
  return <FeatureContext.Provider value={features}>{children}</FeatureContext.Provider>;
}

export function useFeature(key: string): boolean {
  return useContext(FeatureContext)[key] ?? false;
}
