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

const MONTH_NAMES = [
  "Jan","Feb","Mar","Apr","May","Jun",
  "Jul","Aug","Sep","Oct","Nov","Dec",
];

const MONTH_FULL = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];

export default function MonthlyRecapScreen() {
  const insets = useSafeAreaInsets();
  const { flights } = useFlights();
  const shareRef = useRef<ViewShot>(null);
  const [sharing, setSharing] = useState(false);

  const now = new Date();
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth());

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom + 20;

  // Years that have at least one flight
  const availableYears = useMemo(() => {
    const set = new Set<number>();
    flights.forEach((f) => {
      const y = parseInt(f.date.substring(0, 4), 10);
      if (!isNaN(y)) set.add(y);
    });
    // Always include current year
    set.add(now.getFullYear());
    return Array.from(set).sort((a, b) => b - a);
  }, [flights]);

  // Flights for the selected month
  const monthFlights = useMemo(() => {
    const prefix = `${selectedYear}-${String(selectedMonth + 1).padStart(2, "0")}`;
    return flights.filter((f) => f.date.startsWith(prefix));
  }, [flights, selectedYear, selectedMonth]);

  async function handleShare() {
    setSharing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const uri = await (
        shareRef.current as unknown as { capture: () => Promise<string> }
      ).capture();
      const available = await Sharing.isAvailableAsync();
      if (available) {
        await Sharing.shareAsync(uri, {
          mimeType: "image/png",
          dialogTitle: `${MONTH_FULL[selectedMonth]} ${selectedYear} Recap`,
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

  // Scale card to fit screen width with padding
  const PREVIEW_WIDTH = Math.min(CARD_WIDTH, 340);
  const PREVIEW_SCALE = PREVIEW_WIDTH / CARD_WIDTH;
  const PREVIEW_HEIGHT = CARD_HEIGHT * PREVIEW_SCALE;

  return (
    <View style={[styles.container, { paddingTop: topPad }]}>
      {/* Hidden full-res capture */}
      <ViewShot
        ref={shareRef}
        options={{ format: "png", quality: 1.0 }}
        style={styles.hiddenCapture}
      >
        <MonthlyRecapCard
          flights={monthFlights}
          month={selectedMonth}
          year={selectedYear}
        />
      </ViewShot>

      {/* Nav bar */}
      <View style={styles.navBar}>
        <Pressable onPress={() => router.back()} style={styles.navBtn} hitSlop={8}>
          <Ionicons name="chevron-back" size={22} color={Colors.text} />
        </Pressable>
        <View style={styles.navCenter}>
          <Text style={styles.navLabel}>Monthly Recap</Text>
          <Text style={styles.navTitle}>
            {MONTH_FULL[selectedMonth]} {selectedYear}
          </Text>
        </View>
        <Pressable
          onPress={handleShare}
          disabled={sharing}
          style={({ pressed }) => [styles.shareBtn, { opacity: sharing || pressed ? 0.7 : 1 }]}
          hitSlop={8}
        >
          {sharing ? (
            <ActivityIndicator size="small" color={Colors.accent} />
          ) : (
            <Ionicons name="share-outline" size={20} color={Colors.accent} />
          )}
        </Pressable>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scroll, { paddingBottom: bottomPad }]}
      >
        {/* Year selector */}
        <Animated.View entering={FadeInDown.delay(0).springify()} style={styles.yearRow}>
          {availableYears.map((y) => (
            <Pressable
              key={y}
              onPress={() => { Haptics.selectionAsync(); setSelectedYear(y); }}
              style={[styles.yearPill, selectedYear === y && styles.yearPillActive]}
            >
              <Text style={[styles.yearText, selectedYear === y && styles.yearTextActive]}>{y}</Text>
            </Pressable>
          ))}
        </Animated.View>

        {/* Month carousel */}
        <Animated.View entering={FadeInDown.delay(40).springify()}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.monthRow}
            style={styles.monthScroll}
          >
            {MONTH_NAMES.map((m, i) => {
              const prefix = `${selectedYear}-${String(i + 1).padStart(2, "0")}`;
              const cnt = flights.filter((f) => f.date.startsWith(prefix)).length;
              const active = selectedMonth === i;
              return (
                <Pressable
                  key={m}
                  onPress={() => { Haptics.selectionAsync(); setSelectedMonth(i); }}
                  style={[styles.monthChip, active && styles.monthChipActive]}
                >
                  <Text style={[styles.monthChipText, active && styles.monthChipTextActive]}>{m}</Text>
                  {cnt > 0 && (
                    <View style={[styles.monthDot, active && styles.monthDotActive]} />
                  )}
                </Pressable>
              );
            })}
          </ScrollView>
        </Animated.View>

        {/* Flight count hint */}
        <Animated.View entering={FadeIn.duration(200)} style={styles.hintRow}>
          <Ionicons
            name={monthFlights.length > 0 ? "airplane" : "airplane-outline"}
            size={13}
            color={monthFlights.length > 0 ? Colors.accent : Colors.textMuted}
          />
          <Text style={[styles.hintText, monthFlights.length > 0 && { color: Colors.accent }]}>
            {monthFlights.length > 0
              ? `${monthFlights.length} flight${monthFlights.length !== 1 ? "s" : ""} this month`
              : "No flights logged for this month"}
          </Text>
        </Animated.View>

        {/* Card preview */}
        <Animated.View entering={FadeInDown.delay(80).springify()} style={styles.previewContainer}>
          <View
            style={[
              styles.previewFrame,
              { width: PREVIEW_WIDTH, height: PREVIEW_HEIGHT },
            ]}
          >
            <View
              style={{
                width: CARD_WIDTH,
                height: CARD_HEIGHT,
                transform: [{ scale: PREVIEW_SCALE }],
                transformOrigin: "top left",
              }}
            >
              <MonthlyRecapCard
                flights={monthFlights}
                month={selectedMonth}
                year={selectedYear}
              />
            </View>
          </View>
        </Animated.View>

        {/* Share button */}
        <Animated.View entering={FadeInDown.delay(120).springify()} style={styles.actions}>
          <Pressable
            onPress={handleShare}
            disabled={sharing}
            style={({ pressed }) => [
              styles.shareFlightBtn,
              { opacity: sharing || pressed ? 0.75 : 1 },
            ]}
          >
            {sharing ? (
              <ActivityIndicator size="small" color={Colors.white} />
            ) : (
              <>
                <Ionicons name="share-social-outline" size={20} color={Colors.white} />
                <Text style={styles.shareBtnText}>Share Recap</Text>
              </>
            )}
          </Pressable>
          <Text style={styles.shareHint}>
            9:16 story card \u2014 perfect for Instagram, WhatsApp and more.
          </Text>
        </Animated.View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  hiddenCapture: { position: "absolute", left: -9999, top: 0 },

  navBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  navBtn: {
    width: 40, height: 40,
    alignItems: "center", justifyContent: "center",
    borderRadius: 20,
    backgroundColor: Colors.card,
    borderWidth: 1, borderColor: Colors.border,
  },
  shareBtn: {
    width: 40, height: 40,
    alignItems: "center", justifyContent: "center",
    borderRadius: 20,
    backgroundColor: Colors.card,
    borderWidth: 1, borderColor: Colors.border,
  },
  navCenter: { flex: 1, alignItems: "center", paddingHorizontal: 12 },
  navLabel: {
    fontSize: 11, color: Colors.textSec,
    fontFamily: "DMSans_400Regular",
    letterSpacing: 0.6, textTransform: "uppercase", marginBottom: 1,
  },
  navTitle: {
    fontSize: 16, color: Colors.text, fontFamily: "DMSans_700Bold",
  },

  scroll: { paddingHorizontal: 20, paddingTop: 16 },

  yearRow: {
    flexDirection: "row", gap: 8, flexWrap: "wrap", marginBottom: 14,
  },
  yearPill: {
    paddingHorizontal: 14, paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: Colors.card,
    borderWidth: 1, borderColor: Colors.border,
  },
  yearPillActive: { backgroundColor: Colors.accent, borderColor: Colors.accent },
  yearText: { fontSize: 13, color: Colors.textSec, fontFamily: "DMSans_500Medium" },
  yearTextActive: { color: Colors.white },

  monthScroll: { marginHorizontal: -20, marginBottom: 12 },
  monthRow: { paddingHorizontal: 20, gap: 8, flexDirection: "row", paddingVertical: 4 },
  monthChip: {
    paddingHorizontal: 14, paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: Colors.card,
    borderWidth: 1, borderColor: Colors.border,
    alignItems: "center", gap: 5,
  },
  monthChipActive: { backgroundColor: Colors.accent, borderColor: Colors.accent },
  monthChipText: { fontSize: 13, color: Colors.textSec, fontFamily: "DMSans_500Medium" },
  monthChipTextActive: { color: Colors.white, fontFamily: "DMSans_700Bold" },
  monthDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: Colors.accent },
  monthDotActive: { backgroundColor: Colors.white },

  hintRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 16,
  },
  hintText: {
    fontSize: 13, color: Colors.textMuted, fontFamily: "DMSans_400Regular",
  },

  previewContainer: {
    alignItems: "center",
    marginBottom: 24,
  },
  previewFrame: {
    borderRadius: 20,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
    elevation: 10,
  },

  actions: { alignItems: "center" },
  shareFlightBtn: {
    backgroundColor: Colors.accent,
    borderRadius: 14,
    paddingVertical: 17,
    paddingHorizontal: 40,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    marginBottom: 10,
    width: "100%",
  },
  shareBtnText: {
    fontSize: 16, color: Colors.white, fontFamily: "DMSans_700Bold",
  },
  shareHint: {
    fontSize: 12, color: Colors.textMuted,
    fontFamily: "DMSans_400Regular",
    textAlign: "center", lineHeight: 17,
  },
});
