import React, { useMemo, useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  SectionList,
  Pressable,
  Platform,
  Modal,
  TouchableWithoutFeedback,
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
    filtered = [...flights].sort((a, b) => b.date.localeCompare(a.date));
  } else {
    filtered = flights.filter((f) => f.date.startsWith(String(timeFilter))).sort((a, b) => b.date.localeCompare(a.date));
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

// ─── Dropdown pill (identical pattern to home screen) ──────────────────────────
interface DropdownOption { key: TimeFilter; label: string; }

function PeriodDropdown({
  value,
  options,
  onChange,
}: {
  value: TimeFilter;
  options: DropdownOption[];
  onChange: (v: TimeFilter) => void;
}) {
  const [open, setOpen] = useState(false);
  const current = options.find((o) => o.key === value);
  const label = current?.label ?? "Filter";

  return (
    <>
      <Pressable
        onPress={() => { Haptics.selectionAsync(); setOpen(true); }}
        style={({ pressed }) => [styles.dropdownTrigger, { opacity: pressed ? 0.8 : 1 }]}
      >
        <Ionicons name="calendar-outline" size={14} color={Colors.accent} />
        <Text style={styles.dropdownLabel}>{label}</Text>
        <Ionicons name="chevron-down" size={14} color={Colors.accent} />
      </Pressable>

      <Modal transparent animationType="fade" visible={open} onRequestClose={() => setOpen(false)}>
        <TouchableWithoutFeedback onPress={() => setOpen(false)}>
          <View style={styles.dropdownOverlay}>
            <TouchableWithoutFeedback>
              <Animated.View entering={FadeIn.duration(120)} style={styles.dropdownSheet}>
                <Text style={styles.dropdownSheetTitle}>Filter by period</Text>
                {options.map((opt, i) => {
                  const isActive = opt.key === value;
                  return (
                    <Pressable
                      key={String(opt.key)}
                      onPress={() => {
                        Haptics.selectionAsync();
                        onChange(opt.key);
                        setOpen(false);
                      }}
                      style={({ pressed }) => [
                        styles.dropdownOption,
                        i < options.length - 1 && styles.dropdownOptionBorder,
                        isActive && styles.dropdownOptionActive,
                        { opacity: pressed ? 0.8 : 1 },
                      ]}
                    >
                      <Text style={[styles.dropdownOptionText, isActive && styles.dropdownOptionTextActive]}>
                        {opt.label}
                      </Text>
                      {isActive && <Ionicons name="checkmark" size={16} color={Colors.accent} />}
                    </Pressable>
                  );
                })}
              </Animated.View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </>
  );
}

// ─── Flight card ───────────────────────────────────────────────────────────────
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
              <View style={styles.metaRow}>
                <Text style={styles.meta}>
                  {flight.flightCode}
                  {"  \u00b7  "}
                  {formatDate(flight.date)}
                </Text>
                {flight.isMock && (
                  <View style={styles.mockBadge}>
                    <Ionicons name="sparkles-outline" size={9} color={Colors.amber} />
                    <Text style={styles.mockBadgeText}>Estimated</Text>
                  </View>
                )}
              </View>
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

// ─── Screen ────────────────────────────────────────────────────────────────────
export default function FlightsScreen() {
  const insets = useSafeAreaInsets();
  const { flights, removeFlight } = useFlights();
  const params = useLocalSearchParams<{ filter?: string }>();
  const topPadding    = Platform.OS === "web" ? 67 : insets.top;
  const bottomPadding = Platform.OS === "web" ? 34 : 0;

  const [groupBy, setGroupBy]       = useState<GroupBy>("month");
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
  const hasPast     = useMemo(() => flights.some((f) => f.date < TODAY),  [flights]);

  const dropdownOptions: DropdownOption[] = useMemo(() => [
    ...(hasUpcoming ? [{ key: "upcoming" as TimeFilter, label: "Upcoming" }] : []),
    ...(hasPast     ? [{ key: "past"     as TimeFilter, label: "Past" }]     : []),
    { key: "all" as TimeFilter, label: "All Time" },
    ...years.map((y) => ({ key: y as TimeFilter, label: String(y) })),
  ], [hasUpcoming, hasPast, years]);

  const sections = useMemo(
    () => groupFlights(flights, groupBy, timeFilter),
    [flights, groupBy, timeFilter]
  );

  const totalShown = sections.reduce((s, sec) => s + sec.data.length, 0);

  const GROUP_OPTIONS: { key: GroupBy; label: string }[] = [
    { key: "month", label: "By Month" },
    { key: "year",  label: "By Year" },
    { key: "all",   label: "All" },
  ];

  function handleAdd() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push("/add-flight");
  }

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

            {/* ── Dropdown pill ── */}
            <View style={styles.controlRow}>
              <PeriodDropdown
                value={timeFilter}
                options={dropdownOptions}
                onChange={(v) => setTimeFilter(v)}
              />
            </View>

            {/* ── Group-by toggle ── */}
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
  container:  { flex: 1, backgroundColor: Colors.bg },
  list:       { paddingHorizontal: 20, paddingTop: 4 },
  header:     { paddingTop: 16, paddingBottom: 8 },
  headerTop:  { marginBottom: 16 },
  title:      { fontSize: 30, color: Colors.text, fontFamily: "DMSans_700Bold" },
  count:      { fontSize: 14, color: Colors.textSec, fontFamily: "DMSans_400Regular", marginTop: 2 },

  // ── Dropdown pill (mirrors home screen) ──
  controlRow: { marginBottom: 12 },
  dropdownTrigger: {
    flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start",
    backgroundColor: Colors.card, borderRadius: 20,
    borderWidth: 1, borderColor: Colors.accent + "55",
    paddingHorizontal: 14, paddingVertical: 9,
  },
  dropdownLabel:  { fontSize: 13, color: Colors.accent, fontFamily: "DMSans_700Bold" },
  dropdownOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.22)", justifyContent: "flex-end" },
  dropdownSheet: {
    backgroundColor: Colors.card,
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
    borderWidth: 1, borderColor: Colors.border,
    paddingBottom: 32, paddingTop: 8,
    shadowColor: "#000", shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.08, shadowRadius: 16, elevation: 12,
  },
  dropdownSheetTitle: {
    fontSize: 11, color: Colors.textMuted, fontFamily: "DMSans_500Medium",
    letterSpacing: 0.8, textTransform: "uppercase",
    textAlign: "center", paddingVertical: 14,
  },
  dropdownOption: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 24, paddingVertical: 16,
  },
  dropdownOptionBorder:     { borderBottomWidth: 1, borderBottomColor: Colors.border },
  dropdownOptionActive:     { backgroundColor: Colors.accentDim },
  dropdownOptionText:       { fontSize: 16, color: Colors.text, fontFamily: "DMSans_400Regular" },
  dropdownOptionTextActive: { color: Colors.accent, fontFamily: "DMSans_700Bold" },

  // ── Group toggle ──
  groupRow:       { flexDirection: "row", backgroundColor: Colors.card, borderRadius: 12, borderWidth: 1, borderColor: Colors.border, padding: 3, marginBottom: 14 },
  groupBtn:       { flex: 1, paddingVertical: 8, alignItems: "center", borderRadius: 10 },
  groupBtnActive: { backgroundColor: Colors.accent },
  groupText:      { fontSize: 13, color: Colors.textSec, fontFamily: "DMSans_500Medium" },
  groupTextActive:{ color: Colors.white, fontFamily: "DMSans_700Bold" },

  sectionHeader:     { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingTop: 16, paddingBottom: 8 },
  sectionHeaderText: { fontSize: 15, color: Colors.text, fontFamily: "DMSans_700Bold" },
  sectionCount:      { fontSize: 12, color: Colors.textSec, fontFamily: "DMSans_400Regular" },

  card:        { flexDirection: "row", backgroundColor: Colors.card, borderRadius: 14, marginBottom: 8, borderWidth: 1, borderColor: Colors.border, overflow: "hidden" },
  accentBar:   { width: 3 },
  cardInner:   { flex: 1, paddingHorizontal: 14, paddingVertical: 13 },
  cardMain:    { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  routeCol:    { flex: 1, gap: 5 },
  routeRow:    { flexDirection: "row", alignItems: "center" },
  arrowWrap:   { flex: 0, flexDirection: "row", alignItems: "center", marginHorizontal: 8, gap: 3, maxWidth: 48 },
  arrowLine:   { flex: 1, height: 1, backgroundColor: Colors.border },
  airport:     { fontSize: 18, color: Colors.text, fontFamily: "DMSans_700Bold" },
  verifiedBadge: { marginLeft: 6, justifyContent: "center" },
  metaRow:     { flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" },
  meta:        { fontSize: 12, color: Colors.textSec, fontFamily: "DMSans_400Regular" },
  mockBadge:   {
    flexDirection: "row", alignItems: "center", gap: 3,
    backgroundColor: Colors.amberDim,
    paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6,
  },
  mockBadgeText: { fontSize: 10, color: Colors.amber, fontFamily: "DMSans_700Bold" },
  rightCol:    { flexDirection: "row", alignItems: "center", gap: 10, marginLeft: 8 },
  pill:        { paddingHorizontal: 9, paddingVertical: 4, borderRadius: 8 },
  pillText:    { fontSize: 11, fontFamily: "DMSans_700Bold" },
  trashBtn:    { padding: 4 },
  confirmRow:  { flexDirection: "row", gap: 8, marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: Colors.border },
  cancelBtn:   { flex: 1, paddingVertical: 8, borderRadius: 8, backgroundColor: Colors.surface ?? Colors.card, alignItems: "center" },
  cancelText:  { fontSize: 13, color: Colors.textSec, fontFamily: "DMSans_500Medium" },
  deleteBtn:   { flex: 1, paddingVertical: 8, borderRadius: 8, backgroundColor: Colors.red, alignItems: "center", flexDirection: "row", justifyContent: "center", gap: 5 },
  deleteText:  { fontSize: 13, color: Colors.white, fontFamily: "DMSans_700Bold" },

  fab: { position: "absolute", right: 20, width: 52, height: 52, borderRadius: 26, backgroundColor: Colors.accent, alignItems: "center", justifyContent: "center", shadowColor: Colors.accent, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 12, elevation: 6 },

  empty:      { paddingTop: 60, alignItems: "center", paddingHorizontal: 20 },
  emptyIcon:  { width: 72, height: 72, borderRadius: 20, backgroundColor: Colors.card, alignItems: "center", justifyContent: "center", marginBottom: 16, borderWidth: 1, borderColor: Colors.border },
  emptyTitle: { fontSize: 20, color: Colors.text, fontFamily: "DMSans_700Bold", marginBottom: 8 },
  emptySub:   { fontSize: 14, color: Colors.textSec, fontFamily: "DMSans_400Regular", textAlign: "center", lineHeight: 20, marginBottom: 24 },
  emptyBtn:   { backgroundColor: Colors.accent, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12 },
  emptyBtnText: { fontSize: 15, color: Colors.white, fontFamily: "DMSans_700Bold" },
});
