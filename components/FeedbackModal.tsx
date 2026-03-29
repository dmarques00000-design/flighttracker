import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  Platform,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import { useColors } from "@/constants/colors";
import { apiRequest } from "@/lib/query-client";
import { BottomSheet } from "@/components/BottomSheet";

type Category = "Bug" | "Suggestion" | "General" | "Performance" | "UI/UX";

const CATEGORIES: { value: Category; label: string; icon: string; desc: string }[] = [
  { value: "Bug",         label: "Bug",         icon: "bug-outline",            desc: "Something isn't working" },
  { value: "Suggestion",  label: "Suggestion",  icon: "bulb-outline",           desc: "An idea or improvement" },
  { value: "UI/UX",       label: "UI / UX",     icon: "color-palette-outline",  desc: "Design or usability" },
  { value: "Performance", label: "Performance", icon: "speedometer-outline",    desc: "Speed or reliability" },
  { value: "General",     label: "General",     icon: "chatbubble-outline",     desc: "Anything else" },
];

const APP_VERSION = "1.0.0-beta";

interface Props {
  visible: boolean;
  onClose: () => void;
  userName?: string;
  userEmail?: string;
}

export function FeedbackModal({ visible, onClose, userName, userEmail }: Props) {
  const C = useColors();
  const [category, setCategory] = useState<Category>("General");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setCategory("General");
    setMessage("");
    setLoading(false);
    setSent(false);
    setError(null);
  }

  function handleClose() {
    onClose();
    setTimeout(reset, 400);
  }

  async function handleSubmit() {
    if (message.trim().length < 3) {
      setError("Please write at least a few words so we can help you better.");
      return;
    }
    setError(null);
    setLoading(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      await apiRequest("POST", "/api/feedback", {
        category,
        message: message.trim(),
        userName,
        userEmail,
        appVersion: APP_VERSION,
        platform: Platform.OS,
      });
      setSent(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      setError("Couldn't send your feedback right now. Please try again.");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setLoading(false);
    }
  }

  return (
    <BottomSheet
      visible={visible}
      onClose={handleClose}
      title="Beta Feedback"
      avoidKeyboard
      maxHeight={0.92}
    >
      <ScrollView
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 20, paddingBottom: 32 }}
      >
        {sent ? (
          <Animated.View entering={FadeIn.springify()} style={{ alignItems: "center", paddingVertical: 56, gap: 16 }}>
            <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: C.green + "22", alignItems: "center", justifyContent: "center" }}>
              <Ionicons name="checkmark-circle" size={40} color={C.green} />
            </View>
            <Text style={{ fontSize: 20, color: C.text, fontFamily: "DMSans_700Bold", textAlign: "center" }}>
              Thanks for your feedback!
            </Text>
            <Text style={{ fontSize: 14, color: C.textSec, fontFamily: "DMSans_400Regular", textAlign: "center", lineHeight: 20 }}>
              We read every submission and use it to make Logbook better during beta.
            </Text>
            <Pressable onPress={handleClose}
              style={({ pressed }) => [{ marginTop: 12, backgroundColor: C.accent, paddingHorizontal: 32, paddingVertical: 14, borderRadius: 14, opacity: pressed ? 0.85 : 1 }]}>
              <Text style={{ fontSize: 15, color: C.white, fontFamily: "DMSans_700Bold" }}>Done</Text>
            </Pressable>
          </Animated.View>
        ) : (
          <Animated.View entering={FadeInDown.springify()} style={{ gap: 20 }}>
            {/* Sub-title */}
            <Text style={{ fontSize: 13, color: C.textSec, fontFamily: "DMSans_400Regular", marginTop: -4 }}>
              Help us improve — every report counts.
            </Text>

            {/* Category picker */}
            <View>
              <Text style={{ fontSize: 12, color: C.textSec, fontFamily: "DMSans_500Medium", textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 10 }}>Category</Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {CATEGORIES.map((cat) => {
                  const active = category === cat.value;
                  return (
                    <Pressable
                      key={cat.value}
                      onPress={() => { setCategory(cat.value); Haptics.selectionAsync(); }}
                      style={[{ flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, borderWidth: 1, backgroundColor: active ? C.accent : C.card, borderColor: active ? C.accent : C.border }]}
                    >
                      <Ionicons name={cat.icon as any} size={14} color={active ? C.white : C.textSec} />
                      <Text style={{ fontSize: 13, fontFamily: active ? "DMSans_700Bold" : "DMSans_400Regular", color: active ? C.white : C.text }}>{cat.label}</Text>
                    </Pressable>
                  );
                })}
              </View>
              <Text style={{ fontSize: 12, color: C.textMuted, fontFamily: "DMSans_400Regular", marginTop: 6 }}>
                {CATEGORIES.find((c) => c.value === category)?.desc}
              </Text>
            </View>

            {/* Message input */}
            <View>
              <Text style={{ fontSize: 12, color: C.textSec, fontFamily: "DMSans_500Medium", textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 8 }}>Your message</Text>
              <TextInput
                style={{ backgroundColor: C.card, borderRadius: 14, padding: 16, fontSize: 15, color: C.text, fontFamily: "DMSans_400Regular", borderWidth: 1, borderColor: error ? C.red + "66" : C.border, minHeight: 120, textAlignVertical: "top" }}
                value={message}
                onChangeText={(t) => { setMessage(t); if (error) setError(null); }}
                placeholder="Describe the issue or idea in as much detail as you like…"
                placeholderTextColor={C.textMuted}
                multiline
                maxLength={2000}
                returnKeyType="default"
              />
              <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 5 }}>
                {error
                  ? <Text style={{ fontSize: 12, color: C.red, fontFamily: "DMSans_400Regular", flex: 1 }}>{error}</Text>
                  : <View />}
                <Text style={{ fontSize: 11, color: C.textMuted, fontFamily: "DMSans_400Regular" }}>{message.length}/2000</Text>
              </View>
            </View>

            {/* Submitter info */}
            {(userName || userEmail) && (
              <View style={{ backgroundColor: C.card, borderRadius: 12, borderWidth: 1, borderColor: C.border, padding: 12, gap: 4 }}>
                <Text style={{ fontSize: 11, color: C.textMuted, fontFamily: "DMSans_500Medium", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 2 }}>Submitted as</Text>
                {userName  && <Text style={{ fontSize: 13, color: C.textSec, fontFamily: "DMSans_400Regular" }}>{userName}</Text>}
                {userEmail && <Text style={{ fontSize: 13, color: C.textSec, fontFamily: "DMSans_400Regular" }}>{userEmail}</Text>}
              </View>
            )}

            {/* Submit */}
            <Pressable
              onPress={handleSubmit}
              disabled={loading}
              style={({ pressed }) => [{ backgroundColor: C.accent, borderRadius: 14, padding: 16, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, opacity: loading || pressed ? 0.75 : 1, marginTop: 4 }]}
            >
              {loading
                ? <ActivityIndicator color={C.white} size="small" />
                : <>
                    <Ionicons name="send-outline" size={17} color={C.white} />
                    <Text style={{ fontSize: 16, color: C.white, fontFamily: "DMSans_700Bold" }}>Send Feedback</Text>
                  </>}
            </Pressable>

            <Text style={{ fontSize: 11, color: C.textMuted, fontFamily: "DMSans_400Regular", textAlign: "center", lineHeight: 16 }}>
              Your feedback is sent privately to the development team only.
            </Text>
          </Animated.View>
        )}
      </ScrollView>
    </BottomSheet>
  );
}
