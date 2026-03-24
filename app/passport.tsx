/**
 * passport.tsx — Travel Passport screen
 * Shows countries, airports, continents collected from all logged flights.
 * Includes a shareable story-card via ViewShot.
 */
import React, { useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
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
import Animated, { FadeInDown, FadeIn } from "react-native-reanimated";
import ViewShot from "react-native-view-shot";
import { Colors } from "@/constants/colors";
import { useFlights } from "@/context/flights";
import { useUser } from "@/context/user";
import {
  computePassportStats,
  CONTINENT_COLORS,
  ContinentKey,
  CountryEntry,
} from "@/utils/passport";
import PassportCard, {
  PASSPORT_CARD_WIDTH,
  PASSPORT_CARD_HEIGHT,
} from "@/components/PassportCard";

const SCREEN_PAD = 20;

// ─── Small helpers ────────────────────────────────────────────────────────────
function HeroStat({ value, label, color }: { value: string | number; label: string; color: string }) {
  return (
    <View style={hero.wrap}>
      <Text style={[hero.num, { color }]}>{value}</Text>
      <Text style={hero.label}>{label}</Text>
    </View>
  );
}

function ContinentChip({ name, count, color }: { name: string; count: number; color: string }) {
  return (
    <View style={[chip.wrap, { borderColor: color + "55", backgroundColor: color + "12" }]}>
      <View style={[chip.dot, { backgroundColor: color }]} />
      <Text style={[chip.name, { color }]}>{name}</Text>
      <Text style={chip.count}>{count}</Text>
    </View>
  );
}

function CountryRow({ entry }: { entry: CountryEntry }) {
  const [expanded, setExpanded] = useState(false);
  const color = CONTINENT_COLORS[entry.continent];
  return (
    <Pressable
      onPress={() => { Haptics.selectionAsync(); setExpanded((v) => !v); }}
      style={({ pressed }) => [row.card, { opacity: pressed ? 0.85 : 1 }]}
    >
      {/* Left accent bar */}
      <View style={[row.bar, { backgroundColor: color }]} />
      <View style={row.inner}>
        <View style={row.topLine}>
          <Text style={row.flag}>{entry.flag}</Text>
          <View style={row.textGroup}>
            <Text style={row.country}>{entry.country}</Text>
            <Text style={row.airports}>
              {entry.airports.length} {entry.airports.length === 1 ? "airport" : "airports"}
            </Text>
          </View>
          <Ionicons
            name={expanded ? "chevron-up" : "chevron-down"}
            size={14}
            color={Colors.textMuted}
          />
        </View>
        {expanded && (
          <View style={row.chips}>
            {entry.airportCities.map((a, i) => (
              <View key={i} style={[row.chip, { borderColor: color + "44", backgroundColor: color + "0F" }]}>
                <Text style={[row.chipText, { color }]}>{a}</Text>
              </View>
            ))}
          </View>
        )}
      </View>
    </Pressable>
  );
}

const CONTINENT_ORDER: ContinentKey[] = [
  "Europe", "Asia", "North America", "Middle East",
  "South America", "Africa", "Oceania",
];

// ─── Main screen ─────────────────────────────────────────────────────────────
export default function PassportScreen() {
  const insets   = useSafeAreaInsets();
  const { flights } = useFlights();
  const { profile } = useUser();
  const cardRef  = useRef<ViewShot>(null);
  const [capturing, setCapturing] = useState(false);

  const topPad    = Platform.OS === "web" ? 67 : insets.top + 8;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom + 8;

  const stats = useMemo(() => computePassportStats(flights), [flights]);

  // Scale factor so the 1080-wide card fits in available screen width
  const availableW = 390 - SCREEN_PAD * 2;
  const scale      = availableW / PASSPORT_CARD_WIDTH;
  const previewH   = PASSPORT_CARD_HEIGHT * scale;

  // ── capture helpers ────────────────────────────────────────────────────
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
    if (stats.totalCountries === 0) return;
    setCapturing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const uri = await captureCard();
      if (!uri) { Alert.alert("Error", "Could not capture the card."); return; }
      const available = await Sharing.isAvailableAsync();
      if (available) {
        await Sharing.shareAsync(uri, { mimeType: "image/png", dialogTitle: "Share your Travel Passport" });
      } else {
        Alert.alert("Sharing not available", "Please save the image and share manually.");
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } finally {
      setCapturing(false);
    }
  }

  async function handleSave() {
    if (stats.totalCountries === 0) return;
    setCapturing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      const uri = await captureCard();
      if (!uri) { Alert.alert("Error", "Could not capture the card."); return; }
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission needed", "Allow photo library access to save your passport.");
        return;
      }
      await MediaLibrary.saveToLibraryAsync(uri);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert("Saved!", "Passport saved to your camera roll.");
    } finally {
      setCapturing(false);
    }
  }

  async function handleInstagram() {
    if (stats.totalCountries === 0) return;
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
    if (stats.totalCountries === 0) return;
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

  // ── Group countries by continent ──────────────────────────────────────
  const grouped = useMemo(() => {
    const map = new Map<ContinentKey, CountryEntry[]>();
    for (const c of stats.countries) {
      if (!map.has(c.continent)) map.set(c.continent, []);
      map.get(c.continent)!.push(c);
    }
    return CONTINENT_ORDER.filter((k) => map.has(k)).map((k) => ({
      continent: k,
      entries: map.get(k)!,
      color: CONTINENT_COLORS[k],
    }));
  }, [stats]);

  const isEmpty = stats.totalCountries === 0;

  return (
    <View style={[st.container, { paddingTop: topPad }]}>

      {/* ── NAV BAR ── */}
      <View style={st.navBar}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={st.navBtn}>
          <Ionicons name="chevron-back" size={22} color={Colors.textSec} />
        </Pressable>
        <View style={st.navCenter}>
          <Text style={st.navSub}>Logbook</Text>
          <Text style={st.navTitle}>Travel Passport</Text>
        </View>
        <Pressable
          onPress={handleShare}
          disabled={capturing || isEmpty}
          style={({ pressed }) => [st.navBtn, { opacity: capturing || isEmpty || pressed ? 0.5 : 1 }]}
          hitSlop={8}
        >
          {capturing
            ? <ActivityIndicator size="small" color={Colors.accent} />
            : <Ionicons name="share-outline" size={20} color={Colors.accent} />}
        </Pressable>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[st.scroll, { paddingBottom: bottomPad + 80 }]}
      >
        {isEmpty ? (
          // ── Empty state ──────────────────────────────────────────────
          <Animated.View entering={FadeInDown.springify()} style={st.empty}>
            <View style={st.emptyIcon}>
              <Ionicons name="earth-outline" size={48} color={Colors.accent} />
            </View>
            <Text style={st.emptyTitle}>Your passport is empty</Text>
            <Text style={st.emptyText}>
              Start logging flights to see every country and airport you've visited.
            </Text>
            <Pressable
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); router.push("/add-flight"); }}
              style={({ pressed }) => [st.emptyBtn, { opacity: pressed ? 0.8 : 1 }]}
            >
              <Text style={st.emptyBtnText}>Add First Flight</Text>
            </Pressable>
          </Animated.View>
        ) : (
          <>
            {/* ── HERO STAT ROW ── */}
            <Animated.View entering={FadeInDown.delay(0).springify()} style={st.heroRow}>
              <HeroStat value={stats.totalCountries}  label="countries"   color={Colors.accent} />
              <View style={st.heroDiv} />
              <HeroStat value={stats.totalAirports}   label="airports"    color={Colors.green} />
              <View style={st.heroDiv} />
              <HeroStat value={stats.totalContinents} label="continents"  color="#F5C842"     />
            </Animated.View>

            {/* ── WORLD COVERAGE PROGRESS ── */}
            <Animated.View entering={FadeInDown.delay(40).springify()} style={st.coverageCard}>
              <View style={st.coverageTop}>
                <Text style={st.coverageLabel}>World Coverage</Text>
                <Text style={st.coveragePct}>{stats.worldCoveragePercent}%</Text>
              </View>
              <View style={st.progressTrack}>
                <Animated.View
                  style={[
                    st.progressFill,
                    { width: `${Math.min(stats.worldCoveragePercent, 100)}%` as any },
                  ]}
                />
              </View>
              <Text style={st.coverageSub}>
                {stats.totalCountries} of 195 sovereign nations
              </Text>
            </Animated.View>

            {/* ── CONTINENT CHIPS ── */}
            <Animated.View entering={FadeInDown.delay(70).springify()} style={st.chipsRow}>
              {CONTINENT_ORDER.filter((c) => (stats.continentCounts[c] ?? 0) > 0).map((c) => (
                <ContinentChip
                  key={c}
                  name={c}
                  count={stats.continentCounts[c]}
                  color={CONTINENT_COLORS[c]}
                />
              ))}
            </Animated.View>

            {/* ── COUNTRY LIST grouped by continent ── */}
            {grouped.map((group, gi) => (
              <Animated.View
                key={group.continent}
                entering={FadeInDown.delay(100 + gi * 30).springify()}
              >
                <View style={[st.continentHeader, { borderLeftColor: group.color }]}>
                  <Text style={[st.continentTitle, { color: group.color }]}>
                    {group.continent.toUpperCase()}
                  </Text>
                  <Text style={st.continentCount}>{group.entries.length} countries</Text>
                </View>
                {group.entries.map((entry) => (
                  <CountryRow key={entry.countryCode} entry={entry} />
                ))}
              </Animated.View>
            ))}

            {/* ── SHARE CARD PREVIEW ── */}
            <Animated.View entering={FadeInDown.delay(200).springify()} style={st.shareSection}>
              <Text style={st.shareSectionTitle}>Share your Passport</Text>

              {/* ViewShot wrapper — off-screen full resolution, scaled for preview */}
              <View style={st.cardOuter}>
                <ViewShot
                  ref={cardRef}
                  options={{ format: "png", quality: 1.0 }}
                  style={[st.cardShot, { width: availableW, height: previewH }]}
                >
                  <View
                    style={{
                      width: PASSPORT_CARD_WIDTH,
                      height: PASSPORT_CARD_HEIGHT,
                      transform: [{ scale }],
                      transformOrigin: "top left",
                    }}
                  >
                    <PassportCard
                      stats={stats}
                      username={profile?.username ?? undefined}
                    />
                  </View>
                </ViewShot>
              </View>

              <Text style={st.cardHint}>
                📐 9:16 story format — perfect for Instagram Stories
              </Text>

              {/* PRIMARY SHARE CTA */}
              <Pressable
                onPress={handleShare}
                disabled={capturing}
                style={({ pressed }) => [
                  st.shareBtn,
                  { opacity: capturing ? 0.5 : pressed ? 0.87 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] },
                ]}
              >
                {capturing
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <>
                      <Ionicons name="share-social-outline" size={21} color="#fff" />
                      <Text style={st.shareBtnText}>Share Passport</Text>
                    </>}
              </Pressable>

              {/* QUICK ACTIONS */}
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
                  onPress={handleSave}
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
          </>
        )}
      </ScrollView>
    </View>
  );
}

