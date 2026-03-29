/**
 * BottomSheet — reusable animated bottom sheet.
 *
 * Usage:
 *   <BottomSheet visible={open} onClose={() => setOpen(false)} title="My Sheet">
 *     <Text>Content here</Text>
 *   </BottomSheet>
 *
 * Props:
 *   visible      — controls open/close
 *   onClose      — called when backdrop tapped or handle dragged down
 *   title        — optional header title string
 *   children     — sheet body content
 *   maxHeight    — optional cap on sheet height (default 92% of screen)
 *   showHandle   — show drag handle bar (default true)
 *   avoidKeyboard — wrap in KeyboardAvoidingView (default true)
 */
import React, { useEffect, useRef } from "react";
import {
  View,
  Text,
  Modal,
  Pressable,
  StyleSheet,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
  ScrollView,
} from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  runOnJS,
  Easing,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useColors } from "@/constants/colors";

const SCREEN_H = Dimensions.get("window").height;
const SPRING   = { damping: 26, stiffness: 280, mass: 0.8 };

interface BottomSheetProps {
  visible:       boolean;
  onClose:       () => void;
  title?:        string;
  children:      React.ReactNode;
  /** 0–1 fraction of screen height, or an absolute pixel value > 1 */
  maxHeight?:    number;
  showHandle?:   boolean;
  avoidKeyboard?: boolean;
  /** Extra padding below content (added on top of safe-area bottom) */
  extraBottomPad?: number;
  /** Accessible close button label */
  closeLabel?: string;
}

export function BottomSheet({
  visible,
  onClose,
  title,
  children,
  maxHeight,
  showHandle   = true,
  avoidKeyboard = true,
  extraBottomPad = 0,
  closeLabel = "Close",
}: BottomSheetProps) {
  const C      = useColors();
  const insets = useSafeAreaInsets();

  // Compute pixel max-height
  const maxH = maxHeight
    ? (maxHeight <= 1 ? SCREEN_H * maxHeight : maxHeight)
    : SCREEN_H * 0.92;

  // translateY: 0 = fully visible, SCREEN_H = fully off-screen
  const translateY  = useSharedValue(SCREEN_H);
  const backdropOp  = useSharedValue(0);

  // Track whether the modal node should be mounted at all
  const [mounted, setMounted] = React.useState(false);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      // Animate in on next frame so the layout exists
      requestAnimationFrame(() => {
        translateY.value  = withSpring(0, SPRING);
        backdropOp.value  = withTiming(1, { duration: 220, easing: Easing.out(Easing.quad) });
      });
    } else {
      // Animate out then unmount
      translateY.value  = withSpring(SCREEN_H, { ...SPRING, damping: 32 });
      backdropOp.value  = withTiming(0, { duration: 180 }, () => runOnJS(setMounted)(false));
    }
  }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps

  const sheetStyle    = useAnimatedStyle(() => ({ transform: [{ translateY: translateY.value }] }));
  const backdropStyle = useAnimatedStyle(() => ({ opacity: backdropOp.value }));

  if (!mounted) return null;

  const bottomPad = (Platform.OS === "web" ? 24 : insets.bottom) + extraBottomPad;

  const Inner = (
    <View style={{ flex: 1, justifyContent: "flex-end" }}>
      {/* Backdrop */}
      <TouchableWithoutFeedback onPress={onClose} accessibilityRole="button" accessibilityLabel={closeLabel}>
        <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(0,0,0,0.45)" }, backdropStyle]} />
      </TouchableWithoutFeedback>

      {/* Sheet */}
      <Animated.View
        style={[
          sheetStyle,
          {
            maxHeight: maxH,
            backgroundColor: C.surface,
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            borderWidth: 1,
            borderBottomWidth: 0,
            borderColor: C.border,
            overflow: "hidden",
            // Shadow for depth
            shadowColor: "#000",
            shadowOffset: { width: 0, height: -4 },
            shadowOpacity: 0.12,
            shadowRadius: 20,
            elevation: 16,
          },
        ]}
      >
        {/* Drag handle */}
        {showHandle && (
          <View style={{ alignItems: "center", paddingTop: 10, paddingBottom: 2 }}>
            <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: C.border }} />
          </View>
        )}

        {/* Header row (only if title or close button needed) */}
        {title !== undefined && (
          <View style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            paddingHorizontal: 24,
            paddingTop: showHandle ? 10 : 18,
            paddingBottom: 14,
            borderBottomWidth: 1,
            borderBottomColor: C.border,
          }}>
            <Text style={{ fontSize: 17, color: C.text, fontFamily: "DMSans_700Bold", flex: 1 }}>
              {title}
            </Text>
            <Pressable
              onPress={onClose}
              hitSlop={12}
              accessibilityLabel={closeLabel}
              style={{
                width: 30, height: 30, borderRadius: 15,
                backgroundColor: C.card,
                borderWidth: 1, borderColor: C.border,
                alignItems: "center", justifyContent: "center",
              }}
            >
              <Ionicons name="close" size={16} color={C.textSec} />
            </Pressable>
          </View>
        )}

        {/* Body — consumer controls whether they want a ScrollView inside */}
        <View style={{ paddingBottom: bottomPad }}>
          {children}
        </View>
      </Animated.View>
    </View>
  );

  return (
    <Modal
      visible={mounted}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      {avoidKeyboard ? (
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={{ flex: 1 }}
        >
          {Inner}
        </KeyboardAvoidingView>
      ) : (
        Inner
      )}
    </Modal>
  );
}

export default BottomSheet;
