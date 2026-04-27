/**
 * Full-screen interactive globe — no tab bar.
 *
 * Fix: the gesture-capture View inside GlobeView must have explicit
 * screen-filling dimensions so PanResponder receives all touches.
 * We now use a StyleSheet.absoluteFill container that owns the full
 * screen, with the GlobeView inside it.
 * The back button and hint sit in a sibling absoluteFill View so
 * they never intercept globe touches (pointerEvents="box-none").
 */
import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  Platform,
  StatusBar,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Animated, { FadeIn } from "react-native-reanimated";
import { Pressable } from "react-native";
import { useColors } from "@/constants/colors";
import { useFlights } from "@/context/flights";
import GlobeView from "@/components/GlobeView";

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get("window");

// Canvas is the full screen height so the sphere is never clipped vertically.
const GLOBE_SIZE = SCREEN_H;

// Sphere radius derived from the narrow dimension (width) so the globe sits
// edge-to-edge horizontally with natural breathing room top/bottom.
const GLOBE_R_BASE = (SCREEN_W / 2) * 0.88;

export default function GlobeScreen() {
  const C = useColors();
  const insets = useSafeAreaInsets();
  const { flights } = useFlights();
  const [dragging, setDragging] = useState(false);

  const topInset = Platform.OS === "web" ? 24 : insets.top;
  const bottomInset = Platform.OS === "web" ? 24 : insets.bottom;

  return (
    <View style={[styles.root, { backgroundColor: C.bg }]}>
      <StatusBar barStyle="light-content" />

      {/*
       * Globe layer — fills the entire screen so the PanResponder
       * inside GlobeView has a properly-sized hit area.
       * This is the key fix: previously the Animated.View had
       * overflow:visible but no guaranteed fill, so touches near
       * the edges fell through to the screen behind it.
       */}
      <View style={styles.globeLayer}>
        <Animated.View entering={FadeIn.duration(300)} style={styles.globeCenter}>
          <GlobeView
            flights={flights}
            size={GLOBE_SIZE}
            rBase={GLOBE_R_BASE}
            onDragStart={() => setDragging(true)}
            onDragEnd={() => setDragging(false)}
          />
        </Animated.View>
      </View>

      {/*
       * UI overlay — pointerEvents="box-none" means this View itself
       * does NOT intercept touches (they pass through to the globe layer),
       * but its children (buttons) still receive taps normally.
       */}
      <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
        {/* Back button — hidden while dragging so it doesn't block gestures */}
        {!dragging && (
          <Animated.View
            entering={FadeIn.duration(200)}
            style={[
              styles.backBtn,
              {
                top: topInset + 12,
                backgroundColor: C.card,
                borderColor: C.border,
                shadowColor: C.text,
              },
            ]}
          >
            <Pressable
              onPress={() => { Haptics.selectionAsync(); router.back(); }}
              style={({ pressed }) => [styles.backPressable, { opacity: pressed ? 0.7 : 1 }]}
              hitSlop={10}
            >
              <Ionicons name="arrow-back" size={20} color={C.text} />
            </Pressable>
          </Animated.View>
        )}

        {/* Drag hint — hidden while dragging */}
        {!dragging && (
          <Animated.View
            entering={FadeIn.delay(400).duration(300)}
            style={[styles.hintWrap, { bottom: bottomInset + 24 }]}
          >
            <Text style={[styles.hint, { color: C.textMuted }]}>
              Drag to rotate  ·  Pinch to zoom
            </Text>
          </Animated.View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  // Full-screen layer that gives PanResponder a properly-sized touch area.
  globeLayer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
  // Centers the GlobeView canvas within the layer.
  globeCenter: {
    width: SCREEN_W,
    height: SCREEN_H,
    alignItems: "center",
    justifyContent: "center",
  },
  backBtn: {
    position: "absolute",
    left: 20,
    borderRadius: 22,
    borderWidth: 1,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.10,
    shadowRadius: 8,
    elevation: 4,
  },
  backPressable: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 22,
  },
  hintWrap: {
    position: "absolute",
    alignSelf: "center",
  },
  hint: {
    fontSize: 12,
    fontFamily: "DMSans_400Regular",
    letterSpacing: 0.4,
  },
});