const st = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  navBar: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: SCREEN_PAD, paddingBottom: 10,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  navBtn:    { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  navCenter: { flex: 1, alignItems: "center", gap: 1 },
  navSub:    { fontSize: 10, color: Colors.textSec, fontFamily: "DMSans_400Regular", letterSpacing: 0.5, textTransform: "uppercase" },
  navTitle:  { fontSize: 16, color: Colors.text, fontFamily: "DMSans_700Bold" },

  scroll: { paddingHorizontal: SCREEN_PAD, paddingTop: 20, gap: 20 },

  // ── empty
  empty:       { alignItems: "center", paddingTop: 60, gap: 16 },
  emptyIcon:   { width: 88, height: 88, borderRadius: 44, backgroundColor: Colors.accentDim, alignItems: "center", justifyContent: "center" },
  emptyTitle:  { fontSize: 20, color: Colors.text, fontFamily: "DMSans_700Bold" },
  emptyText:   { fontSize: 14, color: Colors.textSec, fontFamily: "DMSans_400Regular", textAlign: "center", lineHeight: 21, paddingHorizontal: 20 },
  emptyBtn:    { backgroundColor: Colors.accent, paddingHorizontal: 28, paddingVertical: 15, borderRadius: 28, marginTop: 8 },
  emptyBtnText:{ fontSize: 15, color: Colors.white, fontFamily: "DMSans_700Bold" },

  // ── hero stat row
  heroRow: {
    flexDirection: "row", justifyContent: "space-around", alignItems: "center",
    backgroundColor: Colors.card, borderRadius: 20,
    borderWidth: 1, borderColor: Colors.border,
    paddingVertical: 20, paddingHorizontal: 16,
  },
  heroDiv: { width: 1, height: 40, backgroundColor: Colors.border },

  // ── world coverage card
  coverageCard: {
    backgroundColor: Colors.card, borderRadius: 20,
    borderWidth: 1, borderColor: Colors.border,
    padding: 20, gap: 10,
  },
  coverageTop:  { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" },
  coverageLabel:{ fontSize: 13, color: Colors.textSec, fontFamily: "DMSans_500Medium", letterSpacing: 0.5, textTransform: "uppercase" },
  coveragePct:  { fontSize: 28, color: Colors.accent, fontFamily: "DMSans_700Bold" },
  progressTrack:{ height: 8, backgroundColor: Colors.accentDim, borderRadius: 4, overflow: "hidden" },
  progressFill: { height: 8, backgroundColor: Colors.accent, borderRadius: 4 },
  coverageSub:  { fontSize: 12, color: Colors.textMuted, fontFamily: "DMSans_400Regular" },

  // ── continent chips
  chipsRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },

  // ── continent section header
  continentHeader: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    borderLeftWidth: 3, paddingLeft: 10, marginBottom: 8, marginTop: 4,
  },
  continentTitle: { fontSize: 11, fontFamily: "DMSans_700Bold", letterSpacing: 1.2 },
  continentCount: { fontSize: 11, color: Colors.textMuted, fontFamily: "DMSans_400Regular" },

  // ── share section
  shareSection: { gap: 16, marginTop: 8 },
  shareSectionTitle: { fontSize: 16, color: Colors.text, fontFamily: "DMSans_700Bold" },
  cardOuter: { alignItems: "center" },
  cardShot: {
    borderRadius: 20, overflow: "hidden",
    shadowColor: Colors.accent, shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.25, shadowRadius: 28, elevation: 14,
  },
  cardHint: { fontSize: 12, color: Colors.textSec, fontFamily: "DMSans_400Regular", textAlign: "center" },
  shareBtn: {
    backgroundColor: Colors.accent, borderRadius: 16, paddingVertical: 18,
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10,
  },
  shareBtnText: { fontSize: 17, color: Colors.white, fontFamily: "DMSans_700Bold" },
  quickRow: { flexDirection: "row", justifyContent: "center", gap: 28 },
  quickBtn: { alignItems: "center", gap: 7 },
  quickIcon: { width: 56, height: 56, borderRadius: 17, alignItems: "center", justifyContent: "center" },
  quickLabel: { fontSize: 12, color: Colors.textSec, fontFamily: "DMSans_400Regular" },
});

