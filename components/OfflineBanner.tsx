import React, { useEffect, useRef } from "react";
import { Animated, View, Text, StyleSheet, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useNetworkState } from "@/hooks/useNetworkState";
import { useColors } from "@/constants/colors";

const BANNER_H  = 44;
const ANIM_MS   = 320;

/**
 * Global offline banner. Mounts at absolute position 0,0 with a high zIndex
 * so it overlays every screen. Slides in from the top when the device goes
 * offline and slides back out when connectivity restores.
 *
 * Does NOT push content down — it floats above the layout.
 */
export function OfflineBanner() {
  const { isConnected, isInternetReachable } = useNetworkState();
  const insets = useSafeAreaInsets();
  const C      = useColors();

  // true = we should show the banner
  const offline = !isConnected || !isInternetReachable;

  const translateY = useRef(new Animated.Value(-(BANNER_H + insets.top + 8))).current;
  const visibleRef = useRef(false);

  useEffect(() => {
    if (offline && !visibleRef.current) {
      visibleRef.current = true;
      Animated.spring(translateY, {
        toValue: 0,
        useNativeDriver: true,
        bounciness: 4,
        speed: 14,
      }).start();
    } else if (!offline && visibleRef.current) {
      visibleRef.current = false;
      Animated.timing(translateY, {
        toValue: -(BANNER_H + insets.top + 8),
        duration: ANIM_MS,
        useNativeDriver: true,
      }).start();
    }
  }, [offline, insets.top, translateY]);

  return (
    <Animated.View
      style={[
        styles.wrapper,
        { transform: [{ translateY }], paddingTop: insets.top },
      ]}
      // Never intercept touches — screens behind must remain interactive
      pointerEvents="none"
    >
      <View style={[styles.pill, { backgroundColor: C.red }]}>
        <Ionicons
          name={Platform.OS === "ios" ? "wifi-outline" : "wifi-off-outline"}
          size={14}
          color="#fff"
          style={{ marginRight: 6 }}
        />
        <Text style={styles.label}>No internet connection</Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 9999,
    elevation: 20,           // Android stacking
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
    minHeight: BANNER_H,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 6,
  },
  label: {
    color: "#fff",
    fontSize: 13,
    fontFamily: "DMSans_600SemiBold",
    letterSpacing: 0.1,
  },
});
