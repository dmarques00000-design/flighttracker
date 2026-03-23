import React, { useMemo, useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  SectionList,
  Pressable,
  Platform,
  ScrollView,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Animated, { FadeInDown, FadeIn } from "react-native-reanimated";
import { Colors } from "@/constants/colors";
import { useFlights, Flight } from "@/context/flights";

const TODAY = new Date().toISOString().substring(0, 10);

const MONTHS = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];

type GroupBy = "month" | "year" | "all";
type TimeFilter = "all" | "upcoming" | "past" | number;

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function daysUntil(dateStr: string): number {
  const diff = new Date(dateStr + "T00:00:00").getTime() - new Date(TODAY + "T00:00:00").getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

function groupFlights(
  flights: Flight[],
  groupBy: GroupBy,
  timeFilter: TimeFilter
): { title: string; data: Flight[] }[] {
  let filtered: Flight[];
  if (timeFilter === "upcoming") {
    filtered = flights.filter((f) => f.date >= TODAY).sort((a, b) => a.date.localeCompare(b.date));
  } else if (timeFilter === "past") {
    filtered = flights.filter((f) => f.date < TODAY).sort((a, b) => b.date.localeCompare(a.date));
  } else if (timeFilter === "all") {
    filtered = [...flights];
  } else {
    filtered = flights.filter((f) => f.date.startsWith(String(timeFilter)));
  }

  if (groupBy === "all") {
    return filtered.length > 0 ? [{ title: "All Flights", data: filtered }] : [];
  }

  if (groupBy === "year") {
    const map = new Map<number, Flight[]>();
    filtered.forEach((f) => {
      const y = parseInt(f.date.substring(0, 4), 10);
      if (!map.has(y)) map.set(y, []);
      map.get(y)!.push(f);
    });
    return Array.from(map.entries())
      .sort((a, b) => b[0] - a[0])
      .map(([year, data]) => ({ title: String(year), data }));
  }

  const map = new Map<string, Flight[]>();
  filtered.forEach((f) => {
    const y = parseInt(f.date.substring(0, 4), 10);
    const m = parseInt(f.date.substring(5, 7), 10) - 1;
    const key = `${y}-${String(m + 1).padStart(2, "0")}`;
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(f);
  });
  return Array.from(map.entries())
    .sort((a, b) => (timeFilter === "upcoming" ? a[0].localeCompare(b[0]) : b[0].localeCompare(a[0])))
    .map(([key, data]) => {
      const y = parseInt(key.substring(0, 4), 10);
      const m = parseInt(key.substring(5), 10) - 1;
      return { title: `${MONTHS[m]} ${y}`, data };
    });
}

function FlightItem({ flight, onDelete, index }: { flight: Flight; onDelete: () => void; index: number }) {
  const [confirming, setConfirming] = useState(false);
  const isUpcoming = flight.date >= TODAY;
  const accentColor = isUpcoming ? Colors.accent : flight.status === "delayed" ? Colors.red : Colors.green;

  let pillBg: string;
  let pillText: string;
  let pillColor: string;
  if (isUpcoming) {
    const days = daysUntil(flight.date);
    pillBg    = days === 0 ? Colors.accent : days <= 7 ? Colors.amber + "22" : Colors.accentDim ?? Colors.accent + "18";
    pillColor = days === 0 ? Colors.white  : days <= 7 ? Colors.amber       : Colors.accent;
    pillText  = days === 0 ? "Today!" : days === 1 ? "Tomorrow" : `In ${days} days`;
  } else {
    pillBg    = flight.status === "delayed" ? Colors.red + "18" : Colors.green + "18";
    pillColor = flight.status === "delayed" ? Colors.red        : Colors.green;
    pillText  = flight.status === "delayed" ? "Delayed" : flight.status === "cancelled" ? "Cancelled" : "Completed";
  }

  return (
    <Pressable onPress={() => { if (confirming) { setConfirming(false); return; } router.push({ pathname: "/flight/[id]", params: { id: flight.id } }); }}>
      <Animated.View entering={FadeInDown.delay(index * 30).springify()} style={styles.card}>
        {/* Left accent bar */}
        <View style={[styles.accentBar, { backgroundColor: accentColor }]} />

        <View style={styles.cardInner}>
          <View style={styles.cardMain}>
            <View style={styles.routeCol}>
              <View style={styles.routeRow}>
                <Text style={styles.airport}>{flight.departureAirport}</Text>
                <View style={styles.arrowWrap}>
                  <View style={styles.arrowLine} />
                  <Ionicons name="airplane" size={11} color={accentColor} />
                  <View style={styles.arrowLine} />
                </View>
                <Text style={styles.airport}>{flight.arrivalAirport}</Text>
                {flight.verified && (
                  <View style={styles.verifiedBadge}>
                    <Ionicons name="checkmark-circle" size={13} color={Colors.accent} />
                  </View>
                )}
              </View>
              {/* Split into JSX children so the middle-dot renders correctly on all platforms */}
              <Text style={styles.meta}>
                {flight.flightCode}
                {"  \u00b7  "}
                {formatDate(flight.date)}
              </Text>
            </View>
            <View style={styles.rightCol}>
              <View style={[styles.pill, { backgroundColor: pillBg }]}>
                <Text style={[styles.pillText, { color: pillColor }]}>{pillText}</Text>
              </View>
              {!confirming && (
                <Pressable onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); setConfirming(true); }} hitSlop={14} style={styles.trashBtn}>
                  <Ionicons name="trash-outline" size={16} color={Colors.textSec} />
                </Pressable>
              )}
            </View>
          </View>

          {confirming && (
            <Animated.View entering={FadeIn.duration(150)} style={styles.confirmRow}>
              <Pressable onPress={() => setConfirming(false)} style={styles.cancelBtn}>
                <Text style={styles.cancelText}>Cancel</Text>
              </Pressable>
              <Pressable onPress={() => { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning); setConfirming(false); onDelete(); }} style={styles.deleteBtn}>
                <Ionicons name="trash" size={14} color={Colors.white} />
                <Text style={styles.deleteText}>Remove</Text>
              </Pressable>
            </Animated.View>
          )}
        </View>
      </Animated.View>
    </Pressable>
  );
}

