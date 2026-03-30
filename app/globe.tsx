/**
 * Full-screen interactive globe — no tab bar.
 *
 * GLOBE_SIZE is set to SCREEN_H (the taller dimension) so that
 * R_BASE = SIZE * 0.44 produces a sphere radius that fills the screen
 * vertically. Previously using SCREEN_W left the sphere too small on
 * tall phones, showing cropped/empty space top and bottom.
 *
 * GlobeView's canvas is a GLOBE_SIZE × GLOBE_SIZE square centred in the
 * viewport. With overflow:visible on both this wrapper and GlobeView's
 * inner View, the sphere bleeds freely in all directions — no clipping.
 * Only the outermost root View has overflow:hidden to prevent any bleed
 * past the physical screen boundary when the user zooms in.
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

// Use the larger dimension so the sphere always fills the viewport.
// On portrait phones SCREEN_H > SCREEN_W, so the globe starts large
// enough that the sphere edge meets the top and bottom of the screen.
const GLOBE_SIZE = Math.max(SCREEN_W, SCREEN_H);

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

      {/* Hint label */}
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
    overflow: "hidden",
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
