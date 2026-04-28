/**
 * monthly-recap.tsx — Monthly Recap share screen
 * Same viral-first UX as share.tsx.
 */
import React, { useRef, useState, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Platform,
  ActivityIndicator,
  Alert,
  Linking,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as Sharing from "expo-sharing";
import * as MediaLibrary from "expo-media-library";
import ViewShot from "react-native-view-shot";
import Animated, { FadeInDown, FadeIn } from "react-native-reanimated";
import { Colors } from "@/constants/colors";
import { useFlights } from "@/context/flights";
import MonthlyRecapCard, { CARD_WIDTH, CARD_HEIGHT } from "@/components/MonthlyRecapCard";

const MONTH_NAMES_SHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const MONTH_NAMES_FULL  = ["January","February","March","April","May","June","July","August","September","October","November","December"];

const SCREEN_PAD = 20;

export default function MonthlyRecapScreen() {
  const insets = useSafeAreaInsets();
  const { flights } = useFlights();
  const shareRef = useRef<ViewShot>(null);
  const [sharing, setSharing] = useState(false);

  const now = new Date();
  const [selectedYear,  setSelectedYear]  = useState(now.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth());

  const topPad    = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom + 16;

  const availableYears = useMemo(() => {
    const set = new Set<number>();
    flights.forEach((f) => { const y = parseInt(f.date.substring(0, 4), 10); if (!isNaN(y)) set.add(y); });
    set.add(now.getFullYear());
    return Array.from(set).sort((a, b) => b - a);
  }, [flights]);

  const monthFlights = useMemo(() => {
    const prefix = `${selectedYear}-${String(selectedMonth + 1).padStart(2, "0")}`;
    return flights.filter((f) => f.date.startsWith(prefix));
  }, [flights, selectedYear, selectedMonth]);

  async function captureCard(): Promise<string> {
    return await (shareRef.current as unknown as { capture: () => Promise<string> }).capture();
  }

  async function handleShare() {
    setSharing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const uri = await captureCard();
      const available = await Sharing.isAvailableAsync();
      if (available) {
        await Sharing.shareAsync(uri, {
          mimeType: "image/png",
          dialogTitle: `${MONTH_NAMES_FULL[selectedMonth]} ${selectedYear} Recap`,
        });
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else {
        const { status } = await MediaLibrary.requestPermissionsAsync();
        if (status === "granted") {
          await MediaLibrary.saveToLibraryAsync(uri);
          Alert.alert("Saved!", "Monthly recap saved to your camera roll.");
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } else {
          Alert.alert("Permission needed", "Allow photo library access to save the card.");
        }
      }
    } catch (e) {
      console.error("Share failed:", e);
      Alert.alert("Error", "Could not share the recap. Please try again.");
    } finally {
      setSharing(false);
    }
  }

  async function handleSave() {
    setSharing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      const uri = await captureCard();
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status === "granted") {
        await MediaLibrary.saveToLibraryAsync(uri);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert("Saved!", "Recap saved to your camera roll. Open Instagram Stories to post it!");
      } else {
        Alert.alert("Permission needed", "Allow photo library access to save the card.");
      }
    } catch (e) {
      console.error("Save failed:", e);
    } finally {
      setSharing(false);
    }
  }

  async function handleInstagram() {
    setSharing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const uri = await captureCard();
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status === "granted") await MediaLibrary.saveToLibraryAsync(uri);
      const canOpen = await Linking.canOpenURL("instagram://story-camera");
      if (canOpen) {
        await Linking.openURL("instagram://story-camera");
      } else {
        const av = await Sharing.isAvailableAsync();
        if (av) await Sharing.shareAsync(uri, { mimeType: "image/png" });
      }
    } catch (e) {
      console.error(e);
    } finally {
      setSharing(false);
    }
  }

  // Preview scale
  const availableW = 390 - SCREEN_PAD * 2;
  const scale      = availableW / CARD_WIDTH;
  const previewH   = CARD_HEIGHT * scale;

  return (
    <View style={[m.container, { paddingTop: topPad }]}>

      {/* Hidden full-res capture */}
      <ViewShot
        ref={shareRef}
        options={{ format: "png", quality: 1.0 }}
        style={m.hiddenCapture}
      >
        <MonthlyRecapCard flights={monthFlights} month={selectedMonth} year={selectedYear} />
      </ViewShot>

      {/* ── NAV BAR ── */}
      <View style={m.navBar}>
        <Pressable onPress={() => router.back()} style={m.navBtn} hitSlop={8}>
          <Ionicons name="chevron-back" size={22} color={Colors.text} />
        </Pressable>
        <View style={m.navCenter}>
          <Text style={m.navSub}>Logbook</Text>
          <Text style={m.navTitle}>{MONTH_NAMES_FULL[selectedMonth]} {selectedYear}</Text>
        </View>
        <Pressable
          onPress={handleShare}
          disabled={sharing}
          style={({ pressed }) => [m.navShareBtn, { opacity: sharing || pressed ? 0.6 : 1 }]}
          hitSlop={8}
        >
          {sharing
            ? <ActivityIndicator size="small" color={Colors.accent} />
            : <Ionicons name="share-outline" size={20} color={Colors.accent} />}
        </Pressable>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[m.scroll, { paddingBottom: bottomPad }]}
      >
        {/* ── Year selector ── */}
        <Animated.View entering={FadeInDown.delay(0).springify()} style={m.yearRow}>
          {availableYears.map((y) => (
            <Pressable
              key={y}
              onPress={() => { Haptics.selectionAsync(); setSelectedYear(y); }}
              style={[m.yearPill, selectedYear === y && m.yearPillActive]}
            >
              <Text style={[m.yearText, selectedYear === y && m.yearTextActive]}>{y}</Text>
            </Pressable>
          ))}
        </Animated.View>

        {/* ── Month carousel ── */}
        <Animated.View entering={FadeInDown.delay(40).springify()}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}
            contentContainerStyle={m.monthRow} style={m.monthScroll}
          >
            {MONTH_NAMES_SHORT.map((mn, i) => {
              const prefix = `${selectedYear}-${String(i + 1).padStart(2, "0")}`;
              const cnt    = flights.filter((f) => f.date.startsWith(prefix)).length;
              const active = selectedMonth === i;
              return (
                <Pressable
                  key={mn}
                  onPress={() => { Haptics.selectionAsync(); setSelectedMonth(i); }}
                  style={[m.monthChip, active && m.monthChipActive]}
                >
                  <Text style={[m.monthChipText, active && m.monthChipTextActive]}>{mn}</Text>
                  {cnt > 0 && <View style={[m.monthDot, active && m.monthDotActive]} />}
                </Pressable>
              );
            })}
          </ScrollView>
        </Animated.View>

        {/* Flight count hint */}
        <Animated.View entering={FadeIn.duration(200)} style={m.hintRow}>
          <Ionicons
            name={monthFlights.length > 0 ? "airplane" : "airplane-outline"}
            size={13}
            color={monthFlights.length > 0 ? Colors.accent : Colors.textMuted}
          />
          <Text style={[m.hintText, monthFlights.length > 0 && { color: Colors.accent }]}>
            {monthFlights.length > 0
              ? `${monthFlights.length} flight${monthFlights.length !== 1 ? "s" : ""} this month`
              : "No flights logged for this month"}
          </Text>
        </Animated.View>

        {/* ── Card preview ── */}
        <Animated.View entering={FadeInDown.delay(80).springify()} style={m.previewOuter}>
          <View style={[m.previewFrame, { width: availableW, height: previewH }]}>
            <View style={{ width: CARD_WIDTH, height: CARD_HEIGHT, transform: [{ scale }], transformOrigin: "top left" }}>
              <MonthlyRecapCard flights={monthFlights} month={selectedMonth} year={selectedYear} />
            </View>
          </View>
        </Animated.View>

        {/* ── Story hint ── */}
        <Animated.View entering={FadeInDown.delay(100).springify()} style={m.hintRow}>
          <Ionicons name="phone-portrait-outline" size={13} color={Colors.textSec} />
          <Text style={m.hintText}>9:16 story card — perfect for Instagram Stories, WhatsApp and more.</Text>
        </Animated.View>

        {/* ── PRIMARY CTA ── */}
        <Animated.View entering={FadeInDown.delay(130).springify()} style={m.actions}>
          <Pressable
            onPress={handleShare}
            disabled={sharing}
            style={({ pressed }) => [
              m.shareBtn,
              { opacity: sharing || pressed ? 0.75 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] },
            ]}
          >
            {sharing
              ? <ActivityIndicator size="small" color={Colors.white} />
              : <>
                  <Ionicons name="share-social-outline" size={20} color={Colors.white} />
                  <Text style={m.shareBtnText}>Share Monthly Recap</Text>
                </>}
          </Pressable>

          {/* Quick actions */}
          <View style={m.quickRow}>
            <Pressable
              onPress={handleInstagram}
              disabled={sharing}
              style={({ pressed }) => [m.quickBtn, { opacity: pressed ? 0.7 : 1 }]}
            >
              <View style={[m.quickIcon, { backgroundColor: "#C13584" }]}>
                <Ionicons name="logo-instagram" size={22} color="#fff" />
              </View>
              <Text style={m.quickLabel}>Instagram</Text>
            </Pressable>

            <Pressable
              onPress={handleShare}
              disabled={sharing}
              style={({ pressed }) => [m.quickBtn, { opacity: pressed ? 0.7 : 1 }]}
            >
              <View style={[m.quickIcon, { backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border }]}>
                <Ionicons name="share-outline" size={22} color={Colors.text} />
              </View>
              <Text style={m.quickLabel}>Share</Text>
            </Pressable>

            <Pressable
              onPress={handleSave}
              disabled={sharing}
              style={({ pressed }) => [m.quickBtn, { opacity: pressed ? 0.7 : 1 }]}
            >
              <View style={[m.quickIcon, { backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border }]}>
                <Ionicons name="download-outline" size={22} color={Colors.text} />
              </View>
              <Text style={m.quickLabel}>Save</Text>
            </Pressable>
          </View>
        </Animated.View>
      </ScrollView>
    </View>
  );
}

