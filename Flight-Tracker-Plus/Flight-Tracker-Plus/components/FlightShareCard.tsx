import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { Flight } from "@/context/flights";

export const FLIGHT_CARD_WIDTH = 375;
export const FLIGHT_CARD_HEIGHT = 600;

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function formatHours(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

function getCO2FunFact(co2Kg: number): string {
  const coffeeCups = Math.round(co2Kg / 0.021);
  const netflixHours = Math.round(co2Kg / 0.055);
  const beers = Math.round(co2Kg / 0.3);
  const pizzas = Math.round(co2Kg / 0.5);
  const donuts = Math.round(co2Kg / 0.06);
  const burps = Math.round(co2Kg / 0.0001);
  if (co2Kg < 5) return `${burps.toLocaleString()} burps worth of CO\u2082`;
  if (co2Kg < 20) return `${donuts.toLocaleString()} donuts from the bakery`;
  if (co2Kg < 50) return `${coffeeCups.toLocaleString()} cups of coffee`;
  if (co2Kg < 100) return `${netflixHours.toLocaleString()} hrs of Netflix`;
  if (co2Kg < 200) return `${beers.toLocaleString()} beers at the pub`;
  return `${pizzas.toLocaleString()} pizza deliveries`;
}

export default function FlightShareCard({ flight }: { flight: Flight }) {
  const isDelayed = flight.status === "delayed";
  const km = Math.round(flight.distanceMiles * 1.60934).toLocaleString();
  const funFact = getCO2FunFact(flight.co2Kg);

  return (
    <View style={styles.card}>
      <LinearGradient
        colors={["#050B18", "#0B1D3F", "#050B18"]}
        locations={[0, 0.5, 1]}
        style={StyleSheet.absoluteFill}
      />

      <View style={styles.decorCircle1} />
      <View style={styles.decorCircle2} />

      <View style={styles.inner}>
        <View style={styles.topBar}>
          <View style={styles.logoRow}>
            <Ionicons name="airplane" size={12} color="#4F8EF0" />
            <Text style={styles.logoText}>LOGBOOK</Text>
          </View>
          <View
            style={[
              styles.statusBadge,
              {
                backgroundColor: isDelayed
                  ? "rgba(248,113,113,0.15)"
                  : "rgba(52,211,153,0.15)",
                borderColor: isDelayed
                  ? "rgba(248,113,113,0.4)"
                  : "rgba(52,211,153,0.4)",
              },
            ]}
          >
            <View
              style={[
                styles.statusDot,
                { backgroundColor: isDelayed ? "#F87171" : "#34D399" },
              ]}
            />
            <Text
              style={[
                styles.statusText,
                { color: isDelayed ? "#F87171" : "#34D399" },
              ]}
            >
              {isDelayed ? `Delayed +${flight.delayMinutes}m` : "On Time"}
            </Text>
          </View>
        </View>

        <View style={styles.routeSection}>
          <View style={styles.routeEnd}>
            <Text style={styles.iata}>{flight.departureAirport}</Text>
            <Text style={styles.city}>{flight.departureCity}</Text>
            <Text style={styles.time}>{flight.departureTime}</Text>
          </View>

          <View style={styles.routeMid}>
            <View style={styles.routeLine} />
            <View style={styles.planeWrap}>
              <Ionicons name="airplane" size={18} color="#4F8EF0" />
            </View>
            <View style={styles.routeLine} />
          </View>

          <View style={[styles.routeEnd, { alignItems: "flex-end" }]}>
            <Text style={styles.iata}>{flight.arrivalAirport}</Text>
            <Text style={styles.city}>{flight.arrivalCity}</Text>
            <Text style={styles.time}>{flight.arrivalTime}</Text>
          </View>
        </View>

        <Text style={styles.duration}>
          {formatHours(flight.durationMinutes)} \u00b7 {flight.flightCode} \u00b7 {flight.airline}
        </Text>

        <View style={styles.tearLine}>
          <View style={styles.notchL} />
          <View style={styles.dashes}>
            {Array.from({ length: 18 }).map((_, i) => (
              <View key={i} style={styles.dash} />
            ))}
          </View>
          <View style={styles.notchR} />
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Ionicons name="navigate" size={14} color="#4F8EF0" />
            <Text style={styles.statValue}>
              {flight.distanceMiles.toLocaleString()} mi
            </Text>
            <Text style={styles.statSub}>{km} km</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Ionicons name="leaf" size={14} color="#10B981" />
            <Text style={styles.statValue}>{flight.co2Kg} kg</Text>
            <Text style={styles.statSub}>CO\u2082</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Ionicons name="cube-outline" size={14} color="#F59E0B" />
            <Text style={styles.statValue}>
              {flight.aircraft.split(" ").slice(-1)[0]}
            </Text>
            <Text style={styles.statSub}>Aircraft</Text>
          </View>
        </View>

        {/* CO2 fun fact */}
        <View style={styles.funFactRow}>
          <Ionicons name="leaf-outline" size={11} color="#10B981" />
          <Text style={styles.funFactText}>That\u2019s like {funFact}</Text>
        </View>

        <View style={styles.footer}>
          <Text style={styles.dateText}>{formatDate(flight.date)}</Text>
          <Text style={styles.footerBrand}>logbook.app</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: FLIGHT_CARD_WIDTH,
    height: FLIGHT_CARD_HEIGHT,
    backgroundColor: "#050B18",
    borderRadius: 24,
    overflow: "hidden",
  },
  decorCircle1: {
    position: "absolute",
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: "rgba(79,142,240,0.07)",
    top: -80,
    right: -60,
  },
  decorCircle2: {
    position: "absolute",
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: "rgba(79,142,240,0.04)",
    bottom: 30,
    left: -50,
  },
  inner: {
    flex: 1,
    paddingHorizontal: 32,
    paddingTop: 32,
    paddingBottom: 28,
    justifyContent: "space-between",
  },
  topBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  logoRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  logoText: { fontSize: 11, color: "#4F8EF0", fontFamily: "DMSans_700Bold", letterSpacing: 2.5 },
  statusBadge: {
    flexDirection: "row", alignItems: "center", gap: 5,
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 10, borderWidth: 1,
  },
  statusDot: { width: 5, height: 5, borderRadius: 2.5 },
  statusText: { fontSize: 11, fontFamily: "DMSans_700Bold", letterSpacing: 0.3 },
  routeSection: { flexDirection: "row", alignItems: "center", gap: 12 },
  routeEnd: { flex: 1, gap: 4 },
  iata: { fontSize: 42, color: "#F0F6FF", fontFamily: "DMSans_700Bold", lineHeight: 46 },
  city: { fontSize: 12, color: "rgba(240,246,255,0.45)", fontFamily: "DMSans_400Regular" },
  time: { fontSize: 18, color: "#F0F6FF", fontFamily: "DMSans_700Bold", marginTop: 4 },
  routeMid: { flexDirection: "column", alignItems: "center", gap: 6, flex: 0.6 },
  routeLine: { height: 1, backgroundColor: "rgba(79,142,240,0.3)", width: "100%" },
  planeWrap: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: "rgba(79,142,240,0.15)",
    alignItems: "center", justifyContent: "center",
    borderWidth: 1, borderColor: "rgba(79,142,240,0.3)",
  },
  duration: {
    fontSize: 13, color: "rgba(240,246,255,0.4)",
    fontFamily: "DMSans_400Regular", textAlign: "center", letterSpacing: 0.3,
  },
  tearLine: { flexDirection: "row", alignItems: "center", marginHorizontal: -32 },
  notchL: {
    width: 18, height: 18, borderRadius: 9,
    backgroundColor: "#050B18", marginLeft: -9,
    borderWidth: 1, borderColor: "rgba(79,142,240,0.2)",
  },
  notchR: {
    width: 18, height: 18, borderRadius: 9,
    backgroundColor: "#050B18", marginRight: -9,
    borderWidth: 1, borderColor: "rgba(79,142,240,0.2)",
  },
  dashes: { flex: 1, flexDirection: "row", gap: 4, paddingHorizontal: 8, alignItems: "center" },
  dash: { flex: 1, height: 1, backgroundColor: "rgba(79,142,240,0.2)" },
  statsRow: { flexDirection: "row", alignItems: "center" },
  statItem: { flex: 1, alignItems: "center", gap: 4 },
  statDivider: { width: 1, height: 48, backgroundColor: "rgba(79,142,240,0.15)" },
  statValue: { fontSize: 16, color: "#F0F6FF", fontFamily: "DMSans_700Bold" },
  statSub: { fontSize: 11, color: "rgba(240,246,255,0.35)", fontFamily: "DMSans_400Regular" },

  // CO2 fun fact
  funFactRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 2,
  },
  funFactText: {
    fontSize: 12,
    color: "rgba(16,185,129,0.7)",
    fontFamily: "DMSans_400Regular",
    fontStyle: "italic",
    textAlign: "center",
    flex: 1,
  },

  footer: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  dateText: { fontSize: 13, color: "rgba(240,246,255,0.4)", fontFamily: "DMSans_400Regular" },
  footerBrand: { fontSize: 11, color: "rgba(240,246,255,0.2)", fontFamily: "DMSans_400Regular", letterSpacing: 1 },
});
