import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { Flight } from "@/context/flights";

export interface StoryCardProps {
  flights: Flight[];
  periodLabel: string;
}

function formatNum(n: number): string {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(n);
}

function formatHours(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

function computeRank(n: number): number {
  if (n === 0) return 0;
  if (n <= 1) return 15;
  if (n <= 3) return 35;
  if (n <= 6) return 55;
  if (n <= 10) return 70;
  if (n <= 15) return 82;
  if (n <= 25) return 91;
  if (n <= 40) return 96;
  return 99;
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

function getTopRoutes(flights: Flight[]): { dep: string; arr: string }[] {
  const freq: Record<string, number> = {};
  flights.forEach((f) => {
    const key = `${f.departureAirport}\u2192${f.arrivalAirport}`;
    freq[key] = (freq[key] || 0) + 1;
  });
  return Object.entries(freq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([k]) => {
      const [dep, arr] = k.split("\u2192");
      return { dep, arr };
    });
}

export const CARD_WIDTH = 375;
export const CARD_HEIGHT = 667;

export default function StoryCard({ flights, periodLabel }: StoryCardProps) {
  const count = flights.length;
  const miles = flights.reduce((s, f) => s + f.distanceMiles, 0);
  const co2 = flights.reduce((s, f) => s + f.co2Kg, 0);
  const flightMin = flights.reduce((s, f) => s + f.durationMinutes, 0);
  const delayMin = flights.reduce((s, f) => s + f.delayMinutes, 0);
  const rank = computeRank(count);
  const topRoutes = getTopRoutes(flights);
  const verifiedCount = flights.filter((f) => f.verified).length;
  const funFact = co2 > 0 ? getCO2FunFact(co2) : null;

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
        <View style={styles.topSection}>
          <View style={styles.logoRow}>
            <Ionicons name="airplane" size={14} color="#4F8EF0" />
            <Text style={styles.logoText}>LOGBOOK</Text>
          </View>
          <Text style={styles.tagline}>My Year in the Air</Text>
        </View>

        <View style={styles.divider} />

        <View style={styles.mainSection}>
          <Text style={styles.periodLabel}>{periodLabel}</Text>
          <Text style={styles.bigNumber}>{count}</Text>
          <Text style={styles.bigLabel}>FLIGHTS</Text>
        </View>

        <View style={styles.divider} />

        <View style={styles.statsSection}>
          <View style={styles.statRow}>
            <Ionicons name="navigate" size={14} color="#4F8EF0" />
            <Text style={styles.statText}>{formatNum(miles)} miles flown</Text>
          </View>
          <View style={styles.statRow}>
            <Ionicons name="leaf" size={14} color="#10B981" />
            <Text style={styles.statText}>{formatNum(co2)} kg CO\u2082</Text>
          </View>
          {funFact && (
            <View style={styles.statRow}>
              <Ionicons name="leaf-outline" size={14} color="#10B981" />
              <Text style={[styles.statText, styles.funFactText]}>That\u2019s like {funFact}</Text>
            </View>
          )}
          <View style={styles.statRow}>
            <Ionicons name="time" size={14} color="#F59E0B" />
            <Text style={styles.statText}>
              {formatHours(flightMin)} in the air
            </Text>
          </View>
          {delayMin > 0 && (
            <View style={styles.statRow}>
              <Ionicons name="hourglass" size={14} color="#EF4444" />
              <Text style={styles.statText}>
                {formatHours(delayMin)} delayed
              </Text>
            </View>
          )}
          {verifiedCount > 0 && (
            <View style={styles.statRow}>
              <Ionicons name="checkmark-circle" size={14} color="#4F8EF0" />
              <Text style={styles.statText}>
                {verifiedCount} verified flight{verifiedCount !== 1 ? "s" : ""}
              </Text>
            </View>
          )}
        </View>

        {topRoutes.length > 0 && (
          <>
            <View style={styles.divider} />
            <View style={styles.routesSection}>
              <Text style={styles.routesTitle}>TOP ROUTES</Text>
              {topRoutes.map((r, i) => (
                <View key={i} style={styles.routeRow}>
                  <Text style={styles.routeText}>{r.dep}</Text>
                  <View style={styles.routeDots}>
                    <View style={styles.dot} />
                    <View style={styles.dot} />
                    <View style={styles.dot} />
                    <Ionicons name="airplane" size={12} color="#4F8EF0" />
                    <View style={styles.dot} />
                    <View style={styles.dot} />
                    <View style={styles.dot} />
                  </View>
                  <Text style={styles.routeTextRight}>{r.arr}</Text>
                </View>
              ))}
            </View>
          </>
        )}

        {rank > 0 && (
          <>
            <View style={styles.divider} />
            <View style={styles.rankSection}>
              <View style={styles.rankBadge}>
                <Text style={styles.rankBadgeText}>TOP {100 - rank}%</Text>
              </View>
              <Text style={styles.rankCaption}>of travellers worldwide</Text>
            </View>
          </>
        )}

        <View style={styles.footer}>
          <Text style={styles.footerText}>logbook.app</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    backgroundColor: "#050B18",
    borderRadius: 24,
    overflow: "hidden",
    position: "relative",
  },
  decorCircle1: {
    position: "absolute",
    width: 300, height: 300, borderRadius: 150,
    backgroundColor: "rgba(79,142,240,0.06)",
    top: -80, right: -80,
  },
  decorCircle2: {
    position: "absolute",
    width: 200, height: 200, borderRadius: 100,
    backgroundColor: "rgba(79,142,240,0.04)",
    bottom: 40, left: -60,
  },
  inner: {
    flex: 1,
    paddingHorizontal: 36, paddingTop: 40, paddingBottom: 32,
    justifyContent: "space-between",
  },
  topSection: { alignItems: "flex-start" },
  logoRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 6 },
  logoText: { fontSize: 11, color: "#4F8EF0", fontFamily: "DMSans_700Bold", letterSpacing: 2.5 },
  tagline: { fontSize: 22, color: "#F0F6FF", fontFamily: "DMSans_700Bold", letterSpacing: -0.3 },
  divider: { height: 1, backgroundColor: "rgba(79,142,240,0.15)" },
  mainSection: { alignItems: "center", paddingVertical: 4 },
  periodLabel: {
    fontSize: 13, color: "rgba(240,246,255,0.45)",
    fontFamily: "DMSans_400Regular", letterSpacing: 1.5,
    textTransform: "uppercase", marginBottom: 4,
  },
  bigNumber: { fontSize: 96, color: "#F0F6FF", fontFamily: "DMSans_700Bold", lineHeight: 104 },
  bigLabel: {
    fontSize: 14, color: "rgba(79,142,240,0.6)",
    fontFamily: "DMSans_500Medium", letterSpacing: 4, marginTop: -4,
  },
  statsSection: { gap: 10 },
  statRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  statText: { fontSize: 15, color: "rgba(240,246,255,0.75)", fontFamily: "DMSans_400Regular" },
  funFactText: {
    fontSize: 13,
    color: "rgba(16,185,129,0.7)",
    fontStyle: "italic",
    fontFamily: "DMSans_400Regular",
  },
  routesSection: { gap: 8 },
  routesTitle: {
    fontSize: 10, color: "rgba(79,142,240,0.6)",
    fontFamily: "DMSans_500Medium", letterSpacing: 2, marginBottom: 2,
  },
  routeRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  routeText: { fontSize: 16, color: "#F0F6FF", fontFamily: "DMSans_700Bold", width: 40 },
  routeTextRight: { fontSize: 16, color: "#F0F6FF", fontFamily: "DMSans_700Bold", width: 40, textAlign: "right" },
  routeDots: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 3 },
  dot: { width: 3, height: 3, borderRadius: 1.5, backgroundColor: "rgba(79,142,240,0.35)" },
  rankSection: { alignItems: "center", gap: 6, paddingVertical: 2 },
  rankBadge: {
    backgroundColor: "rgba(79,142,240,0.15)",
    borderWidth: 1, borderColor: "rgba(79,142,240,0.4)",
    paddingHorizontal: 18, paddingVertical: 7, borderRadius: 20,
  },
  rankBadgeText: { fontSize: 14, color: "#4F8EF0", fontFamily: "DMSans_700Bold", letterSpacing: 2 },
  rankCaption: { fontSize: 11, color: "rgba(240,246,255,0.35)", fontFamily: "DMSans_400Regular", letterSpacing: 0.5 },
  footer: { alignItems: "center", paddingTop: 4 },
  footerText: { fontSize: 11, color: "rgba(240,246,255,0.2)", fontFamily: "DMSans_400Regular", letterSpacing: 1 },
});
