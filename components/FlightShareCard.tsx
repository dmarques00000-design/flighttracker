/**
 * FlightShareCard
 * Supports dark and light themes via the `theme` prop.
 */
import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { Flight } from "@/context/flights";
import { getCO2FunFact } from "@/utils/co2FunFact";
import { CardTheme, THEMES } from "@/constants/cardThemes";

export const FLIGHT_CARD_WIDTH = 375;
export const FLIGHT_CARD_HEIGHT = 600;

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", {
    weekday: "short", month: "long", day: "numeric", year: "numeric",
  });
}

function formatHours(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

export default function FlightShareCard({ flight, theme = "dark" }: { flight: Flight; theme?: CardTheme }) {
  const tk = THEMES[theme];
  const isDelayed = flight.status === "delayed";
  const km = Math.round(flight.distanceMiles * 1.60934).toLocaleString();
  const funFact = getCO2FunFact(flight.co2Kg);

  return (
    <View style={[ss.card, { backgroundColor: tk.cardBg }]}>
      <LinearGradient
        colors={tk.gradientColors}
        locations={tk.gradientLocations}
        style={StyleSheet.absoluteFill}
      />
      <View style={[ss.decorCircle1, { backgroundColor: tk.glow1Color }]} />
      <View style={[ss.decorCircle2, { backgroundColor: tk.glow2Color }]} />

      <View style={ss.inner}>
        {/* TOP BAR */}
        <View style={ss.topBar}>
          <View style={ss.logoRow}>
            <Ionicons name="airplane" size={12} color="#4F8EF0" />
            <Text style={[ss.logoText, { color: tk.textAccentStrong }]}>LOGBOOK</Text>
          </View>
          <View style={[ss.statusBadge, {
            backgroundColor: isDelayed ? "rgba(248,113,113,0.15)" : "rgba(52,211,153,0.15)",
            borderColor: isDelayed ? "rgba(248,113,113,0.4)" : "rgba(52,211,153,0.4)",
          }]}>
            <View style={[ss.statusDot, { backgroundColor: isDelayed ? "#F87171" : "#34D399" }]} />
            <Text style={[ss.statusText, { color: isDelayed ? "#F87171" : "#34D399" }]}>
              {isDelayed ? `Delayed +${flight.delayMinutes}m` : "On Time"}
            </Text>
          </View>
        </View>

        {/* ROUTE */}
        <View style={ss.routeSection}>
          <View style={ss.routeEnd}>
            <Text style={[ss.iata, { color: tk.textPrimary }]}>{flight.departureAirport}</Text>
            <Text style={[ss.city, { color: tk.textMuted }]}>{flight.departureCity}</Text>
            <Text style={[ss.time, { color: tk.textPrimary }]}>{flight.departureTime}</Text>
          </View>
          <View style={ss.routeMid}>
            <View style={[ss.routeLine, { backgroundColor: tk.dividerColor }]} />
            <View style={[ss.planeWrap, { backgroundColor: tk.pillBg, borderColor: tk.pillBorder }]}>
              <Ionicons name="airplane" size={18} color="#4F8EF0" />
            </View>
            <View style={[ss.routeLine, { backgroundColor: tk.dividerColor }]} />
          </View>
          <View style={[ss.routeEnd, { alignItems: "flex-end" }]}>
            <Text style={[ss.iata, { color: tk.textPrimary }]}>{flight.arrivalAirport}</Text>
            <Text style={[ss.city, { color: tk.textMuted }]}>{flight.arrivalCity}</Text>
            <Text style={[ss.time, { color: tk.textPrimary }]}>{flight.arrivalTime}</Text>
          </View>
        </View>

        <Text style={[ss.duration, { color: tk.textMuted }]}>
          {`${formatHours(flight.durationMinutes)} · ${flight.flightCode} · ${flight.airline}`}
        </Text>

        {/* TEAR LINE */}
        <View style={[ss.tearLine]}>
          <View style={[ss.notchL, { backgroundColor: tk.notchBg, borderColor: tk.tearBorder }]} />
          <View style={ss.dashes}>
            {Array.from({ length: 18 }).map((_, i) => (
              <View key={i} style={[ss.dash, { backgroundColor: tk.tearBorder }]} />
            ))}
          </View>
          <View style={[ss.notchR, { backgroundColor: tk.notchBg, borderColor: tk.tearBorder }]} />
        </View>

        {/* STATS */}
        <View style={ss.statsRow}>
          <View style={ss.statItem}>
            <Ionicons name="navigate" size={14} color="#4F8EF0" />
            <Text style={[ss.statValue, { color: tk.textPrimary }]}>{flight.distanceMiles.toLocaleString()} mi</Text>
            <Text style={[ss.statSub, { color: tk.textMuted }]}>{km} km</Text>
          </View>
          <View style={[ss.statDivider, { backgroundColor: tk.dividerColor }]} />
          <View style={ss.statItem}>
            <Ionicons name="leaf" size={14} color="#10B981" />
            <Text style={[ss.statValue, { color: tk.textPrimary }]}>{flight.co2Kg} kg</Text>
            <Text style={[ss.statSub, { color: tk.textMuted }]}>CO₂</Text>
          </View>
          <View style={[ss.statDivider, { backgroundColor: tk.dividerColor }]} />
          <View style={ss.statItem}>
            <Ionicons name="cube-outline" size={14} color="#F59E0B" />
            <Text style={[ss.statValue, { color: tk.textPrimary }]}>{flight.aircraft.split(" ").slice(-1)[0]}</Text>
            <Text style={[ss.statSub, { color: tk.textMuted }]}>Aircraft</Text>
          </View>
        </View>

        {funFact ? (
          <View style={[ss.funFactRow, { backgroundColor: tk.factBg, borderColor: tk.factBorder, borderWidth: 1, borderRadius: 10, padding: 8 }]}>
            <Ionicons name="leaf-outline" size={11} color="#10B981" />
            <Text style={ss.funFactText}>{`That’s like `}{funFact}</Text>
          </View>
        ) : null}

        {/* FOOTER */}
        <View style={ss.footer}>
          <Text style={[ss.dateText, { color: tk.textMuted }]}>{formatDate(flight.date)}</Text>
          <Text style={[ss.footerBrand, { color: tk.textAccentStrong }]}>logbook.app</Text>
        </View>
      </View>
    </View>
  );
}

const ss = StyleSheet.create({
  card: { width: FLIGHT_CARD_WIDTH, height: FLIGHT_CARD_HEIGHT, borderRadius: 24, overflow: "hidden" },
  decorCircle1: { position: "absolute", width: 280, height: 280, borderRadius: 140, top: -80, right: -60 },
  decorCircle2: { position: "absolute", width: 180, height: 180, borderRadius: 90, bottom: 30, left: -50 },
  inner: { flex: 1, paddingHorizontal: 32, paddingTop: 32, paddingBottom: 28, justifyContent: "space-between" },
  topBar: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  logoRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  logoText: { fontSize: 11, fontFamily: "DMSans_700Bold", letterSpacing: 2.5 },
  statusBadge: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10, borderWidth: 1 },
  statusDot: { width: 5, height: 5, borderRadius: 2.5 },
  statusText: { fontSize: 11, fontFamily: "DMSans_700Bold", letterSpacing: 0.3 },
  routeSection: { flexDirection: "row", alignItems: "center", gap: 12 },
  routeEnd: { flex: 1, gap: 4 },
  iata: { fontSize: 42, fontFamily: "DMSans_700Bold", lineHeight: 46 },
  city: { fontSize: 12, fontFamily: "DMSans_400Regular" },
  time: { fontSize: 18, fontFamily: "DMSans_700Bold", marginTop: 4 },
  routeMid: { flexDirection: "column", alignItems: "center", gap: 6, flex: 0.6 },
  routeLine: { height: 1, width: "100%" },
  planeWrap: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center", borderWidth: 1 },
  duration: { fontSize: 13, fontFamily: "DMSans_400Regular", textAlign: "center", letterSpacing: 0.3 },
  tearLine: { flexDirection: "row", alignItems: "center", marginHorizontal: -32 },
  notchL: { width: 18, height: 18, borderRadius: 9, marginLeft: -9, borderWidth: 1 },
  notchR: { width: 18, height: 18, borderRadius: 9, marginRight: -9, borderWidth: 1 },
  dashes: { flex: 1, flexDirection: "row", gap: 4, paddingHorizontal: 8, alignItems: "center" },
  dash: { flex: 1, height: 1 },
  statsRow: { flexDirection: "row", alignItems: "center" },
  statItem: { flex: 1, alignItems: "center", gap: 4 },
  statDivider: { width: 1, height: 48 },
  statValue: { fontSize: 16, fontFamily: "DMSans_700Bold" },
  statSub: { fontSize: 11, fontFamily: "DMSans_400Regular" },
  funFactRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 2 },
  funFactText: { fontSize: 12, color: "rgba(16,185,129,0.7)", fontFamily: "DMSans_400Regular", fontStyle: "italic", textAlign: "center", flex: 1 },
  footer: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  dateText: { fontSize: 13, fontFamily: "DMSans_400Regular" },
  footerBrand: { fontSize: 11, fontFamily: "DMSans_400Regular", letterSpacing: 1 },
});
