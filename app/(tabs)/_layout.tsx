/**
 * Custom animated tab pager — edge-swipe only.
 *
 * The PanResponder is intentionally attached ONLY to two thin
 * invisible overlay strips on the left and right screen edges
 * (EDGE_ZONE_W = 40px). Nothing in the centre of the screen —
 * including the GlobeView — can ever trigger a tab switch,
 * because those Views never receive the pager's pan handlers.
 *
 * Tab-bar icon taps still switch tabs as normal.
 */
import React, { useRef, useState, useCallback, useEffect } from "react";
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
import { GestureLockProvider } from "@/context/gesture-lock";
import { TabNavProvider, useTabNav } from "@/context/tab-nav";

import HomeScreen    from "./index";
import FlightsScreen from "./flights";
import TripsScreen   from "./trips";
import ProfileScreen from "./profile";

const { width: SCREEN_W } = Dimensions.get("window");
const NUM_TABS    = 4;
const EDGE_ZONE_W = 40;

const TABS = [
  { key: "home",    label: "Home",    icon: "home-outline"       as const },
  { key: "flights", label: "Flights", icon: "airplane-outline"   as const },
  { key: "trips",   label: "Trips",   icon: "briefcase-outline"  as const },
  { key: "profile", label: "Profile", icon: "person-outline"     as const },
] as const;

function TabPager() {
  const C      = useColors();
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState(0);
  const { registerSnapTo } = useTabNav();

  const translateX = useRef(new Animated.Value(0)).current;
  const activeRef  = useRef(0);

  const snapTo = useCallback(
    (index: number, velocity = 0) => {
      Animated.spring(translateX, {
        toValue:  -index * SCREEN_W,
        velocity,
        tension:  68,
        friction: 11,
        useNativeDriver: true,
      }).start();
      activeRef.current = index;
      setActiveTab(index);
      Haptics.selectionAsync();
    },
    [translateX],
  );

  // Register snapTo with the context so any screen can call switchTab()
  useEffect(() => {
    registerSnapTo(snapTo);
  }, [registerSnapTo, snapTo]);

  const makePanResponder = useCallback(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder:        () => true,
        onStartShouldSetPanResponderCapture: () => true,
        onMoveShouldSetPanResponder:         () => true,
        onMoveShouldSetPanResponderCapture:  () => true,

        onPanResponderGrant: () => {
          translateX.stopAnimation();
          translateX.setOffset(-activeRef.current * SCREEN_W);
          translateX.setValue(0);
        },

        onPanResponderMove: (_, gs) => {
          const base   = -activeRef.current * SCREEN_W;
          const minX   = -(NUM_TABS - 1) * SCREEN_W;
          const maxX   = 0;
          const target = base + gs.dx;
          const rubber =
            target < minX
              ? minX - (minX - target) * 0.25
              : target > maxX
              ? (target - maxX) * 0.25
              : gs.dx;
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

        onPanResponderTerminate: () => {
          translateX.flattenOffset();
          snapTo(activeRef.current, 0);
        },
      }),
    [translateX, snapTo],
  );

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const leftPR  = useRef(makePanResponder()).current;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const rightPR = useRef(makePanResponder()).current;

  const TAB_BAR_H = Platform.OS === "ios" ? 50 + insets.bottom : 54;

  return (
    <View style={styles.root}>
      {/* ── Pager content ─────────────────────────────────── */}
      <View style={[styles.pagerContainer, { bottom: TAB_BAR_H }]}>
        <Animated.View
          style={[
            styles.pagerRow,
            { width: SCREEN_W * NUM_TABS, transform: [{ translateX }] },
          ]}
        >
          <View style={{ width: SCREEN_W, flex: 1 }}><HomeScreen /></View>
          <View style={{ width: SCREEN_W, flex: 1 }}><FlightsScreen /></View>
          <View style={{ width: SCREEN_W, flex: 1 }}><TripsScreen /></View>
          <View style={{ width: SCREEN_W, flex: 1 }}><ProfileScreen /></View>
        </Animated.View>
      </View>

      {/* ── Left edge swipe zone ─────────────────────────── */}
      <View style={[styles.edgeZone, styles.edgeLeft, { bottom: TAB_BAR_H }]} {...leftPR.panHandlers} />

      {/* ── Right edge swipe zone ────────────────────────── */}
      <View style={[styles.edgeZone, styles.edgeRight, { bottom: TAB_BAR_H }]} {...rightPR.panHandlers} />

      {/* ── Tab bar ─────────────────────────────────────── */}
      <View
        style={[
          styles.tabBar,
          { height: TAB_BAR_H, paddingBottom: insets.bottom, backgroundColor: C.card, borderTopColor: C.border },
        ]}
      >
        {TABS.map((tab, i) => {
          const isActive = activeTab === i;
          return (
            <Pressable key={tab.key} onPress={() => snapTo(i)} style={styles.tabItem} hitSlop={6}>
              <Ionicons name={tab.icon} size={22} color={isActive ? C.accent : C.textMuted} />
              <Text style={[styles.tabLabel, { color: isActive ? C.accent : C.textMuted }]}>{tab.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export default function TabLayout() {
  return (
    <TabNavProvider>
      <GestureLockProvider>
        <TabPager />
      </GestureLockProvider>
    </TabNavProvider>
  );
}

const styles = StyleSheet.create({
  root:           { flex: 1, overflow: "hidden" },
  pagerContainer: { position: "absolute", top: 0, left: 0, right: 0, overflow: "hidden" },
  pagerRow:       { flexDirection: "row", flex: 1 },
  edgeZone:       { position: "absolute", top: 0, width: EDGE_ZONE_W },
  edgeLeft:       { left: 0 },
  edgeRight:      { right: 0 },
  tabBar: {
    position: "absolute", bottom: 0, left: 0, right: 0,
    flexDirection: "row", borderTopWidth: 1, elevation: 0, shadowOpacity: 0,
  },
  tabItem:  { flex: 1, alignItems: "center", justifyContent: "center", paddingTop: 8, gap: 3 },
  tabLabel: { fontSize: 11, fontFamily: "DMSans_500Medium" },
});