export default function FlightsScreen() {
  const insets = useSafeAreaInsets();
  const { flights, removeFlight } = useFlights();
  const params = useLocalSearchParams<{ filter?: string }>();
  const topPadding = Platform.OS === "web" ? 67 : insets.top;
  const bottomPadding = Platform.OS === "web" ? 34 : 0;

  const [groupBy, setGroupBy] = useState<GroupBy>("month");
  const [timeFilter, setTimeFilter] = useState<TimeFilter>(new Date().getFullYear());

  useEffect(() => {
    if (params.filter === "upcoming") setTimeFilter("upcoming");
    else if (params.filter === "past") setTimeFilter("past");
  }, [params.filter]);

  const years = useMemo(() => {
    const set = new Set<number>();
    flights.forEach((f) => {
      const y = parseInt(f.date.substring(0, 4), 10);
      if (!isNaN(y)) set.add(y);
    });
    return Array.from(set).sort((a, b) => b - a);
  }, [flights]);

  const hasUpcoming = useMemo(() => flights.some((f) => f.date >= TODAY), [flights]);
  const hasPast = useMemo(() => flights.some((f) => f.date < TODAY), [flights]);

  const sections = useMemo(
    () => groupFlights(flights, groupBy, timeFilter),
    [flights, groupBy, timeFilter]
  );

  const totalShown = sections.reduce((s, sec) => s + sec.data.length, 0);

  function handleAdd() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push("/add-flight");
  }

  // Plain text labels only — no raw unicode escapes in string values
  const TIME_FILTERS: { key: TimeFilter; label: string; show: boolean }[] = [
    { key: "upcoming", label: "Upcoming", show: hasUpcoming },
    { key: "past",     label: "Past",     show: hasPast },
    { key: "all",      label: "All Time", show: true },
    ...years.map((y) => ({ key: y as TimeFilter, label: String(y), show: true })),
  ];

  const GROUP_OPTIONS: { key: GroupBy; label: string }[] = [
    { key: "month", label: "By Month" },
    { key: "year",  label: "By Year" },
    { key: "all",   label: "All" },
  ];

  return (
    <View style={[styles.container, { paddingTop: topPadding }]}>
      <SectionList
        sections={sections}
        keyExtractor={(f) => f.id}
        showsVerticalScrollIndicator={false}
        contentInsetAdjustmentBehavior="automatic"
        stickySectionHeadersEnabled={false}
        contentContainerStyle={[styles.list, { paddingBottom: bottomPadding + 100 }]}
        ListHeaderComponent={() => (
          <View style={styles.header}>
            <View style={styles.headerTop}>
              <Text style={styles.title}>All Flights</Text>
              <Text style={styles.count}>{totalShown} flight{totalShown !== 1 ? "s" : ""}</Text>
            </View>

            {/* Time filter chips */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.filterRow}
              style={{ marginBottom: 12, marginHorizontal: -20 }}
            >
              <View style={{ paddingLeft: 20 }} />
              {TIME_FILTERS.filter((f) => f.show).map((opt) => (
                <Pressable
                  key={String(opt.key)}
                  onPress={() => { Haptics.selectionAsync(); setTimeFilter(opt.key); }}
                  style={[styles.filterPill, timeFilter === opt.key && styles.filterPillActive]}
                >
                  <Text style={[styles.filterText, timeFilter === opt.key && styles.filterTextActive]}>{opt.label}</Text>
                </Pressable>
              ))}
              <View style={{ paddingRight: 20 }} />
            </ScrollView>

            {/* Group by toggle */}
            <View style={styles.groupRow}>
              {GROUP_OPTIONS.map((opt) => (
                <Pressable
                  key={opt.key}
                  onPress={() => { Haptics.selectionAsync(); setGroupBy(opt.key); }}
                  style={[styles.groupBtn, groupBy === opt.key && styles.groupBtnActive]}
                >
                  <Text style={[styles.groupText, groupBy === opt.key && styles.groupTextActive]}>{opt.label}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        )}
        renderSectionHeader={({ section }) =>
          groupBy !== "all" ? (
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionHeaderText}>{section.title}</Text>
              <Text style={styles.sectionCount}>{section.data.length} flight{section.data.length !== 1 ? "s" : ""}</Text>
            </View>
          ) : null
        }
        ListEmptyComponent={() => (
          <Animated.View entering={FadeInDown.springify()} style={styles.empty}>
            <View style={styles.emptyIcon}>
              <Ionicons name="airplane-outline" size={36} color={Colors.textSec} />
            </View>
            <Text style={styles.emptyTitle}>
              {timeFilter === "upcoming" ? "No upcoming flights" : timeFilter === "past" ? "No past flights" : "No flights yet"}
            </Text>
            <Text style={styles.emptySub}>
              {timeFilter === "upcoming"
                ? "Add a future flight to see it here."
                : timeFilter === "past"
                ? "Flights with past dates will appear here."
                : "Add your first flight to start building your logbook."}
            </Text>
            {timeFilter !== "upcoming" && timeFilter !== "past" && (
              <Pressable onPress={handleAdd} style={({ pressed }) => [styles.emptyBtn, { opacity: pressed ? 0.8 : 1 }]}>
                <Text style={styles.emptyBtnText}>Add Flight</Text>
              </Pressable>
            )}
          </Animated.View>
        )}
        renderItem={({ item, index }) => (
          <FlightItem flight={item} index={index} onDelete={() => removeFlight(item.id)} />
        )}
      />
      <Pressable
        onPress={handleAdd}
        style={({ pressed }) => [
          styles.fab,
          { bottom: (Platform.OS === "web" ? 34 : insets.bottom) + 80, opacity: pressed ? 0.85 : 1, transform: [{ scale: pressed ? 0.95 : 1 }] },
        ]}
      >
        <Ionicons name="add" size={26} color={Colors.white} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  list: { paddingHorizontal: 20, paddingTop: 4 },
  header: { paddingTop: 16, paddingBottom: 8 },
  headerTop: { marginBottom: 16 },
  title: { fontSize: 30, color: Colors.text, fontFamily: "DMSans_700Bold" },
  count: { fontSize: 14, color: Colors.textSec, fontFamily: "DMSans_400Regular", marginTop: 2 },
  filterRow: { gap: 8, flexDirection: "row", paddingVertical: 2 },
  filterPill: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border },
  filterPillActive: { backgroundColor: Colors.accent, borderColor: Colors.accent },
  filterText: { fontSize: 13, color: Colors.textSec, fontFamily: "DMSans_500Medium" },
  filterTextActive: { color: Colors.white },
  groupRow: { flexDirection: "row", backgroundColor: Colors.card, borderRadius: 12, borderWidth: 1, borderColor: Colors.border, padding: 3, marginBottom: 14 },
  groupBtn: { flex: 1, paddingVertical: 8, alignItems: "center", borderRadius: 10 },
  groupBtnActive: { backgroundColor: Colors.accent },
  groupText: { fontSize: 13, color: Colors.textSec, fontFamily: "DMSans_500Medium" },
  groupTextActive: { color: Colors.white, fontFamily: "DMSans_700Bold" },
  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingTop: 16, paddingBottom: 8 },
  sectionHeaderText: { fontSize: 15, color: Colors.text, fontFamily: "DMSans_700Bold" },
  sectionCount: { fontSize: 12, color: Colors.textSec, fontFamily: "DMSans_400Regular" },

  card: {
    flexDirection: "row",
    backgroundColor: Colors.card,
    borderRadius: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: "hidden",
  },
  accentBar: { width: 3 },
  cardInner: { flex: 1, paddingHorizontal: 14, paddingVertical: 13 },
  cardMain: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },

  routeCol: { flex: 1, gap: 5 },
  routeRow: { flexDirection: "row", alignItems: "center" },
  arrowWrap: { flex: 0, flexDirection: "row", alignItems: "center", marginHorizontal: 8, gap: 3, maxWidth: 48 },
  arrowLine: { flex: 1, height: 1, backgroundColor: Colors.border },
  airport: { fontSize: 18, color: Colors.text, fontFamily: "DMSans_700Bold" },
  verifiedBadge: { marginLeft: 6, justifyContent: "center" },
  meta: { fontSize: 12, color: Colors.textSec, fontFamily: "DMSans_400Regular" },

  rightCol: { flexDirection: "row", alignItems: "center", gap: 10, marginLeft: 8 },
  pill: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: 8 },
  pillText: { fontSize: 11, fontFamily: "DMSans_700Bold" },
  trashBtn: { padding: 4 },

  confirmRow: { flexDirection: "row", gap: 8, marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: Colors.border },
  cancelBtn: { flex: 1, paddingVertical: 8, borderRadius: 8, backgroundColor: Colors.surface ?? Colors.card, alignItems: "center" },
  cancelText: { fontSize: 13, color: Colors.textSec, fontFamily: "DMSans_500Medium" },
  deleteBtn: { flex: 1, paddingVertical: 8, borderRadius: 8, backgroundColor: Colors.red, alignItems: "center", flexDirection: "row", justifyContent: "center", gap: 5 },
  deleteText: { fontSize: 13, color: Colors.white, fontFamily: "DMSans_700Bold" },

  fab: { position: "absolute", right: 20, width: 52, height: 52, borderRadius: 26, backgroundColor: Colors.accent, alignItems: "center", justifyContent: "center", shadowColor: Colors.accent, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 12, elevation: 6 },

  empty: { paddingTop: 60, alignItems: "center", paddingHorizontal: 20 },
  emptyIcon: { width: 72, height: 72, borderRadius: 20, backgroundColor: Colors.card, alignItems: "center", justifyContent: "center", marginBottom: 16, borderWidth: 1, borderColor: Colors.border },
  emptyTitle: { fontSize: 20, color: Colors.text, fontFamily: "DMSans_700Bold", marginBottom: 8 },
  emptySub: { fontSize: 14, color: Colors.textSec, fontFamily: "DMSans_400Regular", textAlign: "center", lineHeight: 20, marginBottom: 24 },
  emptyBtn: { backgroundColor: Colors.accent, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12 },
  emptyBtnText: { fontSize: 15, color: Colors.white, fontFamily: "DMSans_700Bold" },
});
