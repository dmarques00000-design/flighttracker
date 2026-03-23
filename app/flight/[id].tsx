import React, { useRef, useState } from "react";
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
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as Sharing from "expo-sharing";
import * as MediaLibrary from "expo-media-library";
import ViewShot from "react-native-view-shot";
import Animated, { FadeInDown } from "react-native-reanimated";
import { Colors } from "@/constants/colors";
import { useFlights } from "@/context/flights";
import { getAirlineInfo } from "@/utils/airlineLogos";
import FlightShareCard from "@/components/FlightShareCard";

function formatDate(dateStr: string): string {
  return new Date(dateStr + "T00:00:00").toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric", year: "numeric",
  });
}
function formatDateShort(dateStr: string): string {
  return new Date(dateStr + "T00:00:00").toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
  });
}
function formatHours(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

function InfoRow({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <View style={infoStyles.row}>
      <Text style={infoStyles.label}>{label}</Text>
      <Text style={[infoStyles.value, accent ? { color: accent } : undefined]}>{value}</Text>
    </View>
  );
}

const infoStyles = StyleSheet.create({
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  label: { fontSize: 14, color: Colors.textSec, fontFamily: "DMSans_400Regular" },
  value: {
    fontSize: 14, color: Colors.text, fontFamily: "DMSans_500Medium",
    textAlign: "right", flex: 1, marginLeft: 16,
  },
});

export default function FlightDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { flights } = useFlights();
  const insets = useSafeAreaInsets();
  const flight = flights.find((f) => f.id === id);
  const shareRef = useRef<ViewShot>(null);
  const [sharing, setSharing] = useState(false);

  const topPad    = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom + 20;

  async function handleShare() {
    if (!flight) return;
    setSharing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const uri = await (shareRef.current as unknown as { capture: () => Promise<string> }).capture();
      const available = await Sharing.isAvailableAsync();
      if (available) {
        await Sharing.shareAsync(uri, {
          mimeType: "image/png",
          dialogTitle: `Share ${flight.flightCode} \u2014 ${flight.departureAirport} to ${flight.arrivalAirport}`,
        });
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else {
        const { status } = await MediaLibrary.requestPermissionsAsync();
        if (status === "granted") {
          await MediaLibrary.saveToLibraryAsync(uri);
          Alert.alert("Saved!", "Flight card saved to your camera roll.");
        }
      }
    } catch (e) {
      console.error("Share failed:", e);
      Alert.alert("Error", "Could not share this flight. Please try again.");
    } finally {
      setSharing(false);
    }
  }

  if (!flight) {
    return (
      <View style={[styles.container, { paddingTop: topPad }]}>
        <View style={styles.navBar}>
          <Pressable onPress={() => router.back()} style={styles.navBtn} hitSlop={8}>
            <Ionicons name="chevron-back" size={22} color={Colors.text} />
          </Pressable>
        </View>
        <View style={styles.notFound}>
          <Ionicons name="airplane-outline" size={36} color={Colors.textSec} style={{ marginBottom: 12 }} />
          <Text style={styles.notFoundText}>Flight not found.</Text>
        </View>
      </View>
    );
  }

  const TODAY     = new Date().toISOString().substring(0, 10);
  const isUpcoming = flight.date >= TODAY;
  const isDelayed  = flight.status === "delayed";
  const co2Trees   = (flight.co2Kg / 21).toFixed(1);

  // Derive top speed: average cruise speed (distance / flight time) in mph
  // Commercial jets cruise ~480-580 mph; we show the derived average
  const avgSpeedMph = flight.durationMinutes > 0
    ? Math.round((flight.distanceMiles / flight.durationMinutes) * 60)
    : 0;

  const statusColor = isUpcoming ? Colors.accent : isDelayed ? Colors.red : Colors.green;
  const statusLabel = isUpcoming ? "Upcoming" : isDelayed ? `Delayed +${flight.delayMinutes} min` : "Completed";

  const airlineInfo = getAirlineInfo(flight.airlineCode);

  return (
    <View style={[styles.container, { paddingTop: topPad }]}>
      <ViewShot ref={shareRef} options={{ format: "png", quality: 1.0 }} style={styles.hiddenCapture}>
        <FlightShareCard flight={flight} />
      </ViewShot>

      {/* Nav bar */}
      <View style={styles.navBar}>
        <Pressable onPress={() => router.back()} style={styles.navBtn} hitSlop={8}>
          <Ionicons name="chevron-back" size={22} color={Colors.text} />
        </Pressable>
        <View style={styles.navCenter}>
          {/* Airline name + emoji */}
          <View style={styles.navAirlineRow}>
            <Text style={styles.navAirlineEmoji}>{airlineInfo.emoji}</Text>
            <Text style={styles.navLabel}>{flight.airline}</Text>
          </View>
          {/* Route title — plain ASCII arrow */}
          <Text style={styles.navTitle}>
            {flight.departureAirport}{" -> "}{flight.arrivalAirport}
          </Text>
        </View>
        <Pressable
          onPress={handleShare}
          disabled={sharing}
          style={({ pressed }) => [styles.navBtn, { opacity: sharing || pressed ? 0.7 : 1 }]}
          hitSlop={8}
        >
          {sharing
            ? <ActivityIndicator size="small" color={Colors.accent} />
            : <Ionicons name="share-outline" size={20} color={Colors.accent} />}
        </Pressable>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scroll, { paddingBottom: bottomPad }]}
        contentInsetAdjustmentBehavior="automatic"
      >
        {/* ───────────────────── HERO CARD ───────────────────── */}
        <Animated.View entering={FadeInDown.delay(0).springify()} style={styles.heroCard}>

          {/* Status pill + flight code */}
          <View style={styles.heroTopRow}>
            <Text style={styles.heroFlightCode}>{flight.flightCode}</Text>
            <View style={[styles.statusPill, { backgroundColor: statusColor + "20", borderColor: statusColor + "50" }]}>
              <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
              <Text style={[styles.statusText, { color: statusColor }]}>{statusLabel}</Text>
            </View>
          </View>

          {/* Route */}
          <View style={styles.routeRow}>
            <View style={styles.routeEnd}>
              <Text style={styles.iata}>{flight.departureAirport}</Text>
              <Text style={styles.cityName}>{flight.departureCity}</Text>
            </View>
            <View style={styles.routeMid}>
              <View style={styles.flightLine} />
              <View style={[styles.planeCircle, { backgroundColor: Colors.accentDim }]}>
                <Ionicons name="airplane" size={18} color={Colors.accent} />
              </View>
              <View style={styles.flightLine} />
            </View>
            <View style={[styles.routeEnd, { alignItems: "flex-end" }]}>
              <Text style={styles.iata}>{flight.arrivalAirport}</Text>
              <Text style={[styles.cityName, { textAlign: "right" }]}>{flight.arrivalCity}</Text>
            </View>
          </View>

          {/* Times + duration */}
          <View style={styles.timesRow}>
            <View style={styles.timesBlock}>
              <Text style={styles.timeText}>{flight.departureTime}</Text>
              {(flight.departureTerminal || flight.departureGate) ? (
                <Text style={styles.timeSubText}>
                  {[flight.departureTerminal ? `T${flight.departureTerminal}` : null, flight.departureGate ? `Gate ${flight.departureGate}` : null].filter(Boolean).join(" \u00b7 ")}
                </Text>
              ) : null}
            </View>
            <View style={styles.timesMid}>
              <Text style={styles.durationText}>{formatHours(flight.durationMinutes)}</Text>
              <Text style={styles.dateText}>{formatDateShort(flight.date)}</Text>
            </View>
            <View style={[styles.timesBlock, { alignItems: "flex-end" }]}>
              <Text style={styles.timeText}>{flight.arrivalTime}</Text>
              {(flight.arrivalTerminal || flight.arrivalGate) ? (
                <Text style={styles.timeSubText}>
                  {[flight.arrivalTerminal ? `T${flight.arrivalTerminal}` : null, flight.arrivalGate ? `Gate ${flight.arrivalGate}` : null].filter(Boolean).join(" \u00b7 ")}
                </Text>
              ) : null}
            </View>
          </View>

          {/* Airline row + aircraft */}
          <View style={styles.heroBottomRow}>
            <View style={styles.airlineRow}>
              <View style={[styles.airlineEmojiBox, { backgroundColor: airlineInfo.color + "18" }]}>
                <Text style={styles.airlineEmoji}>{airlineInfo.emoji}</Text>
              </View>
              <Text style={styles.airlineName}>{flight.airline}</Text>
              {flight.verified && (
                <View style={styles.verifiedBadge}>
                  <Ionicons name="checkmark-circle" size={13} color={Colors.accent} />
                  <Text style={styles.verifiedText}>Verified</Text>
                </View>
              )}
            </View>
            <Text style={styles.aircraftText}>{flight.aircraft}</Text>
          </View>
        </Animated.View>

        {/* ───────────────────── STATS ROW ───────────────────── */}
        <Animated.View entering={FadeInDown.delay(80).springify()} style={styles.statsRow}>
          <View style={styles.statBox}>
            <Ionicons name="navigate-outline" size={18} color={Colors.accent} />
            <Text style={styles.statNum}>{flight.distanceMiles.toLocaleString()}</Text>
            <Text style={styles.statLbl}>miles</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statBox}>
            <Ionicons name="speedometer-outline" size={18} color={Colors.amber} />
            <Text style={styles.statNum}>{avgSpeedMph}</Text>
            <Text style={styles.statLbl}>mph avg</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statBox}>
            <Ionicons name="leaf-outline" size={18} color={Colors.green} />
            <Text style={styles.statNum}>{flight.co2Kg}</Text>
            <Text style={styles.statLbl}>kg CO\u2082</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statBox}>
            <Ionicons name="time-outline" size={18} color={Colors.textSec} />
            <Text style={styles.statNum}>{formatHours(flight.durationMinutes)}</Text>
            <Text style={styles.statLbl}>duration</Text>
          </View>
        </Animated.View>

        {/* ───────────────────── FLIGHT INFO ───────────────────── */}
        <Animated.View entering={FadeInDown.delay(160).springify()} style={styles.section}>
          <Text style={styles.sectionTitle}>Flight Info</Text>
          <View style={styles.card}>
            <InfoRow label="Airline" value={`${airlineInfo.emoji}  ${flight.airline}`} />
            <InfoRow label="Flight" value={flight.flightCode} />
            <InfoRow label="Aircraft" value={flight.aircraft} />
            {flight.tailNumber ? <InfoRow label="Tail Number" value={flight.tailNumber} /> : null}
            <InfoRow label="Date" value={formatDate(flight.date)} />
            <InfoRow
              label="Departure"
              value={`${flight.departureAirport}  \u00b7  ${flight.departureTime}${flight.departureTerminal ? `  \u00b7  T${flight.departureTerminal}` : ""}${flight.departureGate ? `  \u00b7  Gate ${flight.departureGate}` : ""}`}
            />
            <InfoRow
              label="Arrival"
              value={`${flight.arrivalAirport}  \u00b7  ${flight.arrivalTime}${flight.arrivalTerminal ? `  \u00b7  T${flight.arrivalTerminal}` : ""}${flight.arrivalGate ? `  \u00b7  Gate ${flight.arrivalGate}` : ""}`}
            />
            <InfoRow
              label="Distance"
              value={`${flight.distanceMiles.toLocaleString()} mi  \u00b7  ${Math.round(flight.distanceMiles * 1.60934).toLocaleString()} km`}
            />
            {avgSpeedMph > 0 && (
              <InfoRow label="Avg Speed" value={`${avgSpeedMph} mph  \u00b7  ${Math.round(avgSpeedMph * 1.60934)} km/h`} />
            )}
          </View>
        </Animated.View>

        {/* ───────────────────── ENV IMPACT ───────────────────── */}
        <Animated.View entering={FadeInDown.delay(220).springify()} style={styles.section}>
          <Text style={styles.sectionTitle}>Environmental Impact</Text>
          <View style={styles.card}>
            <InfoRow label="CO\u2082 Emitted" value={`${flight.co2Kg} kg`} accent={Colors.green} />
            <InfoRow label="Tree equivalent" value={`${co2Trees} trees / year to offset`} />
          </View>
        </Animated.View>

        {/* ───────────────────── SHARE ───────────────────── */}
        <Animated.View entering={FadeInDown.delay(280).springify()} style={styles.shareSection}>
          <Text style={styles.sectionTitle}>Share This Flight</Text>
          <Pressable
            onPress={handleShare}
            disabled={sharing}
            style={({ pressed }) => [styles.shareBtn, { opacity: sharing || pressed ? 0.75 : 1 }]}
          >
            {sharing
              ? <ActivityIndicator size="small" color={Colors.white} />
              : (
                <>
                  <Ionicons name="share-social-outline" size={20} color={Colors.white} />
                  <Text style={styles.shareBtnText}>Share with friends</Text>
                </>
              )}
          </Pressable>
          <Text style={styles.shareHint}>
            Generates a boarding-pass style card \u2014 share to Instagram, WhatsApp, and more.
          </Text>
        </Animated.View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container:      { flex: 1, backgroundColor: Colors.bg },
  hiddenCapture:  { position: "absolute", left: -9999, top: 0 },

  // ── Nav bar ──────────────────────────────────────────────────────────────
  navBar: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingTop: 8, paddingBottom: 10,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  navBtn: {
    width: 40, height: 40, alignItems: "center", justifyContent: "center",
    borderRadius: 20, backgroundColor: Colors.card,
    borderWidth: 1, borderColor: Colors.border,
  },
  navCenter:       { flex: 1, alignItems: "center", paddingHorizontal: 12 },
  navAirlineRow:   { flexDirection: "row", alignItems: "center", gap: 5, marginBottom: 2 },
  navAirlineEmoji: { fontSize: 13 },
  navLabel: {
    fontSize: 11, color: Colors.textSec, fontFamily: "DMSans_400Regular",
    letterSpacing: 0.5, textTransform: "uppercase",
  },
  navTitle: { fontSize: 16, color: Colors.text, fontFamily: "DMSans_700Bold" },

  scroll:       { paddingHorizontal: 20, paddingTop: 16 },
  notFound:     { flex: 1, alignItems: "center", justifyContent: "center" },
  notFoundText: { fontSize: 16, color: Colors.textSec, fontFamily: "DMSans_400Regular" },

  // ── Hero card — uses app card colours, NO dark gradient ──────────────────
  heroCard: {
    backgroundColor: Colors.card,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 20,
    marginBottom: 14,
  },
  heroTopRow: {
    flexDirection: "row", justifyContent: "space-between",
    alignItems: "center", marginBottom: 20,
  },
  heroFlightCode: {
    fontSize: 14, color: Colors.textSec,
    fontFamily: "DMSans_700Bold", letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  statusPill: {
    flexDirection: "row", alignItems: "center", gap: 5,
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 20, borderWidth: 1,
  },
  statusDot:  { width: 5, height: 5, borderRadius: 2.5 },
  statusText: { fontSize: 11, fontFamily: "DMSans_600SemiBold" ?? "DMSans_500Medium" },

  // route
  routeRow: { flexDirection: "row", alignItems: "center", marginBottom: 18 },
  routeEnd: { flex: 1 },
  routeMid: { flexDirection: "row", alignItems: "center", paddingHorizontal: 8 },
  flightLine: { flex: 1, height: 1.5, backgroundColor: Colors.border, width: 22 },
  planeCircle: {
    width: 38, height: 38, borderRadius: 19,
    alignItems: "center", justifyContent: "center", marginHorizontal: 6,
    borderWidth: 1, borderColor: Colors.border,
  },
  iata:     { fontSize: 40, color: Colors.text, fontFamily: "DMSans_700Bold", lineHeight: 46 },
  cityName: { fontSize: 12, color: Colors.textSec, fontFamily: "DMSans_400Regular", marginTop: 4 },

  // times
  timesRow: {
    flexDirection: "row", justifyContent: "space-between",
    alignItems: "flex-start",
    paddingTop: 16, borderTopWidth: 1, borderTopColor: Colors.border,
    marginBottom: 16,
  },
  timesBlock:  { flex: 1 },
  timesMid:    { flex: 1, alignItems: "center", paddingTop: 2 },
  timeText:    { fontSize: 22, color: Colors.text, fontFamily: "DMSans_700Bold" },
  timeSubText: { fontSize: 10, color: Colors.textMuted, fontFamily: "DMSans_400Regular", marginTop: 3 },
  durationText:{ fontSize: 12, color: Colors.textSec, fontFamily: "DMSans_400Regular", marginBottom: 2 },
  dateText:    { fontSize: 11, color: Colors.textMuted, fontFamily: "DMSans_400Regular" },

  // bottom row
  heroBottomRow: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingTop: 14, borderTopWidth: 1, borderTopColor: Colors.border,
  },
  airlineRow:    { flexDirection: "row", alignItems: "center", gap: 8 },
  airlineEmojiBox: {
    width: 28, height: 28, borderRadius: 8,
    alignItems: "center", justifyContent: "center",
  },
  airlineEmoji:  { fontSize: 16 },
  airlineName:   { fontSize: 13, color: Colors.text, fontFamily: "DMSans_500Medium" },
  verifiedBadge: {
    flexDirection: "row", alignItems: "center", gap: 3,
    backgroundColor: Colors.accentDim,
    paddingHorizontal: 7, paddingVertical: 3, borderRadius: 10,
  },
  verifiedText:  { fontSize: 10, color: Colors.accent, fontFamily: "DMSans_500Medium" },
  aircraftText:  { fontSize: 12, color: Colors.textSec, fontFamily: "DMSans_400Regular" },

  // ── Stats row ────────────────────────────────────────────────────────────
  statsRow: {
    backgroundColor: Colors.card, borderRadius: 16,
    flexDirection: "row", marginBottom: 24,
    borderWidth: 1, borderColor: Colors.border, overflow: "hidden",
  },
  statBox:     { flex: 1, alignItems: "center", paddingVertical: 18, gap: 4 },
  statDivider: { width: 1, backgroundColor: Colors.border, marginVertical: 12 },
  statNum:     { fontSize: 16, color: Colors.text, fontFamily: "DMSans_700Bold" },
  statLbl:     { fontSize: 10, color: Colors.textSec, fontFamily: "DMSans_400Regular" },

  // ── Sections ─────────────────────────────────────────────────────────────
  section: { marginBottom: 16 },
  sectionTitle: {
    fontSize: 12, color: Colors.textSec, fontFamily: "DMSans_500Medium",
    letterSpacing: 0.8, textTransform: "uppercase", marginBottom: 10,
  },
  card: {
    backgroundColor: Colors.card, borderRadius: 16,
    paddingHorizontal: 16, borderWidth: 1, borderColor: Colors.border,
  },

  // ── Share ─────────────────────────────────────────────────────────────────
  shareSection: { marginBottom: 8 },
  shareBtn: {
    backgroundColor: Colors.accent, borderRadius: 14, padding: 17,
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 10, marginBottom: 10,
  },
  shareBtnText: { fontSize: 16, color: Colors.white, fontFamily: "DMSans_700Bold" },
  shareHint: {
    fontSize: 12, color: Colors.textSec, fontFamily: "DMSans_400Regular",
    textAlign: "center", lineHeight: 17,
  },
});
