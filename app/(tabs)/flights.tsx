import React, { useMemo, useState, useEffect } from "react";
import {
  View, Text, Image, StyleSheet, SectionList,
  Pressable, Platform, Modal, TouchableWithoutFeedback,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Animated, { FadeInDown, FadeIn } from "react-native-reanimated";
import { useColors } from "@/constants/colors";
import { useFlights, Flight } from "@/context/flights";
import { getAirlineInfo } from "@/utils/airlineLogos";

const TODAY = new Date().toISOString().substring(0, 10);
const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];

type GroupBy = "month" | "year" | "all";
type TimeFilter = "all" | "upcoming" | "past" | number;

function formatDate(dateStr: string): string {
  return new Date(dateStr + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
function daysUntil(dateStr: string): number {
  return Math.ceil((new Date(dateStr + "T00:00:00").getTime() - new Date(TODAY + "T00:00:00").getTime()) / (1000 * 60 * 60 * 24));
}

function groupFlights(flights: Flight[], groupBy: GroupBy, timeFilter: TimeFilter): { title: string; data: Flight[] }[] {
  let filtered: Flight[];
  if (timeFilter === "upcoming")     filtered = flights.filter((f) => f.date >= TODAY).sort((a, b) => a.date.localeCompare(b.date));
  else if (timeFilter === "past")    filtered = flights.filter((f) => f.date < TODAY).sort((a, b) => b.date.localeCompare(a.date));
  else if (timeFilter === "all")     filtered = [...flights].sort((a, b) => b.date.localeCompare(a.date));
  else filtered = flights.filter((f) => f.date.startsWith(String(timeFilter))).sort((a, b) => b.date.localeCompare(a.date));

  if (groupBy === "all") return filtered.length > 0 ? [{ title: "All Flights", data: filtered }] : [];
  if (groupBy === "year") {
    const map = new Map<number, Flight[]>();
    filtered.forEach((f) => { const y = parseInt(f.date.substring(0, 4), 10); if (!map.has(y)) map.set(y, []); map.get(y)!.push(f); });
    return Array.from(map.entries()).sort((a, b) => b[0] - a[0]).map(([year, data]) => ({ title: String(year), data }));
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
    .sort((a, b) => timeFilter === "upcoming" ? a[0].localeCompare(b[0]) : b[0].localeCompare(a[0]))
    .map(([key, data]) => { const y = parseInt(key.substring(0, 4), 10); const m = parseInt(key.substring(5), 10) - 1; return { title: `${MONTHS[m]} ${y}`, data }; });
}

function AirlineLogoSmall({ airlineCode }: { airlineCode: string }) {
  const C = useColors();
  const [errored, setErrored] = useState(false);
  const { logoUrl, color } = getAirlineInfo(airlineCode);
  const SIZE = 24;
  if (errored) return (
    <View style={{ width: SIZE, height: SIZE, borderRadius: SIZE / 4, backgroundColor: color + "18", borderColor: color + "40", borderWidth: 1, alignItems: "center", justifyContent: "center" }}>
      <Ionicons name="airplane" size={12} color={color} />
    </View>
  );
  return (
    <View style={{ width: SIZE, height: SIZE, borderRadius: SIZE / 4, alignItems: "center", justifyContent: "center", backgroundColor: C.white, borderWidth: 1, borderColor: C.border, overflow: "hidden" }}>
      <Image source={{ uri: logoUrl }} style={{ width: SIZE - 4, height: SIZE - 4 }} resizeMode="contain" onError={() => setErrored(true)} />
    </View>
  );
}

function PeriodDropdown({ value, options, onChange }: { value: TimeFilter; options: { key: TimeFilter; label: string }[]; onChange: (v: TimeFilter) => void }) {
  const C = useColors();
  const [open, setOpen] = useState(false);
  const label = options.find((o) => o.key === value)?.label ?? "Filter";
  return (
    <>
      <Pressable onPress={() => { Haptics.selectionAsync(); setOpen(true); }}
        style={({ pressed }) => [{ flexDirection: "row" as const, alignItems: "center" as const, gap: 6, alignSelf: "flex-start" as const, backgroundColor: C.card, borderRadius: 20, borderWidth: 1, borderColor: C.accent + "55", paddingHorizontal: 14, paddingVertical: 9, opacity: pressed ? 0.8 : 1 }]}>
        <Ionicons name="calendar-outline" size={14} color={C.accent} />
        <Text style={{ fontSize: 13, color: C.accent, fontFamily: "DMSans_700Bold" }}>{label}</Text>
        <Ionicons name="chevron-down" size={14} color={C.accent} />
      </Pressable>
      <Modal transparent animationType="fade" visible={open} onRequestClose={() => setOpen(false)}>
        <TouchableWithoutFeedback onPress={() => setOpen(false)}>
          <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.22)", justifyContent: "flex-end" }}>
            <TouchableWithoutFeedback>
              <Animated.View entering={FadeIn.duration(120)} style={{ backgroundColor: C.card, borderTopLeftRadius: 20, borderTopRightRadius: 20, borderWidth: 1, borderColor: C.border, paddingBottom: 32, paddingTop: 8 }}>
                <Text style={{ fontSize: 11, color: C.textMuted, fontFamily: "DMSans_500Medium", letterSpacing: 0.8, textTransform: "uppercase", textAlign: "center", paddingVertical: 14 }}>Filter by period</Text>
                {options.map((opt, i) => {
                  const isActive = opt.key === value;
                  return (
                    <Pressable key={String(opt.key)} onPress={() => { Haptics.selectionAsync(); onChange(opt.key); setOpen(false); }}
                      style={({ pressed }) => [{ flexDirection: "row" as const, alignItems: "center" as const, justifyContent: "space-between" as const, paddingHorizontal: 24, paddingVertical: 16, opacity: pressed ? 0.8 : 1 },
                        i < options.length - 1 && { borderBottomWidth: 1, borderBottomColor: C.border },
                        isActive && { backgroundColor: C.accentDim }]}>
                      <Text style={{ fontSize: 16, fontFamily: isActive ? "DMSans_700Bold" : "DMSans_400Regular", color: isActive ? C.accent : C.text }}>{opt.label}</Text>
                      {isActive && <Ionicons name="checkmark" size={16} color={C.accent} />}
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

function FlightItem({ flight, onDelete, index }: { flight: Flight; onDelete: () => void; index: number }) {
  const C = useColors();
  const [confirming, setConfirming] = useState(false);
  const isUpcoming = flight.date >= TODAY;
  const accentColor = isUpcoming ? C.accent : flight.status === "delayed" ? C.red : C.green;
  let pillBg: string, pillText: string, pillColor: string;
  if (isUpcoming) {
    const days = daysUntil(flight.date);
    pillBg    = days === 0 ? C.accent : days <= 7 ? C.amber + "22" : C.accentDim;
    pillColor = days === 0 ? C.white  : days <= 7 ? C.amber        : C.accent;
    pillText  = days === 0 ? "Today!" : days === 1 ? "Tomorrow" : `In ${days} days`;
  } else {
    pillBg    = flight.status === "delayed" ? C.red + "18" : C.green + "18";
    pillColor = flight.status === "delayed" ? C.red        : C.green;
    pillText  = flight.status === "delayed" ? "Delayed" : flight.status === "cancelled" ? "Cancelled" : "Completed";
  }
  return (
    <Pressable onPress={() => { if (confirming) { setConfirming(false); return; } router.push({ pathname: "/flight/[id]", params: { id: flight.id } }); }}>
      <Animated.View entering={FadeInDown.delay(index * 30).springify()}
        style={{ flexDirection: "row", backgroundColor: C.card, borderRadius: 14, marginBottom: 8, borderWidth: 1, borderColor: C.border, overflow: "hidden" }}>
        <View style={{ width: 3, backgroundColor: accentColor }} />
        <View style={{ flex: 1, paddingHorizontal: 14, paddingVertical: 13 }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <View style={{ flex: 1, gap: 5 }}>
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <Text style={{ fontSize: 18, color: C.text, fontFamily: "DMSans_700Bold" }}>{flight.departureAirport}</Text>
                <View style={{ flex: 0, flexDirection: "row", alignItems: "center", marginHorizontal: 8, gap: 3, maxWidth: 48 }}>
                  <View style={{ flex: 1, height: 1, backgroundColor: C.border }} />
                  <Ionicons name="airplane" size={11} color={accentColor} />
                  <View style={{ flex: 1, height: 1, backgroundColor: C.border }} />
                </View>
                <Text style={{ fontSize: 18, color: C.text, fontFamily: "DMSans_700Bold" }}>{flight.arrivalAirport}</Text>
                {flight.verified && <View style={{ marginLeft: 6 }}><Ionicons name="checkmark-circle" size={13} color={C.accent} /></View>}
              </View>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                <AirlineLogoSmall airlineCode={flight.airlineCode} />
                <Text style={{ fontSize: 12, color: C.textSec, fontFamily: "DMSans_400Regular" }}>{flight.flightCode}{"  \u00b7  "}{formatDate(flight.date)}</Text>
                {flight.isMock && (
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 3, backgroundColor: C.amberDim, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 }}>
                    <Ionicons name="sparkles-outline" size={9} color={C.amber} />
                    <Text style={{ fontSize: 10, color: C.amber, fontFamily: "DMSans_700Bold" }}>Estimated</Text>
                  </View>
                )}
              </View>
            </View>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginLeft: 8 }}>
              <View style={{ paddingHorizontal: 9, paddingVertical: 4, borderRadius: 8, backgroundColor: pillBg }}>
                <Text style={{ fontSize: 11, fontFamily: "DMSans_700Bold", color: pillColor }}>{pillText}</Text>
              </View>
              {!confirming && (
                <Pressable onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); setConfirming(true); }} hitSlop={14}>
                  <Ionicons name="trash-outline" size={16} color={C.textSec} />
                </Pressable>
              )}
            </View>
          </View>
          {confirming && (
            <Animated.View entering={FadeIn.duration(150)} style={{ flexDirection: "row", gap: 8, marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: C.border }}>
              <Pressable onPress={() => setConfirming(false)} style={{ flex: 1, paddingVertical: 8, borderRadius: 8, backgroundColor: C.surface, alignItems: "center" }}>
                <Text style={{ fontSize: 13, color: C.textSec, fontFamily: "DMSans_500Medium" }}>Cancel</Text>
              </Pressable>
              <Pressable onPress={() => { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning); setConfirming(false); onDelete(); }}
                style={{ flex: 1, paddingVertical: 8, borderRadius: 8, backgroundColor: C.red, alignItems: "center", flexDirection: "row", justifyContent: "center", gap: 5 }}>
                <Ionicons name="trash" size={14} color={C.white} />
                <Text style={{ fontSize: 13, color: C.white, fontFamily: "DMSans_700Bold" }}>Remove</Text>
              </Pressable>
            </Animated.View>
          )}
        </View>
      </Animated.View>
    </Pressable>
  );
}

export default function FlightsScreen() {
  const C = useColors();
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
    flights.forEach((f) => { const y = parseInt(f.date.substring(0, 4), 10); if (!isNaN(y)) set.add(y); });
    return Array.from(set).sort((a, b) => b - a);
  }, [flights]);

  const hasUpcoming = useMemo(() => flights.some((f) => f.date >= TODAY), [flights]);
  const hasPast     = useMemo(() => flights.some((f) => f.date < TODAY),  [flights]);
  const dropdownOptions = useMemo(() => [
    ...(hasUpcoming ? [{ key: "upcoming" as TimeFilter, label: "Upcoming" }] : []),
    ...(hasPast     ? [{ key: "past"     as TimeFilter, label: "Past" }]     : []),
    { key: "all" as TimeFilter, label: "All Time" },
    ...years.map((y) => ({ key: y as TimeFilter, label: String(y) })),
  ], [hasUpcoming, hasPast, years]);

  const sections  = useMemo(() => groupFlights(flights, groupBy, timeFilter), [flights, groupBy, timeFilter]);
  const totalShown = sections.reduce((s, sec) => s + sec.data.length, 0);
  const GROUP_OPTIONS: { key: GroupBy; label: string }[] = [{ key: "month", label: "By Month" }, { key: "year", label: "By Year" }, { key: "all", label: "All" }];

  return (
    <View style={{ flex: 1, backgroundColor: C.bg, paddingTop: topPadding }}>
      <SectionList
        sections={sections}
        keyExtractor={(f) => f.id}
        showsVerticalScrollIndicator={false}
        contentInsetAdjustmentBehavior="automatic"
        stickySectionHeadersEnabled={false}
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 4, paddingBottom: bottomPadding + 100 }}
        ListHeaderComponent={() => (
          <View style={{ paddingTop: 16, paddingBottom: 8 }}>
            <View style={{ marginBottom: 16 }}>
              <Text style={{ fontSize: 30, color: C.text, fontFamily: "DMSans_700Bold" }}>All Flights</Text>
              <Text style={{ fontSize: 14, color: C.textSec, fontFamily: "DMSans_400Regular", marginTop: 2 }}>{totalShown} flight{totalShown !== 1 ? "s" : ""}</Text>
            </View>
            <View style={{ marginBottom: 12 }}>
              <PeriodDropdown value={timeFilter} options={dropdownOptions} onChange={setTimeFilter} />
            </View>
            <View style={{ flexDirection: "row", backgroundColor: C.card, borderRadius: 12, borderWidth: 1, borderColor: C.border, padding: 3, marginBottom: 14 }}>
              {GROUP_OPTIONS.map((opt) => (
                <Pressable key={opt.key} onPress={() => { Haptics.selectionAsync(); setGroupBy(opt.key); }}
                  style={{ flex: 1, paddingVertical: 8, alignItems: "center", borderRadius: 10, backgroundColor: groupBy === opt.key ? C.accent : "transparent" }}>
                  <Text style={{ fontSize: 13, fontFamily: groupBy === opt.key ? "DMSans_700Bold" : "DMSans_500Medium", color: groupBy === opt.key ? C.white : C.textSec }}>{opt.label}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        )}
        renderSectionHeader={({ section }) => groupBy !== "all" ? (
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingTop: 16, paddingBottom: 8 }}>
            <Text style={{ fontSize: 15, color: C.text, fontFamily: "DMSans_700Bold" }}>{section.title}</Text>
            <Text style={{ fontSize: 12, color: C.textSec, fontFamily: "DMSans_400Regular" }}>{section.data.length} flight{section.data.length !== 1 ? "s" : ""}</Text>
          </View>
        ) : null}
        ListEmptyComponent={() => (
          <Animated.View entering={FadeInDown.springify()} style={{ paddingTop: 60, alignItems: "center", paddingHorizontal: 20 }}>
            <View style={{ width: 72, height: 72, borderRadius: 20, backgroundColor: C.card, alignItems: "center", justifyContent: "center", marginBottom: 16, borderWidth: 1, borderColor: C.border }}>
              <Ionicons name="airplane-outline" size={36} color={C.textSec} />
            </View>
            <Text style={{ fontSize: 20, color: C.text, fontFamily: "DMSans_700Bold", marginBottom: 8 }}>
              {timeFilter === "upcoming" ? "No upcoming flights" : timeFilter === "past" ? "No past flights" : "No flights yet"}
            </Text>
            <Text style={{ fontSize: 14, color: C.textSec, fontFamily: "DMSans_400Regular", textAlign: "center", lineHeight: 20, marginBottom: 24 }}>
              {timeFilter === "upcoming" ? "Add a future flight to see it here." : timeFilter === "past" ? "Flights with past dates will appear here." : "Add your first flight to start building your logbook."}
            </Text>
            {timeFilter !== "upcoming" && timeFilter !== "past" && (
              <Pressable onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); router.push("/add-flight"); }}
                style={({ pressed }) => [{ backgroundColor: C.accent, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12, opacity: pressed ? 0.8 : 1 }]}>
                <Text style={{ fontSize: 15, color: C.white, fontFamily: "DMSans_700Bold" }}>Add Flight</Text>
              </Pressable>
            )}
          </Animated.View>
        )}
        renderItem={({ item, index }) => <FlightItem flight={item} index={index} onDelete={() => removeFlight(item.id)} />}
      />
      <Pressable onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); router.push("/add-flight"); }}
        style={({ pressed }) => [{ position: "absolute", right: 20, bottom: (Platform.OS === "web" ? 34 : insets.bottom) + 80, width: 52, height: 52, borderRadius: 26, backgroundColor: C.accent, alignItems: "center", justifyContent: "center", shadowColor: C.accent, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 12, elevation: 6, opacity: pressed ? 0.85 : 1, transform: [{ scale: pressed ? 0.95 : 1 }] }]}>
        <Ionicons name="add" size={26} color={C.white} />
      </Pressable>
    </View>
  );
}
