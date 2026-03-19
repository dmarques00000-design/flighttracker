/**
 * share.tsx — Year Recap share screen
 * Viral-first UX:
 *  - Full-screen card preview (no shrinking)
 *  - Primary CTA: "Share" (system sheet) — large, always visible
 *  - Quick-access: Instagram · WhatsApp · Save
 *  - Period selector stays accessible
 */
import React, { useRef, useState, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Platform,
  ActivityIndicator,
  Alert,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as Sharing from "expo-sharing";
import * as MediaLibrary from "expo-media-library";
import { Linking } from "react-native";
import ViewShot from "react-native-view-shot";
import Animated, { FadeInDown } from "react-native-reanimated";
import { Colors } from "@/constants/colors";
import { useFlights } from "@/context/flights";
import StoryCard, { CARD_WIDTH, CARD_HEIGHT } from "@/components/StoryCard";

// Scale card so it fills ~92% of screen width while keeping aspect ratio
const SCREEN_PAD = 20;

export default function ShareScreen() {
  const insets  = useSafeAreaInsets();
  const { flights } = useFlights();
  const cardRef = useRef<ViewShot>(null);
  const [capturing, setCapturing] = useState(false);

  const currentYear = new Date().getFullYear();
  const [period, setPeriod] = useState<"all" | number>(currentYear);

  const topPad    = Platform.OS === "web" ? 67 : insets.top + 8;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom + 8;

  const years = useMemo(() => {
    const set = new Set<number>();
    flights.forEach((f) => {
      const y = parseInt(f.date.substring(0, 4), 10);
      if (!isNaN(y)) set.add(y);
    });
    return Array.from(set).sort((a, b) => b - a);
  }, [flights]);

  const filtered = useMemo(
    () => period === "all" ? flights : flights.filter((f) => f.date.startsWith(String(period))),
    [flights, period]
  );

  const periodLabel = period === "all" ? "All Time" : String(period);

  async function captureCard(): Promise<string | null> {
    if (!cardRef.current) return null;
    try {
      return await (cardRef.current as unknown as { capture: () => Promise<string> }).capture();
    } catch (e) {
      console.error("Capture failed:", e);
      return null;
    }
  }

  async function handleShare() {
    if (filtered.length === 0) return;
    setCapturing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const uri = await captureCard();
      if (!uri) { Alert.alert("Error", "Could not capture the card. Please try again."); return; }
      const available = await Sharing.isAvailableAsync();
      if (available) {
        await Sharing.shareAsync(uri, { mimeType: "image/png", dialogTitle: "Share your year in the air" });
      } else {
        Alert.alert("Sharing not available", "Please save the image and share manually.");
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } finally {
      setCapturing(false);
    }
  }

  async function handleSaveToPhotos() {
    if (filtered.length === 0) return;
    setCapturing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      const uri = await captureCard();
      if (!uri) { Alert.alert("Error", "Could not capture the card."); return; }
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission needed", "Allow photo library access to save your card."); return;
      }
      await MediaLibrary.saveToLibraryAsync(uri);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert("Saved!", "Recap saved to your camera roll. Open Instagram Stories to post it!");
    } finally {
      setCapturing(false);
    }
  }

  async function handleInstagram() {
    if (filtered.length === 0) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setCapturing(true);
    try {
      const uri = await captureCard();
      if (!uri) return;
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status === "granted") await MediaLibrary.saveToLibraryAsync(uri);
      const canOpen = await Linking.canOpenURL("instagram://story-camera");
      if (canOpen) {
        await Linking.openURL("instagram://story-camera");
      } else {
        const available = await Sharing.isAvailableAsync();
        if (available) await Sharing.shareAsync(uri, { mimeType: "image/png" });
      }
    } finally {
      setCapturing(false);
    }
  }

  async function handleWhatsApp() {
    if (filtered.length === 0) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setCapturing(true);
    try {
      const uri = await captureCard();
      if (!uri) return;
      const available = await Sharing.isAvailableAsync();
      if (available) await Sharing.shareAsync(uri, { mimeType: "image/png" });
    } finally {
      setCapturing(false);
    }
  }

  // Scale factor to fit card in available width
  const availableW = 390 - SCREEN_PAD * 2; // approx full-width preview
  const scale      = availableW / CARD_WIDTH;
  const previewH   = CARD_HEIGHT * scale;

  return (
    <View style={[st.container, { paddingTop: topPad }]}>

      {/* ── NAV BAR ── */}
      <View style={st.navBar}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={st.navBack}>
          <Ionicons name="close" size={22} color={Colors.textSec} />
        </Pressable>
        <View style={st.navCenter}>
          <Text style={st.navSub}>Logbook</Text>
          <Text style={st.navTitle}>Year Recap</Text>
        </View>
        {/* Share icon shortcut */}
        <Pressable
          onPress={handleShare}
          disabled={capturing || filtered.length === 0}
          style={({ pressed }) => [st.navShareBtn, { opacity: capturing || pressed ? 0.6 : 1 }]}
          hitSlop={8}
        >
          {capturing
            ? <ActivityIndicator size="small" color={Colors.accent} />
            : <Ionicons name="share-outline" size={20} color={Colors.accent} />}
        </Pressable>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[st.scroll, { paddingBottom: bottomPad + 16 }]}
      >
        {/* ── Period selector ── */}
        <Animated.View entering={FadeInDown.delay(0).springify()} style={st.periodRow}>
          <Pressable
            onPress={() => { Haptics.selectionAsync(); setPeriod("all"); }}
            style={[st.pill, period === "all" && st.pillActive]}
          >
            <Text style={[st.pillText, period === "all" && st.pillTextActive]}>All Time</Text>
          </Pressable>
          {years.map((y) => (
            <Pressable
              key={y}
              onPress={() => { Haptics.selectionAsync(); setPeriod(y); }}
              style={[st.pill, period === y && st.pillActive]}
            >
              <Text style={[st.pillText, period === y && st.pillTextActive]}>{y}</Text>
            </Pressable>
          ))}
        </Animated.View>

        {/* ── Card preview (full-res, scaled to fit) ── */}
        <Animated.View entering={FadeInDown.delay(50).springify()} style={st.cardOuter}>
          <ViewShot
            ref={cardRef}
            options={{ format: "png", quality: 1.0 }}
            style={[
              st.cardShot,
              {
                width: availableW,
                height: previewH,
              },
            ]}
          >
            <View
              style={{
                width: CARD_WIDTH,
                height: CARD_HEIGHT,
                transform: [{ scale }],
                transformOrigin: "top left",
              }}
            >
              <StoryCard flights={filtered} periodLabel={periodLabel} />
            </View>
          </ViewShot>
        </Animated.View>

        {/* ── Story-format hint ── */}
        <Animated.View entering={FadeInDown.delay(90).springify()} style={st.hintRow}>
          <Ionicons name="phone-portrait-outline" size={13} color={Colors.textSec} />
          <Text style={st.hintText}>
            9:16 story card \u2014 perfect for Instagram Stories, WhatsApp and more.
          </Text>
        </Animated.View>

        {/* ── PRIMARY CTA ── */}
        <Animated.View entering={FadeInDown.delay(130).springify()} style={st.actions}>
          <Pressable
            onPress={handleShare}
            disabled={capturing || filtered.length === 0}
            style={({ pressed }) => [
              st.shareBtn,
              { opacity: capturing || filtered.length === 0 ? 0.45 : pressed ? 0.87 : 1,
                transform: [{ scale: pressed ? 0.98 : 1 }] },
            ]}
          >
            {capturing
              ? <ActivityIndicator color={Colors.white} size="small" />
              : <>
                  <Ionicons name="share-social-outline" size={21} color={Colors.white} />
                  <Text style={st.shareBtnText}>Share Year Recap</Text>
                </>}
          </Pressable>

          {/* ── Quick actions ── */}
          <View style={st.quickRow}>
            <Pressable
              onPress={handleInstagram}
              disabled={capturing}
              style={({ pressed }) => [st.quickBtn, { opacity: pressed ? 0.7 : 1 }]}
            >
              <View style={[st.quickIcon, { backgroundColor: "#C13584" }]}>
                <Ionicons name="logo-instagram" size={22} color="#fff" />
              </View>
              <Text style={st.quickLabel}>Instagram</Text>
            </Pressable>

            <Pressable
              onPress={handleWhatsApp}
              disabled={capturing}
              style={({ pressed }) => [st.quickBtn, { opacity: pressed ? 0.7 : 1 }]}
            >
              <View style={[st.quickIcon, { backgroundColor: "#25D366" }]}>
                <Ionicons name="logo-whatsapp" size={22} color="#fff" />
              </View>
              <Text style={st.quickLabel}>WhatsApp</Text>
            </Pressable>

            <Pressable
              onPress={handleSaveToPhotos}
              disabled={capturing}
              style={({ pressed }) => [st.quickBtn, { opacity: pressed ? 0.7 : 1 }]}
            >
              <View style={[st.quickIcon, { backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border }]}>
                <Ionicons name="download-outline" size={22} color={Colors.text} />
              </View>
              <Text style={st.quickLabel}>Save</Text>
            </Pressable>
          </View>
        </Animated.View>

        {filtered.length === 0 && (
          <Text style={st.noFlights}>No flights logged for {periodLabel}.</Text>
        )}
      </ScrollView>
    </View>
  );
}

