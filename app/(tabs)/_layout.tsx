/**
 * Custom animated tab pager.
 *
 * All three tab screens are rendered side-by-side in a single
 * Animated.View row. A PanResponder tracks horizontal drag in real
 * time, translating the row so screens slide physically under the
 * finger. On release the row spring-snaps to the nearest tab.
 *
 * This gives the same feel as a native ViewPager / horizontal
 * ScrollView pager — the next screen is visible and follows the
 * finger as the user drags, with no cold router.navigate() jump.
 *
 * Conflict avoidance
 * ──────────────────
 * - Only captures when |dx| > |dy| * 1.8 (clearly horizontal)
 * - Requires |dx| > 8 to start
 * - Vertical scrolls inside each tab are unaffected because we
 *   use onMoveShouldSetPanResponder (not onStart) so the inner
 *   ScrollView wins on vertical-dominant gestures.
 */
import React, { useRef, useState, useCallback } from "react";
import {
  View,
  Animated,
  PanResponder,
  Dimensions,
  Platform,
  StyleSheet,
} from "react-native";
import { Pressable, Text } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useColors } from "@/constants/colors";

// Lazy-load tab screens to keep initial bundle small
import HomeScreen    from "./index";
import FlightsScreen from "./flights";
import ProfileScreen from "./profile";

const { width: SCREEN_W } = Dimensions.get("window");
const NUM_TABS = 3;

const TABS = [
  { key: "home",    label: "Home",    icon: "home-outline"    as const },
  { key: "flights", label: "Flights", icon: "airplane-outline" as const },
  { key: "profile", label: "Profile", icon: "person-outline"  as const },
] as const;

export default function TabLayout() {
  const C       = useColors();
  const insets  = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState(0);

  // Animated x-offset of the 3-screen row.
  // x = -activeTab * SCREEN_W when settled.
  const translateX = useRef(new Animated.Value(0)).current;
  const activeRef  = useRef(0);  // mutable copy for use inside PanResponder closure

  const snapTo = useCallback((index: number, velocity = 0) => {
    const target = -index * SCREEN_W;
    Animated.spring(translateX, {
      toValue: target,
      velocity,
      tension: 68,
      friction: 11,
      useNativeDriver: true,
    }).start();
    activeRef.current = index;
    setActiveTab(index);
    Haptics.selectionAsync();
  }, [translateX]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder:        () => false,
      onStartShouldSetPanResponderCapture: () => false,

      // Capture once we’re sure it’s a horizontal drag
      onMoveShouldSetPanResponder: (_, gs) => {
        const ax = Math.abs(gs.dx), ay = Math.abs(gs.dy);
        return ax > 8 && ax > ay * 1.8;
      },
      onMoveShouldSetPanResponderCapture: (_, gs) => {
        const ax = Math.abs(gs.dx), ay = Math.abs(gs.dy);
        return ax > 8 && ax > ay * 1.8;
      },

      onPanResponderGrant: () => {
        // Stop any in-progress spring so the row sticks to the finger
        translateX.stopAnimation();
        translateX.setOffset(-activeRef.current * SCREEN_W);
        translateX.setValue(0);
      },

      onPanResponderMove: (_, gs) => {
        // Rubber-band at the edges
        const base   = -activeRef.current * SCREEN_W;
        const raw    = gs.dx;
        const minX   = -(NUM_TABS - 1) * SCREEN_W;
        const maxX   = 0;
        const target = base + raw;
        const rubber = target < minX
          ? minX - (minX - target) * 0.25
          : target > maxX
            ? (target - maxX) * 0.25
            : raw;
        translateX.setValue(rubber);
      },

      onPanResponderRelease: (_, gs) => {
        translateX.flattenOffset();
        const SWIPE_DIST = SCREEN_W * 0.25;
        const SWIPE_VEL  = 0.5;
        let next = activeRef.current;
        if      (gs.dx < -SWIPE_DIST || gs.vx < -SWIPE_VEL) next = Math.min(next + 1, NUM_TABS - 1);
        else if (gs.dx >  SWIPE_DIST || gs.vx >  SWIPE_VEL) next = Math.max(next - 1, 0);
        snapTo(next, -gs.vx * 200);
      },

      onPanResponderTerminate: (_, gs) => {
        translateX.flattenOffset();
        snapTo(activeRef.current, 0);
      },
    })
  ).current;

  const TAB_BAR_H = Platform.OS === "ios" ? 50 + insets.bottom : 54;

  return (
    <View style={styles.root}>
      {/* ─── Pager ───────────────────────────────────────── */}
      <View
        style={[styles.pagerContainer, { bottom: TAB_BAR_H }]}
        {...panResponder.panHandlers}
      >
        <Animated.View
          style={[
            styles.pagerRow,
            { width: SCREEN_W * NUM_TABS, transform: [{ translateX }] },
          ]}
        >
          <View style={{ width: SCREEN_W, flex: 1 }}>
            <HomeScreen />
          </View>
          <View style={{ width: SCREEN_W, flex: 1 }}>
            <FlightsScreen />
          </View>
          <View style={{ width: SCREEN_W, flex: 1 }}>
            <ProfileScreen />
          </View>
        </Animated.View>
      </View>

      {/* ─── Tab bar ────────────────────────────────────── */}
      <View
        style={[
          styles.tabBar,
          {
            height: TAB_BAR_H,
            paddingBottom: insets.bottom,
            backgroundColor: C.card,
            borderTopColor: C.border,
          },
        ]}
      >
        {TABS.map((tab, i) => {
          const isActive = activeTab === i;
          return (
            <Pressable
              key={tab.key}
              onPress={() => snapTo(i)}
              style={styles.tabItem}
              hitSlop={6}
            >
              <Ionicons
                name={tab.icon}
                size={22}
                color={isActive ? C.accent : C.textMuted}
              />
              <Text
                style={[
                  styles.tabLabel,
                  { color: isActive ? C.accent : C.textMuted },
                ]}
              >
                {tab.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    overflow: "hidden",
  },
  pagerContainer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    overflow: "hidden",
  },
  pagerRow: {
    flexDirection: "row",
    flex: 1,
  },
  tabBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    borderTopWidth: 1,
    elevation: 0,
    shadowOpacity: 0,
  },
  tabItem: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 8,
    gap: 3,
  },
  tabLabel: {
    fontSize: 11,
    fontFamily: "DMSans_500Medium",
  },
});
