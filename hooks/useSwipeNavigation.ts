/**
 * useSwipeNavigation
 * 
 * Returns PanResponder handlers that navigate between the three main tabs
 * when the user swipes horizontally with enough distance and velocity.
 *
 * Tab order:  index (Home) → flights → profile
 *
 * Conflict avoidance
 * ──────────────────
 * - Only fires when |dx| > |dy| × 1.8  (clearly horizontal, not a scroll)
 * - Requires dx > SWIPE_DIST and vx > SWIPE_VEL
 * - `enabled` prop: pass false while the GlobeView PanResponder is active
 *   so horizontal globe drags never trigger navigation.
 */
import { useRef } from "react";
import { PanResponder } from "react-native";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";

const TABS = ["/(tabs)/index", "/(tabs)/flights", "/(tabs)/profile"] as const;
const SWIPE_DIST = 60;   // minimum horizontal distance in px
const SWIPE_VEL  = 0.3;  // minimum horizontal velocity

export function useSwipeNavigation(currentIndex: 0 | 1 | 2, enabled = true) {
  const startX = useRef(0);
  const startY = useRef(0);

  const panResponder = useRef(
    PanResponder.create({
      // Let the gesture system know we want to observe but not capture by default.
      // We only capture once we detect a clearly horizontal drag.
      onStartShouldSetPanResponder:        () => false,
      onStartShouldSetPanResponderCapture: () => false,
      onMoveShouldSetPanResponder: (_, gs) => {
        if (!enabled) return false;
        const absDx = Math.abs(gs.dx);
        const absDy = Math.abs(gs.dy);
        return absDx > 10 && absDx > absDy * 1.8;
      },
      onMoveShouldSetPanResponderCapture: () => false,

      onPanResponderGrant: (evt) => {
        startX.current = evt.nativeEvent.pageX;
        startY.current = evt.nativeEvent.pageY;
      },

      onPanResponderRelease: (_, gs) => {
        if (!enabled) return;
        const absDx = Math.abs(gs.dx);
        const absDy = Math.abs(gs.dy);
        // Confirm it's still clearly horizontal at release
        if (absDx < SWIPE_DIST || Math.abs(gs.vx) < SWIPE_VEL || absDx < absDy * 1.8) return;

        if (gs.dx < 0) {
          // Swipe LEFT → go to next tab
          const next = TABS[currentIndex + 1];
          if (next) { Haptics.selectionAsync(); router.navigate(next); }
        } else {
          // Swipe RIGHT → go to previous tab
          const prev = TABS[currentIndex - 1];
          if (prev) { Haptics.selectionAsync(); router.navigate(prev); }
        }
      },
    })
  ).current;

  return panResponder.panHandlers;
}
