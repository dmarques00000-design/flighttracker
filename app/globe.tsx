/**
 * Full-screen interactive globe — no tab bar.
 *
 * The canvas is SCREEN_H × SCREEN_H (a square as tall as the screen).
 * We pass rBase={SCREEN_H / 2} so the sphere starts exactly touching
 * all four edges of the screen with zero overflow and no clipping needed.
 * The root View no longer needs overflow:hidden.
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

// Canvas is a square as tall as the screen; the sphere radius is
// exactly half the screen height so the sphere fills the viewport
// edge-to-edge with no overflow and no clipping required.
const GLOBE_SIZE = SCREEN_H;
const GLOBE_R_BASE = SCREEN_H / 2;

export default function GlobeScreen() {
  const C = useColors();
  const insets = useSafeAreaInsets();
  const { flights } = useFlights();
  const [dragging, setDragging] = useState(false);

  const topInset = Platform.OS === "web" ? 24 : insets.top;

  return (
    <View style={[styles.root, { backgroundColor: C.bg }]}>
      <StatusBar barStyle="light-content" />

      <Animated.View entering={FadeIn.duration(300)} style={styles.globeWrap}>
        <GlobeView
          flights={flights}
          size={GLOBE_SIZE}
          rBase={GLOBE_R_BASE}
          onDragStart={() => setDragging(true)}
          onDragEnd={() => setDragging(false)}
        />
      </Animated.View>

      {/* Back button */}
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

      {/* Hint */}
      {!dragging && (
        <Animated.View
          entering={FadeIn.delay(400).duration(300)}
          style={[
            styles.hintWrap,
            { bottom: (Platform.OS === "web" ? 24 : insets.bottom) + 24 },
          ]}
        >
          <Text style={[styles.hint, { color: C.textMuted }]}>
            Drag to rotate  ·  Pinch to zoom
          </Text>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    // No overflow:hidden needed — sphere fits exactly inside the screen
  },
  globeWrap: {
    width: SCREEN_W,
    height: SCREEN_H,
    alignItems: "center",
    justifyContent: "center",
    overflow: "visible",
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
