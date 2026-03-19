import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Platform,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Animated, { FadeInDown } from "react-native-reanimated";
import { Colors } from "@/constants/colors";
import { useFlights, Flight } from "@/context/flights";
import GlobeView from "@/components/GlobeView";

function formatHours(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

function formatNumber(n: number): string {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(n);
}

function computeRank(flightCount: number): number {
  if (flightCount === 0) return 0;
  if (flightCount <= 1) return 15;
  if (flightCount <= 3) return 35;
  if (flightCount <= 6) return 55;
  if (flightCount <= 10) return 70;
  if (flightCount <= 15) return 82;
  if (flightCount <= 25) return 91;
  if (flightCount <= 40) return 96;
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
  if (co2Kg < 50) return `${coffeeCups.toLocaleString()} cups of coffee (worth it!)`;
  if (co2Kg < 100) return `${netflixHours.toLocaleString()} hours of Netflix binging`;
  if (co2Kg < 200) return `${beers.toLocaleString()} beers at the pub`;
  return `${pizzas.toLocaleString()} pizza deliveries`;
}

function useFilteredStats(flights: Flight[], period: "all" | number) {
  return useMemo(() => {
    const filtered =
      period === "all"
        ? flights
        : flights.filter((f) => f.date.startsWith(String(period)));
    const count = filtered.length;
    const miles = filtered.reduce((s, f) => s + f.distanceMiles, 0);
    const co2 = filtered.reduce((s, f) => s + f.co2Kg, 0);
    const flightMin = filtered.reduce((s, f) => s + f.durationMinutes, 0);
    const delayMin = filtered.reduce((s, f) => s + f.delayMinutes, 0);
    const rank = computeRank(count);
    return { count, miles, co2, flightMin, delayMin, rank };
  }, [flights, period]);
}

function StatCard({
  label,
  value,
  icon,
  accent,
}: {
  label: string;
  value: string;
  icon: string;
  accent: string;
}) {
  return (
    <View style={styles.statCard}>
      <View style={[styles.statIcon, { backgroundColor: accent + "1A" }]}>
        <Ionicons name={icon as never} size={18} color={accent} />
      </View>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { flights } = useFlights();
  const [period, setPeriod] = useState<"all" | number>(new Date().getFullYear());

  const topPadding = Platform.OS === "web" ? 67 : insets.top;
  const bottomPadding = Platform.OS === "web" ? 34 : 0;

  const years = useMemo(() => {
    const set = new Set<number>();
    flights.forEach((f) => {
      const y = parseInt(f.date.substring(0, 4), 10);
      if (!isNaN(y)) set.add(y);
    });
    return Array.from(set).sort((a, b) => b - a);
  }, [flights]);

  const stats = useFilteredStats(flights, period);
  const recentFlights = useMemo(() => {
    if (period === "all") return flights.slice(0, 3);
    return flights.filter((f) => f.date.startsWith(String(period))).slice(0, 3);
  }, [flights, period]);
  const hasFlights = flights.length > 0;

  function handleAdd() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push("/add-flight");
  }

  function handleShare() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push("/share");
  }

  function handlePeriodChange(p: "all" | number) {
    Haptics.selectionAsync();
    setPeriod(p);
  }

  return (
    <View style={[styles.container, { paddingTop: topPadding }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scroll, { paddingBottom: bottomPadding + 100 }]}
        contentInsetAdjustmentBehavior="automatic"
      >
        {/* Header */}
        <Animated.View entering={FadeInDown.delay(0).springify()} style={styles.header}>
          <View>
            <Text style={styles.greeting}>Flight Log</Text>
            <Text style={styles.title}>Logbook</Text>
          </View>
          <Pressable
            onPress={handleAdd}
            style={({ pressed }) => [
              styles.addBtn,
              { opacity: pressed ? 0.85 : 1, transform: [{ scale: pressed ? 0.95 : 1 }] },
            ]}
          >
            <Ionicons name="add" size={22} color={Colors.white} />
          </Pressable>
        </Animated.View>

        {hasFlights ? (
          <>
            {/* Period filter */}
            <Animated.View entering={FadeInDown.delay(40).springify()} style={styles.periodRow}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.periodContent}
              >
                <Pressable
                  onPress={() => handlePeriodChange("all")}
                  style={[styles.periodPill, period === "all" && styles.periodPillActive]}
                >
                  <Text style={[styles.periodText, period === "all" && styles.periodTextActive]}>
                    All Time
                  </Text>
                </Pressable>
                {years.map((y) => (
                  <Pressable
                    key={y}
                    onPress={() => handlePeriodChange(y)}
                    style={[styles.periodPill, period === y && styles.periodPillActive]}
                  >
                    <Text style={[styles.periodText, period === y && styles.periodTextActive]}>
                      {y}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
            </Animated.View>

            {/* Share banner */}
            <Animated.View entering={FadeInDown.delay(80).springify()}>
              <Pressable
                onPress={handleShare}
                style={({ pressed }) => [styles.shareBanner, { opacity: pressed ? 0.88 : 1 }]}
              >
                <View style={styles.shareBannerLeft}>
                  <View style={styles.shareIconWrap}>
                    <Ionicons name="share-social" size={18} color={Colors.accent} />
                  </View>
                  <View>
                    <Text style={styles.shareBannerTitle}>Share Year Recap</Text>
                    <Text style={styles.shareBannerSub}>Post to Instagram, WhatsApp & more</Text>
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={18} color={Colors.textSec} />
              </Pressable>
            </Animated.View>

            {/* Hero card */}
            <Animated.View entering={FadeInDown.delay(120).springify()} style={styles.heroCard}>
              <View style={styles.heroTopRow}>
                <View>
                  <Text style={styles.heroLabel}>
                    {period === "all" ? "All time flights" : `Flights in ${period}`}
                  </Text>
                  <Text style={styles.heroNum}>{stats.count}</Text>
                </View>
                <View style={styles.heroIconWrap}>
                  <Ionicons name="airplane" size={28} color={Colors.accent} />
                </View>
              </View>
              <View style={styles.heroDivider} />
              <View style={styles.heroBottomRow}>
                <Text style={styles.heroStat}>{formatNumber(stats.miles)} mi</Text>
                <View style={styles.heroDot} />
                <Text style={styles.heroStat}>{stats.co2.toFixed(0)} kg CO\u2082</Text>
                {stats.rank > 0 && (
                  <View style={styles.rankPill}>
                    <Text style={styles.rankPillText}>Top {100 - stats.rank}%</Text>
                  </View>
                )}
              </View>
              {stats.co2 > 0 && (
                <Text style={styles.co2FunFact}>{getCO2FunFact(stats.co2)}</Text>
              )}
            </Animated.View>

            {/* Globe */}
            <Animated.View entering={FadeInDown.delay(160).springify()} style={styles.globeContainer}>
              <Text style={styles.sectionTitle}>Your Flight Network</Text>
              <GlobeView flights={flights} />
            </Animated.View>

            {/* Stats grid */}
            <Animated.View entering={FadeInDown.delay(180).springify()}>
              <Text style={styles.sectionTitle}>Statistics</Text>
              <View style={styles.statsGrid}>
                <StatCard
                  label="Miles Flown"
                  value={formatNumber(stats.miles)}
                  icon="globe-outline"
                  accent={Colors.accent}
                />
                <StatCard
                  label="CO\u2082 Emitted"
                  value={`${formatNumber(stats.co2)}kg`}
                  icon="leaf-outline"
                  accent={Colors.green}
                />
                <StatCard
                  label="Time in Air"
                  value={formatHours(stats.flightMin)}
                  icon="time-outline"
                  accent={Colors.amber}
                />
                <StatCard
                  label="Delay Time"
                  value={stats.delayMin > 0 ? formatHours(stats.delayMin) : "\u2014"}
                  icon="hourglass-outline"
                  accent={Colors.red}
                />
              </View>
            </Animated.View>

            {/* Recent flights */}
            {recentFlights.length > 0 && (
              <Animated.View entering={FadeInDown.delay(240).springify()}>
                <View style={styles.sectionRow}>
                  <Text style={styles.sectionTitle}>Recent</Text>
                  <Pressable onPress={() => router.push("/(tabs)/flights")} hitSlop={10}>
                    <Text style={styles.seeAll}>See all</Text>
                  </Pressable>
                </View>
                {recentFlights.map((f) => (
                  <Pressable
                    key={f.id}
                    onPress={() => router.push({ pathname: "/flight/[id]", params: { id: f.id } })}
                    style={({ pressed }) => [styles.recentCard, { opacity: pressed ? 0.8 : 1 }]}
                  >
                    <View style={styles.recentRoute}>
                      <Text style={styles.recentAirport}>{f.departureAirport}</Text>
                      <Ionicons name="arrow-forward" size={14} color={Colors.textSec} style={{ marginHorizontal: 6 }} />
                      <Text style={styles.recentAirport}>{f.arrivalAirport}</Text>
                    </View>
                    <View style={styles.recentMeta}>
                      <Text style={styles.recentCode}>{f.flightCode} \u00b7 {f.date}</Text>
                      <View style={[styles.statusBadge, { backgroundColor: f.status === "delayed" ? Colors.red + "22" : Colors.green + "22" }]}>
                        <Text style={[styles.statusText, { color: f.status === "delayed" ? Colors.red : Colors.green }]}>
                          {f.status === "delayed" ? "Delayed" : "On Time"}
                        </Text>
                      </View>
                    </View>
                  </Pressable>
                ))}
              </Animated.View>
            )}
          </>
        ) : (
          <Animated.View entering={FadeInDown.delay(100).springify()} style={styles.emptyState}>
            <View style={styles.emptyIcon}>
              <Ionicons name="airplane-outline" size={40} color={Colors.textSec} />
            </View>
            <Text style={styles.emptyTitle}>No flights logged</Text>
            <Text style={styles.emptyText}>
              Tap the + button to add your first flight and start tracking your year in the air.
            </Text>
            <Pressable
              onPress={handleAdd}
              style={({ pressed }) => [styles.emptyBtn, { opacity: pressed ? 0.8 : 1 }]}
            >
              <Text style={styles.emptyBtnText}>Add First Flight</Text>
            </Pressable>
          </Animated.View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  scroll: { paddingHorizontal: 20 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 16,
    paddingBottom: 20,
  },
  greeting: {
    fontSize: 13,
    color: Colors.textSec,
    fontFamily: "DMSans_400Regular",
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
  title: { fontSize: 30, color: Colors.text, fontFamily: "DMSans_700Bold", marginTop: 2 },
  addBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  periodRow: { marginBottom: 16, marginHorizontal: -20 },
  periodContent: { paddingHorizontal: 20, gap: 8, flexDirection: "row" },
  periodPill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  periodPillActive: { backgroundColor: Colors.accent, borderColor: Colors.accent },
  periodText: { fontSize: 13, color: Colors.textSec, fontFamily: "DMSans_500Medium" },
  periodTextActive: { color: Colors.white },

  // Share banner — light card style
  shareBanner: {
    borderRadius: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 14,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  shareBannerLeft: { flexDirection: "row", alignItems: "center", gap: 12 },
  shareIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: Colors.accentDim,
    alignItems: "center",
    justifyContent: "center",
  },
  shareBannerTitle: { fontSize: 15, color: Colors.text, fontFamily: "DMSans_700Bold" },
  shareBannerSub: { fontSize: 12, color: Colors.textSec, fontFamily: "DMSans_400Regular", marginTop: 1 },

  // Hero card — light card style, no dark gradient
  heroCard: {
    backgroundColor: Colors.card,
    borderRadius: 20,
    padding: 20,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  heroTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  heroLabel: {
    fontSize: 13,
    color: Colors.textSec,
    fontFamily: "DMSans_400Regular",
    letterSpacing: 0.2,
    marginBottom: 2,
  },
  heroNum: { fontSize: 52, color: Colors.text, fontFamily: "DMSans_700Bold", lineHeight: 60 },
  heroIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 14,
    backgroundColor: Colors.accentDim,
    alignItems: "center",
    justifyContent: "center",
  },
  heroDivider: { height: 1, backgroundColor: Colors.border, marginVertical: 14 },
  heroBottomRow: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  heroStat: { fontSize: 14, color: Colors.textSec, fontFamily: "DMSans_500Medium" },
  heroDot: { width: 3, height: 3, borderRadius: 2, backgroundColor: Colors.border },
  co2FunFact: {
    fontSize: 11,
    color: Colors.textMuted,
    fontFamily: "DMSans_400Regular",
    marginTop: 6,
    fontStyle: "italic",
  },
  rankPill: {
    backgroundColor: Colors.accentDim,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 10,
  },
  rankPillText: { fontSize: 12, color: Colors.accent, fontFamily: "DMSans_700Bold" },

  sectionTitle: {
    fontSize: 12,
    color: Colors.textSec,
    fontFamily: "DMSans_500Medium",
    letterSpacing: 0.8,
    textTransform: "uppercase",
    marginBottom: 12,
  },
  sectionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
    marginTop: 8,
  },
  seeAll: { fontSize: 13, color: Colors.accent, fontFamily: "DMSans_500Medium" },
  statsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 16 },
  statCard: {
    flex: 1,
    minWidth: "44%",
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  statIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  statValue: { fontSize: 22, color: Colors.text, fontFamily: "DMSans_700Bold" },
  statLabel: { fontSize: 12, color: Colors.textSec, fontFamily: "DMSans_400Regular", marginTop: 2 },
  recentCard: {
    backgroundColor: Colors.card,
    borderRadius: 14,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  recentRoute: { flexDirection: "row", alignItems: "center", marginBottom: 6 },
  recentAirport: { fontSize: 18, color: Colors.text, fontFamily: "DMSans_700Bold" },
  recentMeta: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  recentCode: { fontSize: 12, color: Colors.textSec, fontFamily: "DMSans_400Regular" },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  statusText: { fontSize: 11, fontFamily: "DMSans_500Medium" },
  globeContainer: { marginTop: 4, marginBottom: 20, alignItems: "center" },
  emptyState: { flex: 1, alignItems: "center", paddingTop: 60, paddingHorizontal: 20 },
  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: 24,
    backgroundColor: Colors.card,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  emptyTitle: { fontSize: 22, color: Colors.text, fontFamily: "DMSans_700Bold", marginBottom: 10 },
  emptyText: {
    fontSize: 15,
    color: Colors.textSec,
    fontFamily: "DMSans_400Regular",
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 28,
  },
  emptyBtn: {
    backgroundColor: Colors.accent,
    paddingHorizontal: 28,
    paddingVertical: 16,
    borderRadius: 30,
  },
  emptyBtnText: { fontSize: 15, color: Colors.white, fontFamily: "DMSans_700Bold" },
});
