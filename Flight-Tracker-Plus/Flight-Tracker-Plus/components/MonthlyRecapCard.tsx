import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { Flight } from "@/context/flights";

export const CARD_WIDTH = 375;
export const CARD_HEIGHT = 667;

const MONTH_NAMES = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];

function fmt(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

function fmtHours(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h\u2009${m}m`;
}

function computeRank(n: number): number {
  if (n === 0) return 0;
  if (n <= 1) return 15; if (n <= 3) return 35;
  if (n <= 6) return 55; if (n <= 10) return 70;
  if (n <= 15) return 82; if (n <= 25) return 91;
  if (n <= 40) return 96; return 99;
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

function getTopRoutes(flights: Flight[]): { dep: string; arr: string; count: number }[] {
  const freq: Record<string, number> = {};
  flights.forEach((f) => {
    const key = `${f.departureAirport}\u2192${f.arrivalAirport}`;
    freq[key] = (freq[key] || 0) + 1;
  });
  return Object.entries(freq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([k, count]) => {
      const [dep, arr] = k.split("\u2192");
      return { dep, arr, count };
    });
}

function getUniqueDestinations(flights: Flight[]): number {
  return new Set(flights.map((f) => f.arrivalCity)).size;
}

export interface MonthlyRecapCardProps {
  flights: Flight[];
  month: number; // 0-based
  year: number;
}

export default function MonthlyRecapCard({ flights, month, year }: MonthlyRecapCardProps) {
  const count = flights.length;
  const miles = flights.reduce((s, f) => s + f.distanceMiles, 0);
  const co2 = flights.reduce((s, f) => s + f.co2Kg, 0);
  const flightMin = flights.reduce((s, f) => s + f.durationMinutes, 0);
  const rank = computeRank(count);
  const topRoutes = getTopRoutes(flights);
  const verifiedCount = flights.filter((f) => f.verified).length;
  const destinations = getUniqueDestinations(flights);
  const monthName = MONTH_NAMES[month];
  const funFact = co2 > 0 ? getCO2FunFact(co2) : null;

  return (
    <View style={s.card}>
      <LinearGradient
        colors={["#03081A", "#071535", "#03081A"]}
        locations={[0, 0.5, 1]}
        style={StyleSheet.absoluteFill}
      />

      <View style={s.glow1} />
      <View style={s.glow2} />

      {STARS.map((st, i) => (
        <View key={i} style={[s.star, { top: st.t, left: st.l, width: st.r, height: st.r, borderRadius: st.r / 2, opacity: st.o }]} />
      ))}

      <View style={s.inner}>

        {/* ── Header ── */}
        <View style={s.header}>
          <View style={s.logoRow}>
            <Ionicons name="airplane" size={12} color="#4F8EF0" />
            <Text style={s.logoText}>LOGBOOK</Text>
          </View>
          <Text style={s.monthLabel}>{monthName.toUpperCase()}</Text>
          <Text style={s.yearLabel}>{year}</Text>
        </View>

        {/* ── Big flight count ── */}
        <View style={s.heroBlock}>
          <Text style={s.heroNum}>{count}</Text>
          <Text style={s.heroSub}>{count === 1 ? "FLIGHT" : "FLIGHTS"}</Text>
          {verifiedCount > 0 && (
            <View style={s.verifiedPill}>
              <Ionicons name="checkmark-circle" size={11} color="#4F8EF0" />
              <Text style={s.verifiedText}>{verifiedCount} wallet verified</Text>
            </View>
          )}
        </View>

        {/* ── Stat grid ── */}
        <View style={s.statGrid}>
          <StatBox icon="navigate" color="#4F8EF0" value={fmt(miles)} label="MILES" />
          <View style={s.statDivV} />
          <StatBox icon="time" color="#F59E0B" value={fmtHours(flightMin)} label="IN AIR" />
          <View style={s.statDivV} />
          <StatBox icon="leaf" color="#10B981" value={`${fmt(co2)}kg`} label="CO\u2082" />
          <View style={s.statDivV} />
          <StatBox icon="location" color="#4F8EF0" value={String(destinations)} label={destinations === 1 ? "DEST" : "DESTS"} />
        </View>

        {/* ── CO2 fun fact ── */}
        {funFact && (
          <View style={s.funFactRow}>
            <Ionicons name="leaf-outline" size={11} color="#10B981" />
            <Text style={s.funFactText}>That\u2019s like {funFact}</Text>
          </View>
        )}

        {/* ── Top routes ── */}
        {topRoutes.length > 0 && (
          <View style={s.routesBlock}>
            <Text style={s.sectionLabel}>TOP ROUTES</Text>
            {topRoutes.map((r, i) => (
              <View key={i} style={s.routeRow}>
                <Text style={s.routeIata}>{r.dep}</Text>
                <View style={s.routeLine}>
                  <View style={s.routeDash} />
                  <View style={s.planeWrap}>
                    <Ionicons name="airplane" size={11} color="#4F8EF0" />
                  </View>
                  <View style={s.routeDash} />
                </View>
                <Text style={[s.routeIata, { textAlign: "right" }]}>{r.arr}</Text>
                {r.count > 1 && (
                  <View style={s.countPill}>
                    <Text style={s.countPillText}>x{r.count}</Text>
                  </View>
                )}
              </View>
            ))}
          </View>
        )}

        {/* ── Empty state ── */}
        {count === 0 && (
          <View style={s.emptyBlock}>
            <Ionicons name="airplane-outline" size={32} color="rgba(79,142,240,0.3)" />
            <Text style={s.emptyText}>No flights this month</Text>
          </View>
        )}

        {/* ── Rank ── */}
        {rank > 0 && (
          <View style={s.rankBlock}>
            <View style={s.rankBadge}>
              <Text style={s.rankBadgeText}>TOP {100 - rank}%</Text>
            </View>
            <Text style={s.rankCaption}>of global travellers</Text>
          </View>
        )}

        {/* ── Footer ── */}
        <View style={s.footer}>
          <View style={s.footerLine} />
          <Text style={s.footerText}>logbook.app</Text>
        </View>

      </View>
    </View>
  );
}

function StatBox({ icon, color, value, label }: { icon: string; color: string; value: string; label: string }) {
  return (
    <View style={s.statBox}>
      <View style={[s.statIcon, { backgroundColor: color + "22" }]}>
        <Ionicons name={icon as never} size={14} color={color} />
      </View>
      <Text style={s.statValue}>{value}</Text>
      <Text style={s.statLabel}>{label}</Text>
    </View>
  );
}

const STARS: { t: number; l: number; r: number; o: number }[] = [
  { t: 22, l: 40, r: 2, o: 0.6 }, { t: 55, l: 310, r: 1.5, o: 0.5 },
  { t: 80, l: 170, r: 1, o: 0.4 }, { t: 110, l: 340, r: 2, o: 0.7 },
  { t: 140, l: 15, r: 1.5, o: 0.5 }, { t: 200, l: 290, r: 1, o: 0.4 },
  { t: 240, l: 60, r: 2, o: 0.3 }, { t: 300, l: 350, r: 1.5, o: 0.6 },
  { t: 480, l: 25, r: 1.5, o: 0.4 }, { t: 530, l: 340, r: 2, o: 0.5 },
  { t: 590, l: 180, r: 1, o: 0.3 }, { t: 630, l: 80, r: 2, o: 0.4 },
];

const s = StyleSheet.create({
  card: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    backgroundColor: "#03081A",
    borderRadius: 24,
    overflow: "hidden",
  },
  glow1: {
    position: "absolute", width: 320, height: 320, borderRadius: 160,
    backgroundColor: "rgba(79,142,240,0.08)", top: -80, right: -80,
  },
  glow2: {
    position: "absolute", width: 240, height: 240, borderRadius: 120,
    backgroundColor: "rgba(79,142,240,0.04)", bottom: 60, left: -80,
  },
  star: { position: "absolute", backgroundColor: "#FFFFFF" },
  inner: {
    flex: 1, paddingHorizontal: 32, paddingTop: 36, paddingBottom: 28,
    justifyContent: "space-between",
  },
  header: { alignItems: "flex-start", gap: 2 },
  logoRow: { flexDirection: "row", alignItems: "center", gap: 5, marginBottom: 10 },
  logoText: { fontSize: 10, color: "#4F8EF0", fontFamily: "DMSans_700Bold", letterSpacing: 3 },
  monthLabel: { fontSize: 42, color: "#F0F6FF", fontFamily: "DMSans_700Bold", letterSpacing: -1, lineHeight: 46 },
  yearLabel: { fontSize: 15, color: "rgba(240,246,255,0.35)", fontFamily: "DMSans_400Regular", letterSpacing: 2 },

  heroBlock: { alignItems: "center", paddingVertical: 8 },
  heroNum: { fontSize: 100, color: "#F0F6FF", fontFamily: "DMSans_700Bold", lineHeight: 108, letterSpacing: -4 },
  heroSub: { fontSize: 12, color: "rgba(79,142,240,0.65)", fontFamily: "DMSans_700Bold", letterSpacing: 5, marginTop: -6 },
  verifiedPill: {
    flexDirection: "row", alignItems: "center", gap: 5,
    backgroundColor: "rgba(79,142,240,0.12)",
    borderWidth: 1, borderColor: "rgba(79,142,240,0.25)",
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, marginTop: 8,
  },
  verifiedText: { fontSize: 11, color: "#4F8EF0", fontFamily: "DMSans_500Medium", letterSpacing: 0.3 },

  statGrid: {
    flexDirection: "row",
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: 16,
    borderWidth: 1, borderColor: "rgba(79,142,240,0.12)",
    paddingVertical: 16, paddingHorizontal: 4, alignItems: "center",
  },
  statBox: { flex: 1, alignItems: "center", gap: 4 },
  statDivV: { width: 1, height: 36, backgroundColor: "rgba(79,142,240,0.15)" },
  statIcon: { width: 28, height: 28, borderRadius: 8, alignItems: "center", justifyContent: "center", marginBottom: 2 },
  statValue: { fontSize: 16, color: "#F0F6FF", fontFamily: "DMSans_700Bold", letterSpacing: -0.3 },
  statLabel: { fontSize: 9, color: "rgba(240,246,255,0.4)", fontFamily: "DMSans_500Medium", letterSpacing: 1.5 },

  // CO2 fun fact
  funFactRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  funFactText: {
    fontSize: 11,
    color: "rgba(16,185,129,0.7)",
    fontFamily: "DMSans_400Regular",
    fontStyle: "italic",
    flex: 1,
  },

  routesBlock: { gap: 10 },
  sectionLabel: { fontSize: 9, color: "rgba(79,142,240,0.55)", fontFamily: "DMSans_700Bold", letterSpacing: 2.5, marginBottom: 2 },
  routeRow: { flexDirection: "row", alignItems: "center", gap: 0 },
  routeIata: { fontSize: 18, color: "#F0F6FF", fontFamily: "DMSans_700Bold", width: 44, letterSpacing: -0.5 },
  routeLine: { flex: 1, flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 6 },
  routeDash: { flex: 1, height: 1, backgroundColor: "rgba(79,142,240,0.25)" },
  planeWrap: { width: 22, height: 22, borderRadius: 11, backgroundColor: "rgba(79,142,240,0.15)", alignItems: "center", justifyContent: "center" },
  countPill: { backgroundColor: "rgba(79,142,240,0.15)", paddingHorizontal: 7, paddingVertical: 2, borderRadius: 8, marginLeft: 6 },
  countPillText: { fontSize: 10, color: "#4F8EF0", fontFamily: "DMSans_700Bold" },

  emptyBlock: { alignItems: "center", gap: 8, paddingVertical: 16 },
  emptyText: { fontSize: 13, color: "rgba(240,246,255,0.3)", fontFamily: "DMSans_400Regular" },

  rankBlock: { alignItems: "center", gap: 5 },
  rankBadge: {
    backgroundColor: "rgba(79,142,240,0.12)",
    borderWidth: 1, borderColor: "rgba(79,142,240,0.35)",
    paddingHorizontal: 20, paddingVertical: 7, borderRadius: 20,
  },
  rankBadgeText: { fontSize: 13, color: "#4F8EF0", fontFamily: "DMSans_700Bold", letterSpacing: 2 },
  rankCaption: { fontSize: 10, color: "rgba(240,246,255,0.3)", fontFamily: "DMSans_400Regular", letterSpacing: 0.5 },

  footer: { alignItems: "center", gap: 8 },
  footerLine: { width: 40, height: 1, backgroundColor: "rgba(79,142,240,0.2)" },
  footerText: { fontSize: 10, color: "rgba(240,246,255,0.18)", fontFamily: "DMSans_400Regular", letterSpacing: 1.5 },
});
