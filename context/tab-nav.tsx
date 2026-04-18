/**
 * TabNavContext
 *
 * Lets any screen inside the custom TabPager trigger a tab switch
 * programmatically (e.g. avatar icon → profile tab).
 *
 * Usage:
 *   const { switchTab } = useTabNav();
 *   switchTab(3); // 0=Home 1=Flights 2=Trips 3=Profile
 */
import React, { createContext, useContext, useRef, useCallback } from "react";

interface TabNavContextValue {
  /** Call to switch to a tab by index. No-op if pager not mounted yet. */
  switchTab: (index: number) => void;
  /** Called by the pager to register its snapTo function. */
  registerSnapTo: (fn: (index: number) => void) => void;
}

const TabNavContext = createContext<TabNavContextValue | null>(null);

export function TabNavProvider({ children }: { children: React.ReactNode }) {
  const snapToRef = useRef<((index: number) => void) | null>(null);

  const registerSnapTo = useCallback((fn: (index: number) => void) => {
    snapToRef.current = fn;
  }, []);

  const switchTab = useCallback((index: number) => {
    snapToRef.current?.(index);
  }, []);

  return (
    <TabNavContext.Provider value={{ switchTab, registerSnapTo }}>
      {children}
    </TabNavContext.Provider>
  );
}

export function useTabNav(): TabNavContextValue {
  const ctx = useContext(TabNavContext);
  if (!ctx) throw new Error("useTabNav must be used inside TabNavProvider");
  return ctx;
}
