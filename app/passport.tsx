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
import { useColors } from "@/constants/colors";
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
  const C = useColors();
  return (
    <View style={{ alignItems: "center", flex: 1, gap: 2 }}>
      <Text style={{ fontSize: 34, fontFamily: "DMSans_700Bold", lineHeight: 40, color }}>{value}</Text>
      <Text style={{ fontSize: 11, color: C.textSec, fontFamily: "DMSans_400Regular", textTransform: "uppercase", letterSpacing: 0.6 }}>{label}</Text>
    </View>
  );
}

function ContinentChip({ name, count, color }: { name: string; count: number; color: string }) {
  const C = useColors();
  return (
    <View style={[{ flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, borderWidth: 1 }, { borderColor: color + "55", backgroundColor: color + "12" }]}>
      <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: color }} />
      <Text style={{ fontSize: 12, fontFamily: "DMSans_500Medium", color }}>{name}</Text>
      <Text style={{ fontSize: 12, color: C.textMuted, fontFamily: "DMSans_700Bold" }}>{count}</Text>
    </View>
  );
}

function CountryRow({ entry }: { entry: CountryEntry }) {
  const C = useColors();
  const [expanded, setExpanded] = useState(false);
  const color = CONTINENT_COLORS[entry.continent];
  return (
    <Pressable
      onPress={() => { Haptics.selectionAsync(); setExpanded((v) => !v); }}
      style={({ pressed }) => [{
        flexDirection: "row",
        backgroundColor: C.card,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: C.border,
        marginBottom: 8,
        overflow: "hidden",
        opacity: pressed ? 0.85 : 1,
      }]}
    >
      <View style={{ width: 3, backgroundColor: color }} />
      <View style={{ flex: 1, paddingHorizontal: 14, paddingVertical: 13 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <Text style={{ fontSize: 26 }}>{entry.flag}</Text>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 15, color: C.text, fontFamily: "DMSans_700Bold" }}>{entry.country}</Text>
            <Text style={{ fontSize: 12, color: C.textSec, fontFamily: "DMSans_400Regular", marginTop: 1 }}>
              {entry.airports.length} {entry.airports.length === 1 ? "airport" : "airports"}
            </Text>
          </View>
          <Ionicons name={expanded ? "chevron-up" : "chevron-down"} size={14} color={C.textMuted} />
        </View>
        {expanded && (
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
            {entry.airportCities.map((a, i) => (
              <View key={i} style={[{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, borderWidth: 1 }, { borderColor: color + "44", backgroundColor: color + "0F" }]}>
                <Text style={{ fontSize: 11, fontFamily: "DMSans_500Medium", color }}>{a}</Text>
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
  const C = useColors();
  const insets   = useSafeAreaInsets();
  const { flights } = useFlights();
  const { profile } = useUser();
  const cardRef  = useRef<ViewShot>(null);
  const [capturing, setCapturing] = useState(false);

  const topPad    = Platform.OS === "web" ? 67 : insets.top + 8;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom + 8;

  const stats = useMemo(() => computePassportStats(flights), [flights]);

  const availableW = 390 - SCREEN_PAD * 2;
  const scale      = availableW / PASSPORT_CARD_WIDTH;
  const previewH   = PASSPORT_CARD_HEIGHT * scale;

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
    <View style={{ flex: 1, backgroundColor: C.bg, paddingTop: topPad }}>

      {/* ── NAV BAR ── */}
      <View style={{
        flexDirection: "row", alignItems: "center", justifyContent: "space-between",
        paddingHorizontal: SCREEN_PAD, paddingBottom: 10,
        borderBottomWidth: 1, borderBottomColor: C.border,
      }}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={{ width: 36, height: 36, alignItems: "center", justifyContent: "center" }}>
          <Ionicons name="chevron-back" size={22} color={C.textSec} />
        </Pressable>
        <View style={{ flex: 1, alignItems: "center", gap: 1 }}>
          <Text style={{ fontSize: 10, color: C.textSec, fontFamily: "DMSans_400Regular", letterSpacing: 0.5, textTransform: "uppercase" }}>Logbook</Text>
          <Text style={{ fontSize: 16, color: C.text, fontFamily: "DMSans_700Bold" }}>Travel Passport</Text>
        </View>
        <Pressable
          onPress={handleShare}
          disabled={capturing || isEmpty}
          style={({ pressed }) => [{ width: 36, height: 36, alignItems: "center", justifyContent: "center" }, { opacity: capturing || isEmpty || pressed ? 0.5 : 1 }]}
          hitSlop={8}
        >
          {capturing
            ? <ActivityIndicator size="small" color={C.accent} />
            : <Ionicons name="share-outline" size={20} color={C.accent} />}
        </Pressable>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: SCREEN_PAD, paddingTop: 20, gap: 20, paddingBottom: bottomPad + 80 }}
      >
        {isEmpty ? (
          <Animated.View entering={FadeInDown.springify()} style={{ alignItems: "center", paddingTop: 60, gap: 16 }}>
            <View style={{ width: 88, height: 88, borderRadius: 44, backgroundColor: C.accentDim, alignItems: "center", justifyContent: "center" }}>
              <Ionicons name="earth-outline" size={48} color={C.accent} />
            </View>
            <Text style={{ fontSize: 20, color: C.text, fontFamily: "DMSans_700Bold" }}>Your passport is empty</Text>
            <Text style={{ fontSize: 14, color: C.textSec, fontFamily: "DMSans_400Regular", textAlign: "center", lineHeight: 21, paddingHorizontal: 20 }}>
              Start logging flights to see every country and airport you've visited.
            </Text>
            <Pressable
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); router.push("/add-flight"); }}
              style={({ pressed }) => [{ backgroundColor: C.accent, paddingHorizontal: 28, paddingVertical: 15, borderRadius: 28, marginTop: 8 }, { opacity: pressed ? 0.8 : 1 }]}
            >
              <Text style={{ fontSize: 15, color: C.white, fontFamily: "DMSans_700Bold" }}>Add First Flight</Text>
            </Pressable>
          </Animated.View>
        ) : (
          <>
            {/* ── HERO STAT ROW ── */}
            <Animated.View entering={FadeInDown.delay(0).springify()} style={{
              flexDirection: "row", justifyContent: "space-around", alignItems: "center",
              backgroundColor: C.card, borderRadius: 20,
              borderWidth: 1, borderColor: C.border,
              paddingVertical: 20, paddingHorizontal: 16,
            }}>
              <HeroStat value={stats.totalCountries}  label="countries"   color={C.accent} />
              <View style={{ width: 1, height: 40, backgroundColor: C.border }} />
              <HeroStat value={stats.totalAirports}   label="airports"    color={C.green} />
              <View style={{ width: 1, height: 40, backgroundColor: C.border }} />
              <HeroStat value={stats.totalContinents} label="continents"  color="#F5C842" />
            </Animated.View>

            {/* ── WORLD COVERAGE PROGRESS ── */}
            <Animated.View entering={FadeInDown.delay(40).springify()} style={{
              backgroundColor: C.card, borderRadius: 20,
              borderWidth: 1, borderColor: C.border,
              padding: 20, gap: 10,
            }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" }}>
                <Text style={{ fontSize: 13, color: C.textSec, fontFamily: "DMSans_500Medium", letterSpacing: 0.5, textTransform: "uppercase" }}>World Coverage</Text>
                <Text style={{ fontSize: 28, color: C.accent, fontFamily: "DMSans_700Bold" }}>{stats.worldCoveragePercent}%</Text>
              </View>
              <View style={{ height: 8, backgroundColor: C.accentDim, borderRadius: 4, overflow: "hidden" }}>
                <Animated.View
                  style={[{ height: 8, backgroundColor: C.accent, borderRadius: 4 }, { width: `${Math.min(stats.worldCoveragePercent, 100)}%` as any }]}
                />
              </View>
              <Text style={{ fontSize: 12, color: C.textMuted, fontFamily: "DMSans_400Regular" }}>
                {stats.totalCountries} of 195 sovereign nations
              </Text>
            </Animated.View>

            {/* ── CONTINENT CHIPS ── */}
            <Animated.View entering={FadeInDown.delay(70).springify()} style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
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
                <View style={{
                  flexDirection: "row", alignItems: "center", justifyContent: "space-between",
                  borderLeftWidth: 3, borderLeftColor: group.color,
                  paddingLeft: 10, marginBottom: 8, marginTop: 4,
                }}>
                  <Text style={{ fontSize: 11, fontFamily: "DMSans_700Bold", letterSpacing: 1.2, color: group.color }}>
                    {group.continent.toUpperCase()}
                  </Text>
                  <Text style={{ fontSize: 11, color: C.textMuted, fontFamily: "DMSans_400Regular" }}>{group.entries.length} countries</Text>
                </View>
                {group.entries.map((entry) => (
                  <CountryRow key={entry.countryCode} entry={entry} />
                ))}
              </Animated.View>
            ))}

            {/* ── SHARE CARD PREVIEW ── */}
            <Animated.View entering={FadeInDown.delay(200).springify()} style={{ gap: 16, marginTop: 8 }}>
              <Text style={{ fontSize: 16, color: C.text, fontFamily: "DMSans_700Bold" }}>Share your Passport</Text>

              <View style={{ alignItems: "center" }}>
                <ViewShot
                  ref={cardRef}
                  options={{ format: "png", quality: 1.0 }}
                  style={{
                    width: availableW, height: previewH,
                    borderRadius: 20, overflow: "hidden",
                    shadowColor: C.accent, shadowOffset: { width: 0, height: 12 },
                    shadowOpacity: 0.25, shadowRadius: 28, elevation: 14,
                  }}
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

              <Text style={{ fontSize: 12, color: C.textSec, fontFamily: "DMSans_400Regular", textAlign: "center" }}>
                📐 9:16 story format — perfect for Instagram Stories
              </Text>

              <Pressable
                onPress={handleShare}
                disabled={capturing}
                style={({ pressed }) => [
                  { backgroundColor: C.accent, borderRadius: 16, paddingVertical: 18, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10 },
                  { opacity: capturing ? 0.5 : pressed ? 0.87 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] },
                ]}
              >
                {capturing
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <>
                      <Ionicons name="share-social-outline" size={21} color="#fff" />
                      <Text style={{ fontSize: 17, color: C.white, fontFamily: "DMSans_700Bold" }}>Share Passport</Text>
                    </>}
              </Pressable>

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
                  onPress={handleSave}
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
          </>
        )}
      </ScrollView>
    </View>
  );
}