const hero = StyleSheet.create({
  wrap:  { alignItems: "center", flex: 1, gap: 2 },
  num:   { fontSize: 34, fontFamily: "DMSans_700Bold", lineHeight: 40 },
  label: { fontSize: 11, color: Colors.textSec, fontFamily: "DMSans_400Regular", textTransform: "uppercase", letterSpacing: 0.6 },
});

const chip = StyleSheet.create({
  wrap: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 12, paddingVertical: 7,
    borderRadius: 20, borderWidth: 1,
  },
  dot:   { width: 6, height: 6, borderRadius: 3 },
  name:  { fontSize: 12, fontFamily: "DMSans_500Medium" },
  count: { fontSize: 12, color: Colors.textMuted, fontFamily: "DMSans_700Bold" },
});

const row = StyleSheet.create({
  card: {
    flexDirection: "row",
    backgroundColor: Colors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 8,
    overflow: "hidden",
  },
  bar:   { width: 3 },
  inner: { flex: 1, paddingHorizontal: 14, paddingVertical: 13 },
  topLine: { flexDirection: "row", alignItems: "center", gap: 12 },
  flag:    { fontSize: 26 },
  textGroup: { flex: 1 },
  country:   { fontSize: 15, color: Colors.text, fontFamily: "DMSans_700Bold" },
  airports:  { fontSize: 12, color: Colors.textSec, fontFamily: "DMSans_400Regular", marginTop: 1 },
  chips:     { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 10 },
  chip: {
    paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 8, borderWidth: 1,
  },
  chipText: { fontSize: 11, fontFamily: "DMSans_500Medium" },
});