const m = StyleSheet.create({
  container:     { flex: 1, backgroundColor: Colors.bg },
  hiddenCapture: { position: "absolute", left: -9999, top: 0 },

  navBar:     { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingTop: 8, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: Colors.border },
  navBtn:     { width: 40, height: 40, alignItems: "center", justifyContent: "center", borderRadius: 20, backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border },
  navShareBtn:{ width: 40, height: 40, alignItems: "center", justifyContent: "center", borderRadius: 20, backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border },
  navCenter:  { flex: 1, alignItems: "center", paddingHorizontal: 12 },
  navSub:     { fontSize: 10, color: Colors.textSec, fontFamily: "DMSans_400Regular", letterSpacing: 0.5, textTransform: "uppercase", marginBottom: 1 },
  navTitle:   { fontSize: 16, color: Colors.text, fontFamily: "DMSans_700Bold" },

  scroll: { paddingHorizontal: SCREEN_PAD, paddingTop: 16, gap: 16 },

  yearRow:      { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  yearPill:     { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border },
  yearPillActive: { backgroundColor: Colors.accent, borderColor: Colors.accent },
  yearText:     { fontSize: 13, color: Colors.textSec, fontFamily: "DMSans_500Medium" },
  yearTextActive: { color: Colors.white },

  monthScroll: { marginHorizontal: -SCREEN_PAD, marginBottom: 4 },
  monthRow:    { paddingHorizontal: SCREEN_PAD, gap: 8, flexDirection: "row", paddingVertical: 4 },
  monthChip:   { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 14, backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border, alignItems: "center", gap: 5 },
  monthChipActive: { backgroundColor: Colors.accent, borderColor: Colors.accent },
  monthChipText:   { fontSize: 13, color: Colors.textSec, fontFamily: "DMSans_500Medium" },
  monthChipTextActive: { color: Colors.white, fontFamily: "DMSans_700Bold" },
  monthDot:    { width: 4, height: 4, borderRadius: 2, backgroundColor: Colors.accent },
  monthDotActive: { backgroundColor: Colors.white },

  hintRow:  { flexDirection: "row", alignItems: "center", gap: 6 },
  hintText: { fontSize: 12, color: Colors.textMuted, fontFamily: "DMSans_400Regular", flex: 1, lineHeight: 17 },

  previewOuter: { alignItems: "center" },
  previewFrame: { borderRadius: 22, overflow: "hidden", shadowColor: "#000", shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.22, shadowRadius: 28, elevation: 12 },

  actions:    { gap: 16 },
  shareBtn:   { backgroundColor: Colors.accent, borderRadius: 14, paddingVertical: 17, paddingHorizontal: 40, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10 },
  shareBtnText: { fontSize: 16, color: Colors.white, fontFamily: "DMSans_700Bold" },

  quickRow:   { flexDirection: "row", justifyContent: "center", gap: 28 },
  quickBtn:   { alignItems: "center", gap: 7 },
  quickIcon:  { width: 56, height: 56, borderRadius: 17, alignItems: "center", justifyContent: "center" },
  quickLabel: { fontSize: 12, color: Colors.textSec, fontFamily: "DMSans_400Regular" },
});
