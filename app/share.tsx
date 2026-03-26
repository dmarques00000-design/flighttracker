/**
 * share.tsx — Year Recap share screen
 * Viral-first UX:
 *  - Full-screen card preview (no shrinking)
 *  - Primary CTA: "Share" (system sheet) — large, always visible
 *  - Quick-access: Instagram · WhatsApp · Save
 *  - Period selector + card theme toggle (Dark / Light)
 */
import React, { useRef, useState, useMemo } from "react";
import {
  View,
  Text,
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
import { useColors } from "@/constants/colors";
import { CardTheme } from "@/constants/cardThemes";
import { useFlights } from "@/context/flights";
import StoryCard, { CARD_WIDTH, CARD_HEIGHT } from "@/components/StoryCard";

const SCREEN_PAD = 20;

export default function ShareScreen() {
  const C = useColors();
  const insets  = useSafeAreaInsets();
  const { flights } = useFlights();
  const cardRef = useRef<ViewShot>(null);
  const [capturing, setCapturing] = useState(false);

  const currentYear = new Date().getFullYear();
  const [period, setPeriod] = useState<"all" | number>(currentYear);
  const [cardTheme, setCardTheme] = useState<CardTheme>("dark");

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

  const availableW = 390 - SCREEN_PAD * 2;
  const scale      = availableW / CARD_WIDTH;
  const previewH   = CARD_HEIGHT * scale;

  return (
    <View style={{ flex: 1, backgroundColor: C.bg, paddingTop: topPad }}>

      {/* ── NAV BAR ── */}
      <View style={{
        flexDirection: "row", alignItems: "center", justifyContent: "space-between",
        paddingHorizontal: 20, paddingBottom: 10,
        borderBottomWidth: 1, borderBottomColor: C.border,
      }}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={{ width: 36, height: 36, alignItems: "center", justifyContent: "center" }}>
          <Ionicons name="close" size={22} color={C.textSec} />
        </Pressable>
        <View style={{ flex: 1, alignItems: "center", gap: 1 }}>
          <Text style={{ fontSize: 10, color: C.textSec, fontFamily: "DMSans_400Regular", letterSpacing: 0.5, textTransform: "uppercase" }}>Logbook</Text>
          <Text style={{ fontSize: 16, color: C.text, fontFamily: "DMSans_700Bold" }}>Year Recap</Text>
        </View>
        <Pressable
          onPress={handleShare}
          disabled={capturing || filtered.length === 0}
          style={({ pressed }) => [{ width: 36, height: 36, alignItems: "center", justifyContent: "center" }, { opacity: capturing || pressed ? 0.6 : 1 }]}
          hitSlop={8}
        >
          {capturing
            ? <ActivityIndicator size="small" color={C.accent} />
            : <Ionicons name="share-outline" size={20} color={C.accent} />}
        </Pressable>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: SCREEN_PAD, alignItems: "center", gap: 20, paddingTop: 16, paddingBottom: bottomPad + 16 }}
      >
        {/* ── Period selector ── */}
        <Animated.View entering={FadeInDown.delay(0).springify()} style={{ flexDirection: "row", gap: 8, flexWrap: "wrap", justifyContent: "center" }}>
          <Pressable
            onPress={() => { Haptics.selectionAsync(); setPeriod("all"); }}
            style={[
              { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, borderWidth: 1 },
              period === "all"
                ? { backgroundColor: C.accent, borderColor: C.accent }
                : { backgroundColor: C.card, borderColor: C.border },
            ]}
          >
            <Text style={{ fontSize: 13, fontFamily: "DMSans_500Medium", color: period === "all" ? C.white : C.textSec }}>All Time</Text>
          </Pressable>
          {years.map((y) => (
            <Pressable
              key={y}
              onPress={() => { Haptics.selectionAsync(); setPeriod(y); }}
              style={[
                { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, borderWidth: 1 },
                period === y
                  ? { backgroundColor: C.accent, borderColor: C.accent }
                  : { backgroundColor: C.card, borderColor: C.border },
              ]}
            >
              <Text style={{ fontSize: 13, fontFamily: "DMSans_500Medium", color: period === y ? C.white : C.textSec }}>{y}</Text>
            </Pressable>
          ))}
        </Animated.View>

        {/* ── Card theme toggle ── */}
        <Animated.View entering={FadeInDown.delay(30).springify()} style={{ flexDirection: "row", alignItems: "center", gap: 0, backgroundColor: C.surface, borderRadius: 14, borderWidth: 1, borderColor: C.border, padding: 4 }}>
          {/* Dark option */}
          <Pressable
            onPress={() => { Haptics.selectionAsync(); setCardTheme("dark"); }}
            style={[
              { flexDirection: "row", alignItems: "center", gap: 7, paddingHorizontal: 16, paddingVertical: 9, borderRadius: 11 },
              cardTheme === "dark" && { backgroundColor: C.card, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.12, shadowRadius: 6, elevation: 3 },
            ]}
          >
            <Ionicons name="moon" size={15} color={cardTheme === "dark" ? C.accent : C.textMuted} />
            <Text style={{ fontSize: 13, fontFamily: cardTheme === "dark" ? "DMSans_700Bold" : "DMSans_400Regular", color: cardTheme === "dark" ? C.text : C.textMuted }}>Dark</Text>
          </Pressable>

          {/* Light option */}
          <Pressable
            onPress={() => { Haptics.selectionAsync(); setCardTheme("light"); }}
            style={[
              { flexDirection: "row", alignItems: "center", gap: 7, paddingHorizontal: 16, paddingVertical: 9, borderRadius: 11 },
              cardTheme === "light" && { backgroundColor: C.card, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.12, shadowRadius: 6, elevation: 3 },
            ]}
          >
            <Ionicons name="sunny" size={15} color={cardTheme === "light" ? C.amber : C.textMuted} />
            <Text style={{ fontSize: 13, fontFamily: cardTheme === "light" ? "DMSans_700Bold" : "DMSans_400Regular", color: cardTheme === "light" ? C.text : C.textMuted }}>Light</Text>
          </Pressable>
        </Animated.View>

        {/* ── Card preview (full-res, scaled to fit) ── */}
        <Animated.View entering={FadeInDown.delay(50).springify()} style={{ alignItems: "center", width: "100%" }}>
          <ViewShot
            ref={cardRef}
            options={{ format: "png", quality: 1.0 }}
            style={{
              width: availableW,
              height: previewH,
              borderRadius: 24,
              overflow: "hidden",
              shadowColor: "#4F8EF0",
              shadowOffset: { width: 0, height: 14 },
              shadowOpacity: 0.30,
              shadowRadius: 32,
              elevation: 18,
            }}
          >
            <View
              style={{
                width: CARD_WIDTH,
                height: CARD_HEIGHT,
                transform: [{ scale }],
                transformOrigin: "top left",
              }}
            >
              <StoryCard flights={filtered} periodLabel={periodLabel} theme={cardTheme} />
            </View>
          </ViewShot>
        </Animated.View>

        {/* ── Story-format hint ── */}
        <Animated.View entering={FadeInDown.delay(90).springify()} style={{ flexDirection: "row", gap: 7, alignItems: "center" }}>
          <Ionicons name="phone-portrait-outline" size={13} color={C.textSec} />
          <Text style={{ fontSize: 12, color: C.textSec, fontFamily: "DMSans_400Regular", lineHeight: 17 }}>
            9:16 story card \u2014 perfect for Instagram Stories, WhatsApp and more.
          </Text>
        </Animated.View>

        {/* ── PRIMARY CTA ── */}
        <Animated.View entering={FadeInDown.delay(130).springify()} style={{ width: "100%", gap: 16 }}>
          <Pressable
            onPress={handleShare}
            disabled={capturing || filtered.length === 0}
            style={({ pressed }) => [
              { backgroundColor: C.accent, borderRadius: 16, paddingVertical: 18, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10 },
              { opacity: capturing || filtered.length === 0 ? 0.45 : pressed ? 0.87 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] },
            ]}
          >
            {capturing
              ? <ActivityIndicator color={C.white} size="small" />
              : <>
                  <Ionicons name="share-social-outline" size={21} color={C.white} />
                  <Text style={{ fontSize: 17, color: C.white, fontFamily: "DMSans_700Bold" }}>Share Year Recap</Text>
                </>}
          </Pressable>

          {/* ── Quick actions ── */}
          <View style={{ flexDirection: "row", justifyContent: "center", gap: 28 }}>
            <Pressable
              onPress={handleInstagram}
              disabled={capturing}
              style={({ pressed }) => [{ alignItems: "center", gap: 7 }, { opacity: pressed ? 0.7 : 1 }]}
            >
              <View style={{ width: 56, height: 56, borderRadius: 17, backgroundColor: "#C13584", alignItems: "center", justifyContent: "center" }}>
                <Ionicons name="logo-instagram" size={22} color="#fff" />
              </View>
              <Text style={{ fontSize: 12, color: C.textSec, fontFamily: "DMSans_400Regular" }}>Instagram</Text>
            </Pressable>

            <Pressable
              onPress={handleWhatsApp}
              disabled={capturing}
              style={({ pressed }) => [{ alignItems: "center", gap: 7 }, { opacity: pressed ? 0.7 : 1 }]}
            >
              <View style={{ width: 56, height: 56, borderRadius: 17, backgroundColor: "#25D366", alignItems: "center", justifyContent: "center" }}>
                <Ionicons name="logo-whatsapp" size={22} color="#fff" />
              </View>
              <Text style={{ fontSize: 12, color: C.textSec, fontFamily: "DMSans_400Regular" }}>WhatsApp</Text>
            </Pressable>

            <Pressable
              onPress={handleSaveToPhotos}
              disabled={capturing}
              style={({ pressed }) => [{ alignItems: "center", gap: 7 }, { opacity: pressed ? 0.7 : 1 }]}
            >
              <View style={{ width: 56, height: 56, borderRadius: 17, backgroundColor: C.card, borderWidth: 1, borderColor: C.border, alignItems: "center", justifyContent: "center" }}>
                <Ionicons name="download-outline" size={22} color={C.text} />
              </View>
              <Text style={{ fontSize: 12, color: C.textSec, fontFamily: "DMSans_400Regular" }}>Save</Text>
            </Pressable>
          </View>
        </Animated.View>

        {filtered.length === 0 && (
          <Text style={{ fontSize: 14, color: C.textSec, fontFamily: "DMSans_400Regular", textAlign: "center" }}>No flights logged for {periodLabel}.</Text>
        )}
      </ScrollView>
    </View>
  );
}
