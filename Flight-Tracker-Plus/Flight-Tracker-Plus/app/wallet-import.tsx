import React, { useState, useCallback } from "react";
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
import Animated, { FadeInDown, FadeIn } from "react-native-reanimated";
import { Colors } from "@/constants/colors";
import { useFlights } from "@/context/flights";
import {
  requestWalletPermission,
  fetchBoardingPasses,
  WalletBoardingPass,
} from "@/modules/WalletModule";

// Distance & CO2 estimates (same logic as add-flight)
const AIRPORT_COORDS: Record<string, { lat: number; lng: number }> = {
  LIS:{lat:38.78,lng:-9.14},GVA:{lat:46.24,lng:6.11},ZRH:{lat:47.46,lng:8.55},
  ATL:{lat:33.64,lng:-84.43},MIA:{lat:25.80,lng:-80.29},JFK:{lat:40.64,lng:-73.78},
  LAX:{lat:33.94,lng:-118.41},LHR:{lat:51.47,lng:-0.45},CDG:{lat:49.01,lng:2.55},
  DXB:{lat:25.25,lng:55.37},HKG:{lat:22.31,lng:113.92},SYD:{lat:-33.94,lng:151.18},
  SIN:{lat:1.36,lng:103.99},NRT:{lat:35.77,lng:140.39},FRA:{lat:50.04,lng:8.56},
  AMS:{lat:52.31,lng:4.76},MAD:{lat:40.49,lng:-3.57},BCN:{lat:41.30,lng:2.08},
  FCO:{lat:41.80,lng:12.24},MUC:{lat:48.35,lng:11.78},ORD:{lat:41.97,lng:-87.91},
  SFO:{lat:37.62,lng:-122.38},BOS:{lat:42.37,lng:-71.01},DOH:{lat:25.27,lng:51.61},
  IST:{lat:40.98,lng:28.82},VIE:{lat:48.11,lng:16.57},CPH:{lat:55.62,lng:12.66},
};

function haversineKm(a: {lat:number;lng:number}, b: {lat:number;lng:number}): number {
  const R = 6371;
  const dLat = (b.lat - a.lat) * Math.PI / 180;
  const dLng = (b.lng - a.lng) * Math.PI / 180;
  const x = Math.sin(dLat/2)**2 + Math.cos(a.lat*Math.PI/180)*Math.cos(b.lat*Math.PI/180)*Math.sin(dLng/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1-x));
}

function estimateDistance(dep: string, arr: string): number {
  const a = AIRPORT_COORDS[dep], b = AIRPORT_COORDS[arr];
  if (!a || !b) return 500; // fallback
  return Math.round(haversineKm(a, b) * 0.621371); // km -> miles
}

function estimateDuration(dep: string, arr: string): number {
  const miles = estimateDistance(dep, arr);
  return Math.round((miles / 500) * 60 + 30); // rough: 500mph + 30min overhead
}

function estimateCO2(miles: number): number {
  return Math.round(miles * 0.255 * 0.453592); // 0.255 lb CO2/mile converted to kg
}

type ImportState = "idle" | "requesting" | "loading" | "ready" | "done";