const st = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },

  navBar: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 20, paddingBottom: 10,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  navBack: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  navCenter: { flex: 1, alignItems: "center", gap: 1 },
  navSub: { fontSize: 10, color: Colors.textSec, fontFamily: "DMSans_400Regular", letterSpacing: 0.5, textTransform: "uppercase" },
  navTitle: { fontSize: 16, color: Colors.text, fontFamily: "DMSans_700Bold" },
  navShareBtn: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },

  scroll: { paddingHorizontal: SCREEN_PAD, alignItems: "center", gap: 20, paddingTop: 16 },

  periodRow: { flexDirection: "row", gap: 8, flexWrap: "wrap", justifyContent: "center" },
  pill: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border },
  pillActive: { backgroundColor: Colors.accent, borderColor: Colors.accent },
  pillText: { fontSize: 13, color: Colors.textSec, fontFamily: "DMSans_500Medium" },
  pillTextActive: { color: Colors.white },

  cardOuter: { alignItems: "center", width: "100%" },
  cardShot: {
    borderRadius: 24, overflow: "hidden",
    shadowColor: "#4F8EF0", shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.30, shadowRadius: 32, elevation: 18,
  },

  hintRow: { flexDirection: "row", gap: 7, alignItems: "center" },
  hintText: { fontSize: 12, color: Colors.textSec, fontFamily: "DMSans_400Regular", lineHeight: 17 },

  actions: { width: "100%", gap: 16 },
  shareBtn: {
    backgroundColor: Colors.accent, borderRadius: 16, paddingVertical: 18,
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10,
  },
  shareBtnText: { fontSize: 17, color: Colors.white, fontFamily: "DMSans_700Bold" },

  quickRow: { flexDirection: "row", justifyContent: "center", gap: 28 },
  quickBtn: { alignItems: "center", gap: 7 },
  quickIcon: { width: 56, height: 56, borderRadius: 17, alignItems: "center", justifyContent: "center" },
  quickLabel: { fontSize: 12, color: Colors.textSec, fontFamily: "DMSans_400Regular" },

  noFlights: { fontSize: 14, color: Colors.textSec, fontFamily: "DMSans_400Regular", textAlign: "center" },
});
