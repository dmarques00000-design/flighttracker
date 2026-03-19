import React, { useMemo, useState, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Platform,
  Modal,
  TouchableWithoutFeedback,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Animated, { FadeInDown, FadeIn } from "react-native-reanimated";
import { Colors } from "@/constants/colors";
import { useFlights, Flight } from "@/context/flights";
import GlobeView from "@/components/GlobeView";
import { getCO2FunFact } from "@/utils/co2FunFact";

const TODAY = new Date().toISOString().substring(0, 10);

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

function daysUntil(dateStr: string): number {
  const diff = new Date(dateStr + "T00:00:00").getTime() - new Date(TODAY + "T00:00:00").getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

function formatDateShort(dateStr: string): string {
  return new Date(dateStr + "T00:00:00").toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
  });
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

function useFilteredStats(flights: Flight[], period: "all" | number) {
  return useMemo(() => {
    const filtered = period === "all" ? flights : flights.filter((f) => f.date.startsWith(String(period)));
    const count = filtered.length;
    const miles = filtered.reduce((s, f) => s + f.distanceMiles, 0);
    const co2 = filtered.reduce((s, f) => s + f.co2Kg, 0);
    const flightMin = filtered.reduce((s, f) => s + f.durationMinutes, 0);
    const delayMin = filtered.reduce((s, f) => s + f.delayMinutes, 0);
    const rank = computeRank(count);
    return { count, miles, co2, flightMin, delayMin, rank };
  }, [flights, period]);
}

function StatCard({ label, value, icon, accent }: { label: string; value: string; icon: string; accent: string }) {
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

function FlightRow({ flight, isUpcoming }: { flight: Flight; isUpcoming: boolean }) {
  const days = isUpcoming ? daysUntil(flight.date) : null;
  return (
    <Pressable
      onPress={() => router.push({ pathname: "/flight/[id]", params: { id: flight.id } })}
      style={({ pressed }) => [styles.flightCard, { opacity: pressed ? 0.8 : 1 }]}
    >
      <View style={[styles.flightAccentBar, { backgroundColor: isUpcoming ? Colors.accent : Colors.green }]} />
      <View style={styles.flightCardInner}>
        <View style={styles.flightRouteRow}>
          <Text style={styles.flightAirport}>{flight.departureAirport}</Text>
          <View style={styles.flightArrowWrap}>
            <View style={styles.flightArrowLine} />
            <Ionicons name="airplane" size={12} color={isUpcoming ? Colors.accent : Colors.green} />
            <View style={styles.flightArrowLine} />
          </View>
          <Text style={styles.flightAirport}>{flight.arrivalAirport}</Text>
        </View>
        <View style={styles.flightMetaRow}>
          <Text style={styles.flightMeta}>{flight.flightCode} \u00b7 {formatDateShort(flight.date)}</Text>
          {isUpcoming && days !== null ? (
            <View style={[styles.countdownPill, { backgroundColor: days === 0 ? Colors.accent : days <= 7 ? Colors.amber + "22" : Colors.accentDim }]}>
              <Text style={[styles.countdownText, { color: days === 0 ? Colors.white : days <= 7 ? Colors.amber : Colors.accent }]}>
                {days === 0 ? "Today!" : days === 1 ? "Tomorrow" : `In ${days} days`}
              </Text>
            </View>
          ) : (
            <View style={[styles.countdownPill, { backgroundColor: Colors.green + "18" }]}>
              <Text style={[styles.countdownText, { color: Colors.green }]}>
                {flight.status === "delayed" ? "Delayed" : flight.status === "cancelled" ? "Cancelled" : "Completed"}
              </Text>
            </View>
          )}
        </View>
      </View>
    </Pressable>
  );
}

const MENU_ITEMS = [
  { id: "wallet",        icon: "wallet-outline",         label: "Link Apple Wallet",  sub: "Import boarding passes" },
  { id: "monthly-recap", icon: "calendar-outline",        label: "Monthly Recap",       sub: "Share your month in the air" },
  { id: "share",         icon: "share-social-outline",   label: "Share Year Recap",   sub: "Post to social media" },
  { id: "add",           icon: "add-circle-outline",     label: "Add Flight",         sub: "Log a flight manually" },
];

function HamburgerMenu({ visible, onClose, onSelect }: { visible: boolean; onClose: () => void; onSelect: (id: string) => void }) {
  if (!visible) return null;
  return (
    <Modal transparent animationType="fade" visible={visible} onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.menuOverlay}>
          <TouchableWithoutFeedback>
            <Animated.View entering={FadeIn.duration(150)} style={styles.menuCard}>
              {MENU_ITEMS.map((item, i) => (
                <Pressable
                  key={item.id}
                  onPress={() => { onSelect(item.id); onClose(); }}
                  style={({ pressed }) => [
                    styles.menuItem,
                    i < MENU_ITEMS.length - 1 && styles.menuItemBorder,
                    { backgroundColor: pressed ? Colors.surface : Colors.card },
                  ]}
                >
                  <View style={styles.menuItemIcon}>
                    <Ionicons name={item.icon as never} size={18} color={Colors.accent} />
                  </View>
                  <View style={styles.menuItemText}>
                    <Text style={styles.menuItemLabel}>{item.label}</Text>
                    <Text style={styles.menuItemSub}>{item.sub}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={14} color={Colors.textMuted} />
                </Pressable>
              ))}
            </Animated.View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { flights } = useFlights();
  const [period, setPeriod] = useState<"all" | number>(new Date().getFullYear());
  const [menuOpen, setMenuOpen] = useState(false);

  const topPadding = Platform.OS === "web" ? 67 : insets.top;
  const bottomPadding = Platform.OS === "web" ? 34 : 0;

  const years = useMemo(() => {
    const set = new Set<number>();
    flights.forEach((f) => { const y = parseInt(f.date.substring(0, 4), 10); if (!isNaN(y)) set.add(y); });
    return Array.from(set).sort((a, b) => b - a);
  }, [flights]);

  const upcomingFlights = useMemo(
    () => flights.filter((f) => f.date >= TODAY).sort((a, b) => a.date.localeCompare(b.date)).slice(0, 3),
    [flights]
  );
  const pastFlights = useMemo(
    () => flights.filter((f) => f.date < TODAY).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 3),
    [flights]
  );

  const stats = useFilteredStats(flights, period);
  const hasFlights = flights.length > 0;

  function handleMenuSelect(id: string) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (id === "wallet") router.push("/wallet-import");
    else if (id === "monthly-recap") router.push("/monthly-recap");
    else if (id === "share") router.push("/share");
    else if (id === "add") router.push("/add-flight");
  }

  function handleAdd() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push("/add-flight");
  }

  function handlePeriodChange(p: "all" | number) {
    Haptics.selectionAsync();
    setPeriod(p);
  }

  return (
    <View style={[styles.container, { paddingTop: topPadding }]}>
      <HamburgerMenu
        visible={menuOpen}
        onClose={() => setMenuOpen(false)}
        onSelect={handleMenuSelect}
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scroll, { paddingBottom: bottomPadding + 100 }]}
        contentInsetAdjustmentBehavior="automatic"
      >
        <Animated.View entering={FadeInDown.delay(0).springify()} style={styles.header}>
          <View>
            <Text style={styles.greeting}>Flight Log</Text>
            <Text style={styles.title}>Logbook</Text>
          </View>
          <View style={styles.headerRight}>
            <Pressable
              onPress={handleAdd}
              style={({ pressed }) => [styles.addBtn, { opacity: pressed ? 0.85 : 1, transform: [{ scale: pressed ? 0.95 : 1 }] }]}
            >
              <Ionicons name="add" size={22} color={Colors.white} />
            </Pressable>
            <Pressable
              onPress={() => { Haptics.selectionAsync(); setMenuOpen(true); }}
              style={({ pressed }) => [styles.menuBtn, { opacity: pressed ? 0.7 : 1 }]}
              hitSlop={8}
            >
              <View style={styles.burgerLine} />
              <View style={[styles.burgerLine, { width: 14 }]} />
              <View style={[styles.burgerLine, { width: 10 }]} />
            </Pressable>
          </View>
        </Animated.View>

        {hasFlights ? (
          <>
            <Animated.View entering={FadeInDown.delay(40).springify()} style={styles.periodRow}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.periodContent}>
                <Pressable onPress={() => handlePeriodChange("all")} style={[styles.periodPill, period === "all" && styles.periodPillActive]}>
                  <Text style={[styles.periodText, period === "all" && styles.periodTextActive]}>All Time</Text>
                </Pressable>
                {years.map((y) => (
                  <Pressable key={y} onPress={() => handlePeriodChange(y)} style={[styles.periodPill, period === y && styles.periodPillActive]}>
                    <Text style={[styles.periodText, period === y && styles.periodTextActive]}>{y}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            </Animated.View>

            <Animated.View entering={FadeInDown.delay(80).springify()} style={styles.heroCard}>
              <View style={styles.heroTopRow}>
                <View>
                  <Text style={styles.heroLabel}>{period === "all" ? "All time flights" : `Flights in ${period}`}</Text>
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
                  <View style={styles.rankPill}><Text style={styles.rankPillText}>Top {100 - stats.rank}%</Text></View>
                )}
              </View>
              {stats.co2 > 0 && (
                <Text style={styles.co2FunFact}>\u{1F343} That\u2019s like {getCO2FunFact(stats.co2)}</Text>
              )}
            </Animated.View>

            <Animated.View entering={FadeInDown.delay(120).springify()} style={styles.globeContainer}>
              <Text style={styles.sectionTitle}>Your Flight Network</Text>
              <GlobeView flights={flights} />
            </Animated.View>

            <Animated.View entering={FadeInDown.delay(140).springify()}>
              <Text style={styles.sectionTitle}>Statistics</Text>
              <View style={styles.statsGrid}>
                <StatCard label="Miles Flown" value={formatNumber(stats.miles)} icon="globe-outline" accent={Colors.accent} />
                <StatCard label="CO\u2082 Emitted" value={`${formatNumber(stats.co2)}kg`} icon="leaf-outline" accent={Colors.green} />
                <StatCard label="Time in Air" value={formatHours(stats.flightMin)} icon="time-outline" accent={Colors.amber} />
                <StatCard label="Delay Time" value={stats.delayMin > 0 ? formatHours(stats.delayMin) : "\u2014"} icon="hourglass-outline" accent={Colors.red} />
              </View>
            </Animated.View>

            {upcomingFlights.length > 0 && (
              <Animated.View entering={FadeInDown.delay(180).springify()} style={styles.section}>
                <View style={styles.sectionRow}>
                  <View style={styles.sectionTitleRow}>
                    <View style={[styles.sectionDot, { backgroundColor: Colors.accent }]} />
                    <Text style={styles.sectionTitle}>Upcoming</Text>
                  </View>
                  <Pressable onPress={() => { Haptics.selectionAsync(); router.push({ pathname: "/(tabs)/flights", params: { filter: "upcoming" } }); }} hitSlop={10}>
                    <Text style={styles.seeAll}>See all</Text>
                  </Pressable>
                </View>
                {upcomingFlights.map((f) => <FlightRow key={f.id} flight={f} isUpcoming={true} />)}
              </Animated.View>
            )}

            {pastFlights.length > 0 && (
              <Animated.View entering={FadeInDown.delay(210).springify()} style={styles.section}>
                <View style={styles.sectionRow}>
                  <View style={styles.sectionTitleRow}>
                    <View style={[styles.sectionDot, { backgroundColor: Colors.green }]} />
                    <Text style={styles.sectionTitle}>Past Flights</Text>
                  </View>
                  <Pressable onPress={() => { Haptics.selectionAsync(); router.push({ pathname: "/(tabs)/flights", params: { filter: "past" } }); }} hitSlop={10}>
                    <Text style={styles.seeAll}>See all</Text>
                  </Pressable>
                </View>
                {pastFlights.map((f) => <FlightRow key={f.id} flight={f} isUpcoming={false} />)}
              </Animated.View>
            )}
          </>
        ) : (
          <Animated.View entering={FadeInDown.delay(100).springify()} style={styles.emptyState}>
            <View style={styles.emptyIcon}>
              <Ionicons name="airplane-outline" size={40} color={Colors.textSec} />
            </View>
            <Text style={styles.emptyTitle}>No flights logged</Text>
            <Text style={styles.emptyText}>Tap the + button to add your first flight and start tracking your year in the air.</Text>
            <Pressable onPress={handleAdd} style={({ pressed }) => [styles.emptyBtn, { opacity: pressed ? 0.8 : 1 }]}>
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
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingTop: 16, paddingBottom: 20 },
  greeting: { fontSize: 13, color: Colors.textSec, fontFamily: "DMSans_400Regular", letterSpacing: 0.6, textTransform: "uppercase" },
  title: { fontSize: 30, color: Colors.text, fontFamily: "DMSans_700Bold", marginTop: 2 },
  headerRight: { flexDirection: "row", alignItems: "center", gap: 10 },
  addBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.accent, alignItems: "center", justifyContent: "center" },
  menuBtn: { width: 36, height: 36, alignItems: "center", justifyContent: "center", gap: 4 },
  burgerLine: { width: 18, height: 2, borderRadius: 1, backgroundColor: Colors.text },

  menuOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.18)" },
  menuCard: {
    position: "absolute", top: 90, right: 20,
    width: 260,
    backgroundColor: Colors.card,
    borderRadius: 16,
    borderWidth: 1, borderColor: Colors.border,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 10,
  },
  menuItem: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 14, gap: 12 },
  menuItemBorder: { borderBottomWidth: 1, borderBottomColor: Colors.border },
  menuItemIcon: { width: 34, height: 34, borderRadius: 10, backgroundColor: Colors.accentDim, alignItems: "center", justifyContent: "center" },
  menuItemText: { flex: 1 },
  menuItemLabel: { fontSize: 14, color: Colors.text, fontFamily: "DMSans_700Bold" },
  menuItemSub: { fontSize: 11, color: Colors.textSec, fontFamily: "DMSans_400Regular", marginTop: 1 },

  periodRow: { marginBottom: 16, marginHorizontal: -20 },
  periodContent: { paddingHorizontal: 20, gap: 8, flexDirection: "row" },
  periodPill: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border },
  periodPillActive: { backgroundColor: Colors.accent, borderColor: Colors.accent },
  periodText: { fontSize: 13, color: Colors.textSec, fontFamily: "DMSans_500Medium" },
  periodTextActive: { color: Colors.white },

  heroCard: { backgroundColor: Colors.card, borderRadius: 20, padding: 20, marginBottom: 24, borderWidth: 1, borderColor: Colors.border },
  heroTopRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  heroLabel: { fontSize: 13, color: Colors.textSec, fontFamily: "DMSans_400Regular", letterSpacing: 0.2, marginBottom: 2 },
  heroNum: { fontSize: 52, color: Colors.text, fontFamily: "DMSans_700Bold", lineHeight: 60 },
  heroIconWrap: { width: 52, height: 52, borderRadius: 14, backgroundColor: Colors.accentDim, alignItems: "center", justifyContent: "center" },
  heroDivider: { height: 1, backgroundColor: Colors.border, marginVertical: 14 },
  heroBottomRow: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  heroStat: { fontSize: 14, color: Colors.textSec, fontFamily: "DMSans_500Medium" },
  heroDot: { width: 3, height: 3, borderRadius: 2, backgroundColor: Colors.border },
  co2FunFact: { fontSize: 11, color: Colors.textMuted, fontFamily: "DMSans_400Regular", marginTop: 6, fontStyle: "italic" },
  rankPill: { backgroundColor: Colors.accentDim, paddingHorizontal: 10, paddingVertical: 3, borderRadius: 10 },
  rankPillText: { fontSize: 12, color: Colors.accent, fontFamily: "DMSans_700Bold" },

  sectionTitle: { fontSize: 12, color: Colors.textSec, fontFamily: "DMSans_500Medium", letterSpacing: 0.8, textTransform: "uppercase" },
  sectionRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  sectionTitleRow: { flexDirection: "row", alignItems: "center", gap: 7 },
  sectionDot: { width: 6, height: 6, borderRadius: 3 },
  section: { marginBottom: 8 },
  seeAll: { fontSize: 13, color: Colors.accent, fontFamily: "DMSans_500Medium" },

  statsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 24 },
  statCard: { flex: 1, minWidth: "44%", backgroundColor: Colors.card, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: Colors.border },
  statIcon: { width: 32, height: 32, borderRadius: 10, alignItems: "center", justifyContent: "center", marginBottom: 10 },
  statValue: { fontSize: 22, color: Colors.text, fontFamily: "DMSans_700Bold" },
  statLabel: { fontSize: 12, color: Colors.textSec, fontFamily: "DMSans_400Regular", marginTop: 2 },

  flightCard: { flexDirection: "row", backgroundColor: Colors.card, borderRadius: 14, marginBottom: 8, borderWidth: 1, borderColor: Colors.border, overflow: "hidden" },
  flightAccentBar: { width: 3 },
  flightCardInner: { flex: 1, paddingHorizontal: 14, paddingVertical: 13 },
  flightRouteRow: { flexDirection: "row", alignItems: "center", marginBottom: 7 },
  flightAirport: { fontSize: 18, color: Colors.text, fontFamily: "DMSans_700Bold" },
  flightArrowWrap: { flex: 1, flexDirection: "row", alignItems: "center", marginHorizontal: 8, gap: 3 },
  flightArrowLine: { flex: 1, height: 1, backgroundColor: Colors.border },
  flightMetaRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  flightMeta: { fontSize: 12, color: Colors.textSec, fontFamily: "DMSans_400Regular" },
  countdownPill: { paddingHorizontal: 9, paddingVertical: 3, borderRadius: 8 },
  countdownText: { fontSize: 11, fontFamily: "DMSans_700Bold" },

  globeContainer: { marginTop: 4, marginBottom: 24, alignItems: "center" },
  emptyState: { flex: 1, alignItems: "center", paddingTop: 60, paddingHorizontal: 20 },
  emptyIcon: { width: 80, height: 80, borderRadius: 24, backgroundColor: Colors.card, alignItems: "center", justifyContent: "center", marginBottom: 20, borderWidth: 1, borderColor: Colors.border },
  emptyTitle: { fontSize: 22, color: Colors.text, fontFamily: "DMSans_700Bold", marginBottom: 10 },
  emptyText: { fontSize: 15, color: Colors.textSec, fontFamily: "DMSans_400Regular", textAlign: "center", lineHeight: 22, marginBottom: 28 },
  emptyBtn: { backgroundColor: Colors.accent, paddingHorizontal: 28, paddingVertical: 16, borderRadius: 30 },
  emptyBtnText: { fontSize: 15, color: Colors.white, fontFamily: "DMSans_700Bold" },
});