function PassCard({
  pass,
  selected,
  alreadyAdded,
  onToggle,
  index,
}: {
  pass: WalletBoardingPass;
  selected: boolean;
  alreadyAdded: boolean;
  onToggle: () => void;
  index: number;
}) {
  const isUpcoming = pass.date >= new Date().toISOString().substring(0, 10);

  return (
    <Animated.View entering={FadeInDown.delay(index * 60).springify()}>
      <Pressable
        onPress={alreadyAdded ? undefined : onToggle}
        style={({ pressed }) => [
          styles.passCard,
          selected && !alreadyAdded && styles.passCardSelected,
          alreadyAdded && styles.passCardDimmed,
          { opacity: pressed && !alreadyAdded ? 0.85 : 1 },
        ]}
      >
        {/* Left bar */}
        <View style={[styles.passBar, { backgroundColor: alreadyAdded ? Colors.border : selected ? Colors.accent : Colors.border }]} />

        <View style={styles.passInner}>
          {/* Route */}
          <View style={styles.passRouteRow}>
            <Text style={styles.passAirport}>{pass.departureAirport}</Text>
            <View style={styles.passArrowWrap}>
              <View style={styles.passArrowLine} />
              <Ionicons name="airplane" size={13} color={alreadyAdded ? Colors.textMuted : selected ? Colors.accent : Colors.textSec} />
              <View style={styles.passArrowLine} />
            </View>
            <Text style={styles.passAirport}>{pass.arrivalAirport}</Text>
          </View>

          {/* Cities */}
          <Text style={styles.passCities}>{pass.departureCity} \u2192 {pass.arrivalCity}</Text>

          {/* Meta */}
          <View style={styles.passMetaRow}>
            <Text style={styles.passMeta}>{pass.flightCode}</Text>
            <View style={styles.passDot} />
            <Text style={styles.passMeta}>{pass.airline}</Text>
            <View style={styles.passDot} />
            <Text style={styles.passMeta}>
              {new Date(pass.date + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
            </Text>
          </View>
        </View>

        {/* Right: checkbox or already-added badge */}
        <View style={styles.passRight}>
          {alreadyAdded ? (
            <View style={styles.addedBadge}>
              <Ionicons name="checkmark" size={12} color={Colors.green} />
              <Text style={styles.addedText}>Added</Text>
            </View>
          ) : (
            <View style={[styles.checkbox, selected && styles.checkboxActive]}>
              {selected && <Ionicons name="checkmark" size={14} color={Colors.white} />}
            </View>
          )}
          {/* Upcoming indicator */}
          {isUpcoming && !alreadyAdded && (
            <View style={styles.upcomingBadge}>
              <Text style={styles.upcomingText}>Upcoming</Text>
            </View>
          )}
        </View>
      </Pressable>
    </Animated.View>
  );
}

export default function WalletImportScreen() {
  const insets = useSafeAreaInsets();
  const { flights, addFlight } = useFlights();
  const [state, setState] = useState<ImportState>("idle");
  const [passes, setPasses] = useState<WalletBoardingPass[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [isMock, setIsMock] = useState(false);
  const [importing, setImporting] = useState(false);

  // Check which passes are already in the logbook
  const alreadyAddedKeys = new Set(
    flights.map((f) => `${f.flightCode}-${f.date}`)
  );

  const handleConnect = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setState("requesting");

    const status = await requestWalletPermission();

    if (status === "denied") {
      setState("idle");
      Alert.alert(
        "Access Denied",
        "To import boarding passes, please allow access to your Wallet in Settings > Privacy.",
        [{ text: "OK" }]
      );
      return;
    }

    if (status === "unavailable") {
      setState("idle");
      Alert.alert(
        "Not Available",
        "Apple Wallet import is only available on iPhone.",
        [{ text: "OK" }]
      );
      return;
    }

    setState("loading");
    const { passes: fetched, isMock: mock } = await fetchBoardingPasses();
    setIsMock(mock);
    setPasses(fetched);

    // Pre-select all non-already-added passes
    const preSelected = new Set<string>();
    fetched.forEach((p) => {
      const key = `${p.flightCode}-${p.date}`;
      if (!alreadyAddedKeys.has(key)) preSelected.add(p.serialNumber);
    });
    setSelected(preSelected);
    setState("ready");
  }, [alreadyAddedKeys]);

  function togglePass(serialNumber: string) {
    Haptics.selectionAsync();
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(serialNumber)) next.delete(serialNumber);
      else next.add(serialNumber);
      return next;
    });
  }

  function selectAll() {
    Haptics.selectionAsync();
    const all = new Set<string>();
    passes.forEach((p) => {
      const key = `${p.flightCode}-${p.date}`;
      if (!alreadyAddedKeys.has(key)) all.add(p.serialNumber);
    });
    setSelected(all);
  }

  function deselectAll() {
    Haptics.selectionAsync();
    setSelected(new Set());
  }

  async function handleImport() {
    if (selected.size === 0) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setImporting(true);

    const toImport = passes.filter((p) => selected.has(p.serialNumber));

    for (const pass of toImport) {
      const miles = estimateDistance(pass.departureAirport, pass.arrivalAirport);
      const duration = estimateDuration(pass.departureAirport, pass.arrivalAirport);
      const co2 = estimateCO2(miles);
      await addFlight({
        flightCode: pass.flightCode,
        date: pass.date,
        airline: pass.airline,
        airlineCode: pass.airlineCode,
        departureAirport: pass.departureAirport,
        arrivalAirport: pass.arrivalAirport,
        departureCity: pass.departureCity,
        arrivalCity: pass.arrivalCity,
        departureTime: pass.departureTime,
        arrivalTime: pass.arrivalTime,
        durationMinutes: duration,
        distanceMiles: miles,
        co2Kg: co2,
        status: "on_time",
        delayMinutes: 0,
        aircraft: pass.aircraft,
      });
    }

    setImporting(false);
    setState("done");
  }

  const selectedCount = selected.size;
  const newPassCount = passes.filter((p) => !alreadyAddedKeys.has(`${p.flightCode}-${p.date}`)).length;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={10}>
          <Ionicons name="chevron-back" size={22} color={Colors.text} />
        </Pressable>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Apple Wallet</Text>
          {isMock && (
            <View style={styles.mockBadge}>
              <Text style={styles.mockBadgeText}>Preview</Text>
            </View>
          )}
        </View>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 120 }]}
      >
        {/* Idle state — connect prompt */}
        {state === "idle" && (
          <Animated.View entering={FadeIn.duration(300)} style={styles.connectWrap}>
            <View style={styles.walletIconWrap}>
              <Ionicons name="wallet" size={48} color={Colors.accent} />
            </View>
            <Text style={styles.connectTitle}>Import from Apple Wallet</Text>
            <Text style={styles.connectBody}>
              Connect your iPhone Wallet to pull in boarding passes and quickly add flights to your logbook.
              No account needed — everything stays on your device.
            </Text>

            <View style={styles.featureList}>
              {[
                { icon: "shield-checkmark-outline", text: "Private — data never leaves your phone" },
                { icon: "flash-outline", text: "Instantly import multiple flights at once" },
                { icon: "checkmark-circle-outline", text: "Review each pass before adding" },
              ].map((item) => (
                <View key={item.icon} style={styles.featureRow}>
                  <View style={styles.featureIcon}>
                    <Ionicons name={item.icon as never} size={16} color={Colors.accent} />
                  </View>
                  <Text style={styles.featureText}>{item.text}</Text>
                </View>
              ))}
            </View>

            {Platform.OS !== "ios" && (
              <View style={styles.noticeBanner}>
                <Ionicons name="information-circle-outline" size={16} color={Colors.amber} />
                <Text style={styles.noticeText}>Apple Wallet is only available on iPhone. On other platforms a preview with sample passes is shown.</Text>
              </View>
            )}

            <Pressable
              onPress={handleConnect}
              style={({ pressed }) => [styles.connectBtn, { opacity: pressed ? 0.85 : 1, transform: [{ scale: pressed ? 0.97 : 1 }] }]}
            >
              <Ionicons name="wallet-outline" size={18} color={Colors.white} style={{ marginRight: 8 }} />
              <Text style={styles.connectBtnText}>Connect Wallet</Text>
            </Pressable>
          </Animated.View>
        )}

        {/* Requesting / loading states */}
        {(state === "requesting" || state === "loading") && (
          <Animated.View entering={FadeIn.duration(200)} style={styles.loadingWrap}>
            <ActivityIndicator size="large" color={Colors.accent} />
            <Text style={styles.loadingText}>
              {state === "requesting" ? "Requesting access..." : "Reading boarding passes..."}
            </Text>
          </Animated.View>
        )}

        {/* Ready — show passes */}
        {state === "ready" && (
          <Animated.View entering={FadeIn.duration(250)}>
            {isMock && (
              <View style={styles.mockBanner}>
                <Ionicons name="flask-outline" size={15} color={Colors.amber} />
                <Text style={styles.mockBannerText}>
                  Preview mode — showing sample boarding passes. On a real device with a custom build, your actual Wallet passes will appear here.
                </Text>
              </View>
            )}

            <View style={styles.passesHeader}>
              <View>
                <Text style={styles.passesTitle}>{passes.length} boarding pass{passes.length !== 1 ? "es" : ""} found</Text>
                {newPassCount > 0 && (
                  <Text style={styles.passesSub}>{newPassCount} new \u00b7 {passes.length - newPassCount} already added</Text>
                )}
              </View>
              <View style={styles.selectActions}>
                <Pressable onPress={selectAll} hitSlop={8}>
                  <Text style={styles.selectActionText}>All</Text>
                </Pressable>
                <Text style={styles.selectSep}>\u00b7</Text>
                <Pressable onPress={deselectAll} hitSlop={8}>
                  <Text style={styles.selectActionText}>None</Text>
                </Pressable>
              </View>
            </View>

            {passes.map((pass, i) => (
              <PassCard
                key={pass.serialNumber}
                pass={pass}
                index={i}
                selected={selected.has(pass.serialNumber)}
                alreadyAdded={alreadyAddedKeys.has(`${pass.flightCode}-${pass.date}`)}
                onToggle={() => togglePass(pass.serialNumber)}
              />
            ))}
          </Animated.View>
        )}

        {/* Done state */}
        {state === "done" && (
          <Animated.View entering={FadeInDown.springify()} style={styles.doneWrap}>
            <View style={styles.doneIconWrap}>
              <Ionicons name="checkmark-circle" size={56} color={Colors.green} />
            </View>
            <Text style={styles.doneTitle}>Flights added!</Text>
            <Text style={styles.doneSub}>
              {selectedCount} flight{selectedCount !== 1 ? "s" : ""} {selectedCount === 1 ? "has" : "have"} been added to your logbook.
            </Text>
            <Pressable
              onPress={() => router.replace("/(tabs)")}
              style={({ pressed }) => [styles.doneBtn, { opacity: pressed ? 0.85 : 1 }]}
            >
              <Text style={styles.doneBtnText}>Back to Logbook</Text>
            </Pressable>
          </Animated.View>
        )}
      </ScrollView>

      {/* Fixed bottom import bar */}
      {state === "ready" && selectedCount > 0 && (
        <Animated.View
          entering={FadeInDown.springify()}
          style={[styles.importBar, { paddingBottom: insets.bottom + 12 }]}
        >
          <View style={styles.importBarLeft}>
            <Text style={styles.importBarCount}>{selectedCount} selected</Text>
            <Text style={styles.importBarSub}>flight{selectedCount !== 1 ? "s" : ""} to add</Text>
          </View>
          <Pressable
            onPress={handleImport}
            disabled={importing}
            style={({ pressed }) => [
              styles.importBtn,
              { opacity: pressed || importing ? 0.8 : 1, transform: [{ scale: pressed ? 0.97 : 1 }] },
            ]}
          >
            {importing ? (
              <ActivityIndicator size="small" color={Colors.white} />
            ) : (
              <>
                <Ionicons name="add-circle-outline" size={18} color={Colors.white} style={{ marginRight: 6 }} />
                <Text style={styles.importBtnText}>Add to Logbook</Text>
              </>
            )}
          </Pressable>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Colors.border },
  backBtn: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  headerCenter: { flexDirection: "row", alignItems: "center", gap: 8 },
  headerTitle: { fontSize: 17, color: Colors.text, fontFamily: "DMSans_700Bold" },
  mockBadge: { backgroundColor: Colors.amber + "22", paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  mockBadgeText: { fontSize: 11, color: Colors.amber, fontFamily: "DMSans_700Bold" },

  scroll: { paddingHorizontal: 20, paddingTop: 8 },

  // Connect / idle
  connectWrap: { alignItems: "center", paddingTop: 40 },
  walletIconWrap: { width: 90, height: 90, borderRadius: 26, backgroundColor: Colors.accentDim, alignItems: "center", justifyContent: "center", marginBottom: 24 },
  connectTitle: { fontSize: 22, color: Colors.text, fontFamily: "DMSans_700Bold", textAlign: "center", marginBottom: 12 },
  connectBody: { fontSize: 15, color: Colors.textSec, fontFamily: "DMSans_400Regular", textAlign: "center", lineHeight: 22, marginBottom: 28 },
  featureList: { width: "100%", gap: 12, marginBottom: 28 },
  featureRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  featureIcon: { width: 34, height: 34, borderRadius: 10, backgroundColor: Colors.accentDim, alignItems: "center", justifyContent: "center" },
  featureText: { flex: 1, fontSize: 14, color: Colors.text, fontFamily: "DMSans_400Regular" },
  noticeBanner: { flexDirection: "row", alignItems: "flex-start", gap: 8, backgroundColor: Colors.amber + "18", borderRadius: 12, padding: 12, marginBottom: 24, width: "100%" },
  noticeText: { flex: 1, fontSize: 13, color: Colors.amber, fontFamily: "DMSans_400Regular", lineHeight: 18 },
  connectBtn: { flexDirection: "row", alignItems: "center", backgroundColor: Colors.accent, paddingHorizontal: 28, paddingVertical: 16, borderRadius: 30 },
  connectBtnText: { fontSize: 16, color: Colors.white, fontFamily: "DMSans_700Bold" },

  // Loading
  loadingWrap: { alignItems: "center", paddingTop: 100, gap: 16 },
  loadingText: { fontSize: 15, color: Colors.textSec, fontFamily: "DMSans_400Regular" },

  // Mock banner
  mockBanner: { flexDirection: "row", alignItems: "flex-start", gap: 8, backgroundColor: Colors.amber + "18", borderRadius: 12, padding: 12, marginBottom: 16 },
  mockBannerText: { flex: 1, fontSize: 12, color: Colors.amber, fontFamily: "DMSans_400Regular", lineHeight: 18 },

  // Passes list
  passesHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 },
  passesTitle: { fontSize: 17, color: Colors.text, fontFamily: "DMSans_700Bold" },
  passesSub: { fontSize: 12, color: Colors.textSec, fontFamily: "DMSans_400Regular", marginTop: 2 },
  selectActions: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 2 },
  selectActionText: { fontSize: 13, color: Colors.accent, fontFamily: "DMSans_500Medium" },
  selectSep: { fontSize: 13, color: Colors.textMuted },

  passCard: { flexDirection: "row", backgroundColor: Colors.card, borderRadius: 14, marginBottom: 10, borderWidth: 1, borderColor: Colors.border, overflow: "hidden" },
  passCardSelected: { borderColor: Colors.accent, backgroundColor: Colors.accentDim + "55" },
  passCardDimmed: { opacity: 0.55 },
  passBar: { width: 3 },
  passInner: { flex: 1, paddingHorizontal: 14, paddingVertical: 14 },
  passRouteRow: { flexDirection: "row", alignItems: "center", marginBottom: 5 },
  passAirport: { fontSize: 20, color: Colors.text, fontFamily: "DMSans_700Bold" },
  passArrowWrap: { flex: 1, flexDirection: "row", alignItems: "center", marginHorizontal: 8, gap: 3 },
  passArrowLine: { flex: 1, height: 1, backgroundColor: Colors.border },
  passCities: { fontSize: 12, color: Colors.textSec, fontFamily: "DMSans_400Regular", marginBottom: 8 },
  passMetaRow: { flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" },
  passMeta: { fontSize: 12, color: Colors.textSec, fontFamily: "DMSans_400Regular" },
  passDot: { width: 3, height: 3, borderRadius: 1.5, backgroundColor: Colors.textMuted },
  passRight: { paddingHorizontal: 14, paddingVertical: 14, alignItems: "center", justifyContent: "center", gap: 8 },
  checkbox: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: Colors.border, alignItems: "center", justifyContent: "center" },
  checkboxActive: { backgroundColor: Colors.accent, borderColor: Colors.accent },
  addedBadge: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: Colors.green + "18", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  addedText: { fontSize: 11, color: Colors.green, fontFamily: "DMSans_700Bold" },
  upcomingBadge: { backgroundColor: Colors.accentDim, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  upcomingText: { fontSize: 10, color: Colors.accent, fontFamily: "DMSans_700Bold" },

  // Import bar
  importBar: { position: "absolute", bottom: 0, left: 0, right: 0, backgroundColor: Colors.card, borderTopWidth: 1, borderTopColor: Colors.border, paddingTop: 12, paddingHorizontal: 20, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  importBarLeft: { gap: 1 },
  importBarCount: { fontSize: 17, color: Colors.text, fontFamily: "DMSans_700Bold" },
  importBarSub: { fontSize: 12, color: Colors.textSec, fontFamily: "DMSans_400Regular" },
  importBtn: { flexDirection: "row", alignItems: "center", backgroundColor: Colors.accent, paddingHorizontal: 20, paddingVertical: 14, borderRadius: 14 },
  importBtnText: { fontSize: 15, color: Colors.white, fontFamily: "DMSans_700Bold" },

  // Done
  doneWrap: { alignItems: "center", paddingTop: 60 },
  doneIconWrap: { marginBottom: 20 },
  doneTitle: { fontSize: 24, color: Colors.text, fontFamily: "DMSans_700Bold", marginBottom: 10 },
  doneSub: { fontSize: 15, color: Colors.textSec, fontFamily: "DMSans_400Regular", textAlign: "center", marginBottom: 32 },
  doneBtn: { backgroundColor: Colors.accent, paddingHorizontal: 28, paddingVertical: 16, borderRadius: 30 },
  doneBtnText: { fontSize: 16, color: Colors.white, fontFamily: "DMSans_700Bold" },
});
