/**
 * GestureLockContext
 *
 * Lets any descendant (e.g. GlobeView inside HomeScreen) signal to the
 * ancestor tab pager (_layout.tsx) that it currently owns a gesture,
 * so the pager should not try to claim the same touch sequence.
 *
 * Implementation notes
 * ────────────────────
 * We store the lock in a React ref (not state) so that calling
 * setGestureLocked() has zero rendering cost — the pager's
 * PanResponder closure reads the ref synchronously at gesture-check
 * time, which is exactly what we need.
 */
import React, { createContext, useContext, useRef, useCallback } from "react";

interface GestureLockContextValue {
  /** Ref read by the pager — true while a child owns the touch. */
  gestureLockRef: React.MutableRefObject<boolean>;
  /** Call with true when a child gesture starts, false when it ends. */
  setGestureLocked: (locked: boolean) => void;
}

const GestureLockContext = createContext<GestureLockContextValue | null>(null);

export function GestureLockProvider({ children }: { children: React.ReactNode }) {
  const gestureLockRef = useRef(false);

  const setGestureLocked = useCallback((locked: boolean) => {
    gestureLockRef.current = locked;
  }, []);

  return (
    <GestureLockContext.Provider value={{ gestureLockRef, setGestureLocked }}>
      {children}
    </GestureLockContext.Provider>
  );
}

export function useGestureLock(): GestureLockContextValue {
  const ctx = useContext(GestureLockContext);
  if (!ctx) throw new Error("useGestureLock must be used inside GestureLockProvider");
  return ctx;
}
