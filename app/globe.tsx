/**
 * Full-screen interactive globe — no tab bar.
 *
 * GLOBE_SIZE = SCREEN_W  (portrait width, typically 390-430 px).
 * The SVG canvas is exactly that square, centred in the viewport.
 * Because GlobeView's R_BASE = SIZE * 0.44 and R_MAX = SIZE * 1.8,
 * the globe starts fitting the screen comfortably and the user can
 * pinch-zoom until it fills edge-to-edge — at which point the canvas
 * clips cleanly (overflow:hidden) so no empty border is ever visible.
 *
 * A floating back arrow returns to the home screen.
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

// The canvas is the screen width (portrait) so the globe starts at a
// comfortable size. R_MAX inside GlobeView is SIZE*1.8, meaning the user
// can zoom until the sphere fills the entire screen with no canvas edge
// becoming visible.
const GLOBE_SIZE = SCREEN_W;

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

      {/* Back button — floating, hidden while dragging */}
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
            onPress={() => {
              Haptics.selectionAsync();
              router.back();
            }}
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
    // Clip the globe when it's zoomed beyond the viewport
    overflow: "hidden",
  },
  globeWrap: {
    width: SCREEN_W,
    height: SCREEN_H,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
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
