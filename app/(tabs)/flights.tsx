import React, { useMemo, useState, useCallback, useRef } from "react";
import {
  View, Text, Image, SectionList,
  Pressable, Platform, Modal, TouchableWithoutFeedback,
  TextInput, Keyboard,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Animated, {
  FadeInDown, FadeIn, FadeOut, Layout,
  useAnimatedStyle, useSharedValue, withSpring, withTiming, runOnJS,
} from "react-native-reanimated";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { useColors } from "@/constants/colors";
import { useFlights, Flight } from "@/context/flights";
import { getAirlineInfo } from "@/utils/airlineLogos";
import { useEffect } from "react";

const TODAY = new Date().toISOString().substring(0, 10);
const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];

type GroupBy = "month" | "year" | "all";
type TimeFilter = "all" | "upcoming" | "past" | number;

const SWIPE_DELETE_THRESHOLD = -80;

function formatDate(dateStr: string): string {
  return new Date(dateStr + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
function daysUntil(dateStr: string): number {
  return Math.ceil((new Date(dateStr + "T00:00:00").getTime() - new Date(TODAY + "T00:00:00").getTime()) / (1000 * 60 * 60 * 24));
}

function matchesFlight(f: Flight, q: string): boolean {
  const term = q.toLowerCase().trim();
  if (!term) return true;
  return (
    f.flightCode.toLowerCase().includes(term) ||
    f.airline.toLowerCase().includes(term) ||
    f.airlineCode.toLowerCase().includes(term) ||
    f.departureAirport.toLowerCase().includes(term) ||
    f.arrivalAirport.toLowerCase().includes(term) ||
    f.departureCity.toLowerCase().includes(term) ||
    f.arrivalCity.toLowerCase().includes(term)
  );
}

function groupFlights(flights: Flight[], groupBy: GroupBy, timeFilter: TimeFilter): { title: string; data: Flight[] }[] {
  let filtered: Flight[];
  if (timeFilter === "upcoming")  filtered = flights.filter((f) => f.date >= TODAY).sort((a, b) => a.date.localeCompare(b.date));
  else if (timeFilter === "past") filtered = flights.filter((f) => f.date < TODAY).sort((a, b) => b.date.localeCompare(a.date));
  else if (timeFilter === "all")  filtered = [...flights].sort((a, b) => b.date.localeCompare(a.date));
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
  const SIZE = 28;
  if (errored) return (
    <View style={{ width: SIZE, height: SIZE, borderRadius: SIZE / 4, backgroundColor: color + "18", borderColor: color + "40", borderWidth: 1, alignItems: "center", justifyContent: "center" }}>
      <Ionicons name="airplane" size={14} color={color} />
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

// ---------------------------------------------------------------------------
// Swipeable Flight Card
// ---------------------------------------------------------------------------
function FlightItem({ flight, onDelete, index, query }: { flight: Flight; onDelete: () => void; index: number; query: string }) {
  const C = useColors();
  const [confirming, setConfirming] = useState(false);
  const isUpcoming = flight.date >= TODAY;
  const { color: airlineColor } = getAirlineInfo(flight.airlineCode);

  // Swipe gesture
  const translateX = useSharedValue(0);
  const deleteOpacity = useSharedValue(0);

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

  const panGesture = Gesture.Pan()
    .activeOffsetX([-10, 10])
    .onUpdate((e) => {
      if (e.translationX < 0) {
        translateX.value = Math.max(e.translationX, -120);
        deleteOpacity.value = Math.min(Math.abs(e.translationX) / 80, 1);
      } else {
        translateX.value = withSpring(0);
        deleteOpacity.value = withTiming(0);
      }
    })
    .onEnd((e) => {
      if (e.translationX < SWIPE_DELETE_THRESHOLD) {
        translateX.value = withSpring(-120);
      } else {
        translateX.value = withSpring(0);
        deleteOpacity.value = withTiming(0);
      }
    });

  const cardAnimStyle = useAnimatedStyle(() => ({ transform: [{ translateX: translateX.value }] }));
  const deleteRevealStyle = useAnimatedStyle(() => ({ opacity: deleteOpacity.value }));

  function Highlight({ text, style }: { text: string; style: object }) {
    const term = query.toLowerCase().trim();
    if (!term) return <Text style={style}>{text}</Text>;
    const idx = text.toLowerCase().indexOf(term);
    if (idx === -1) return <Text style={style}>{text}</Text>;
    return (
      <Text style={style}>
        {text.slice(0, idx)}
        <Text style={[style, { backgroundColor: C.accent + "33", color: C.accent }]}>
          {text.slice(idx, idx + term.length)}
        </Text>
        {text.slice(idx + term.length)}
      </Text>
    );
  }

  return (
    <Animated.View
      entering={FadeInDown.delay(index * 30).springify()}
      layout={Layout.springify()}
      style={{ marginBottom: 10, position: "relative" }}
    >
      {/* Swipe-to-delete background */}
      <Animated.View style={[deleteRevealStyle, {
        position: "absolute", right: 0, top: 0, bottom: 0,
        width: 120, borderRadius: 16,
        backgroundColor: C.red,
        alignItems: "center", justifyContent: "center", gap: 4,
      }]}>
        <Pressable
          onPress={() => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            translateX.value = withSpring(0);
            deleteOpacity.value = withTiming(0);
            onDelete();
          }}
          style={{ alignItems: "center", justifyContent: "center", gap: 4, width: "100%", height: "100%" }}
        >
          <Ionicons name="trash" size={20} color="#fff" />
          <Text style={{ fontSize: 11, color: "#fff", fontFamily: "DMSans_700Bold" }}>Delete</Text>
        </Pressable>
      </Animated.View>

      {/* Card */}
      <GestureDetector gesture={panGesture}>
        <Animated.View style={cardAnimStyle}>
          <Pressable
            onPress={() => {
              if (confirming) { setConfirming(false); return; }
              router.push({ pathname: "/flight/[id]", params: { id: flight.id } });
            }}
          >
            <View style={{
              backgroundColor: C.card,
              borderRadius: 16,
              borderWidth: 1,
              borderColor: C.border,
              overflow: "hidden",
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.06,
              shadowRadius: 8,
              elevation: 2,
            }}>
              {/* Airline colour accent strip */}
              <View style={{ height: 3, backgroundColor: airlineColor }} />

              <View style={{ paddingHorizontal: 16, paddingTop: 14, paddingBottom: 13 }}>
                {/* Route row */}
                <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 10 }}>
                  <View style={{ flex: 1 }}>
                    <Highlight text={flight.departureAirport} style={{ fontSize: 22, color: C.text, fontFamily: "DMSans_700Bold", letterSpacing: -0.5 }} />
                    <Text style={{ fontSize: 11, color: C.textMuted, fontFamily: "DMSans_400Regular", marginTop: 1 }} numberOfLines={1}>
                      {flight.departureCity || ""}
                    </Text>
                  </View>

                  <View style={{ alignItems: "center", paddingHorizontal: 10, gap: 4 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 3, width: 60 }}>
                      <View style={{ flex: 1, height: 1, backgroundColor: C.border }} />
                      <Ionicons name="airplane" size={12} color={accentColor} />
                      <View style={{ flex: 1, height: 1, backgroundColor: C.border }} />
                    </View>
                    {flight.durationMinutes > 0 && (
                      <Text style={{ fontSize: 10, color: C.textMuted, fontFamily: "DMSans_400Regular" }}>
                        {Math.floor(flight.durationMinutes / 60)}h{flight.durationMinutes % 60 > 0 ? ` ${flight.durationMinutes % 60}m` : ""}
                      </Text>
                    )}
                  </View>

                  <View style={{ flex: 1, alignItems: "flex-end" }}>
                    <Highlight text={flight.arrivalAirport} style={{ fontSize: 22, color: C.text, fontFamily: "DMSans_700Bold", letterSpacing: -0.5 }} />
                    <Text style={{ fontSize: 11, color: C.textMuted, fontFamily: "DMSans_400Regular", marginTop: 1 }} numberOfLines={1}>
                      {flight.arrivalCity || ""}
                    </Text>
                  </View>
                </View>

                {/* Footer row */}
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <AirlineLogoSmall airlineCode={flight.airlineCode} />
                    <View>
                      <Highlight
                        text={flight.flightCode}
                        style={{ fontSize: 13, color: C.text, fontFamily: "DMSans_700Bold" }}
                      />
                      <Text style={{ fontSize: 11, color: C.textSec, fontFamily: "DMSans_400Regular" }}>
                        {formatDate(flight.date)}
                      </Text>
                    </View>
                    {flight.isMock && (
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 3, backgroundColor: C.amberDim, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 }}>
                        <Ionicons name="sparkles-outline" size={9} color={C.amber} />
                        <Text style={{ fontSize: 10, color: C.amber, fontFamily: "DMSans_700Bold" }}>Est.</Text>
                      </View>
                    )}
                    {flight.verified && (
                      <Ionicons name="checkmark-circle" size={14} color={C.accent} />
                    )}
                  </View>

                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <View style={{ paddingHorizontal: 9, paddingVertical: 4, borderRadius: 8, backgroundColor: pillBg }}>
                      <Text style={{ fontSize: 11, fontFamily: "DMSans_700Bold", color: pillColor }}>{pillText}</Text>
                    </View>
                  </View>
                </View>

                {confirming && (
                  <Animated.View entering={FadeIn.duration(150)} style={{ flexDirection: "row", gap: 8, marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: C.border }}>
                    <Pressable onPress={() => setConfirming(false)} style={{ flex: 1, paddingVertical: 8, borderRadius: 8, backgroundColor: C.surface, alignItems: "center" }}>
                      <Text style={{ fontSize: 13, color: C.textSec, fontFamily: "DMSans_500Medium" }}>Cancel</Text>
                    </Pressable>
                    <Pressable
                      onPress={() => { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning); setConfirming(false); onDelete(); }}
                      style={{ flex: 1, paddingVertical: 8, borderRadius: 8, backgroundColor: C.red, alignItems: "center", flexDirection: "row", justifyContent: "center", gap: 5 }}
                    >
                      <Ionicons name="trash" size={14} color={C.white} />
                      <Text style={{ fontSize: 13, color: C.white, fontFamily: "DMSans_700Bold" }}>Remove</Text>
                    </Pressable>
                  </Animated.View>
                )}
              </View>
            </View>
          </Pressable>
        </Animated.View>
      </GestureDetector>
    </Animated.View>
  );
}

const GROUP_OPTIONS: { key: GroupBy; label: string }[] = [
  { key: "month", label: "By Month" },
  { key: "year",  label: "By Year" },
  { key: "all",   label: "All" },
];

// ---------------------------------------------------------------------------
// Empty State Illustration
// ---------------------------------------------------------------------------
function EmptyState({ isSearching, query, timeFilter, searchRef, setQuery }: {
  isSearching: boolean;
  query: string;
  timeFilter: TimeFilter;
  searchRef: React.RefObject<TextInput>;
  setQuery: (q: string) => void;
}) {
  const C = useColors();

  // Derive icon + headline + subline based on context
  let icon: string, headline: string, subline: string, showAddCta: boolean;
  if (isSearching) {
    icon = "search-outline";
    headline = `No results for "${query.trim()}"`;
    subline = "Try searching by IATA code, airport, city or airline.";
    showAddCta = false;
  } else if (timeFilter === "upcoming") {
    icon = "calendar-outline";
    headline = "No upcoming flights";
    subline = "Add a future flight to see it here.";
    showAddCta = false;
  } else if (timeFilter === "past") {
    icon = "time-outline";
    headline = "No past flights";
    subline = "Flights with past dates will appear here.";
    showAddCta = false;
  } else {
    icon = "airplane-outline";
    headline = "No flights yet";
    subline = "Your logbook is empty. Add your first flight to start building your travel story.";
    showAddCta = true;
  }

  return (
    <Animated.View entering={FadeInDown.springify()} style={{ paddingTop: 56, alignItems: "center", paddingHorizontal: 32 }}>
      {/* Illustration circles */}
      <View style={{ marginBottom: 24, alignItems: "center", justifyContent: "center" }}>
        <View style={{
          width: 100, height: 100, borderRadius: 50,
          backgroundColor: C.accentDim,
          alignItems: "center", justifyContent: "center",
        }}>
          <View style={{
            width: 72, height: 72, borderRadius: 36,
            backgroundColor: C.card,
            borderWidth: 1.5, borderColor: C.accent + "44",
            alignItems: "center", justifyContent: "center",
            shadowColor: C.accent, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.14, shadowRadius: 12, elevation: 4,
          }}>
            <Ionicons name={icon as never} size={34} color={C.accent} />
          </View>
        </View>
        {/* Dotted orbit rings */}
        {[130, 160].map((size) => (
          <View key={size} style={{
            position: "absolute",
            width: size, height: size, borderRadius: size / 2,
            borderWidth: 1, borderColor: C.accent + "18",
            borderStyle: "dashed",
          }} />
        ))}
      </View>

      <Text style={{ fontSize: 20, color: C.text, fontFamily: "DMSans_700Bold", textAlign: "center", marginBottom: 10 }}>
        {headline}
      </Text>
      <Text style={{ fontSize: 14, color: C.textSec, fontFamily: "DMSans_400Regular", textAlign: "center", lineHeight: 21, marginBottom: 28 }}>
        {subline}
      </Text>

      {isSearching && (
        <Pressable
          onPress={() => { setQuery(""); searchRef.current?.focus(); Haptics.selectionAsync(); }}
          style={({ pressed }) => [{ backgroundColor: C.card, borderWidth: 1, borderColor: C.border, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12, opacity: pressed ? 0.8 : 1 }]}
        >
          <Text style={{ fontSize: 15, color: C.accent, fontFamily: "DMSans_700Bold" }}>Clear Search</Text>
        </Pressable>
      )}

      {showAddCta && (
        <Pressable
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); router.push("/add-flight"); }}
          style={({ pressed }) => [{
            flexDirection: "row", alignItems: "center", gap: 8,
            backgroundColor: C.accent, paddingHorizontal: 24, paddingVertical: 14,
            borderRadius: 30, opacity: pressed ? 0.85 : 1,
            shadowColor: C.accent, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 12, elevation: 5,
          }]}
        >
          <Ionicons name="add" size={18} color={C.white} />
          <Text style={{ fontSize: 15, color: C.white, fontFamily: "DMSans_700Bold" }}>Add First Flight</Text>
        </Pressable>
      )}
    </Animated.View>
  );
}

export default function FlightsScreen() {
  const C = useColors();
  const insets = useSafeAreaInsets();
  const { flights, removeFlight } = useFlights();
  const params = useLocalSearchParams<{ filter?: string }>();
  const topPadding    = Platform.OS === "web" ? 67 : insets.top;
  const bottomPadding = Platform.OS === "web" ? 34 : 0;

  const [groupBy, setGroupBy]             = useState<GroupBy>("month");
  const [timeFilter, setTimeFilter]       = useState<TimeFilter>(new Date().getFullYear());
  const [query, setQuery]                 = useState("");
  const [searchFocused, setSearchFocused] = useState(false);
  const searchRef = useRef<TextInput>(null);

  const isSearching = query.trim().length > 0;

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

  const sections = useMemo(() => {
    if (isSearching) {
      const results = flights
        .filter((f) => matchesFlight(f, query))
        .sort((a, b) => b.date.localeCompare(a.date));
      return results.length > 0 ? [{ title: "Results", data: results }] : [];
    }
    return groupFlights(flights, groupBy, timeFilter);
  }, [flights, groupBy, timeFilter, query, isSearching]);

  const totalShown = sections.reduce((s, sec) => s + sec.data.length, 0);

  const handleQueryChange   = useCallback((q: string) => setQuery(q), []);
  const handleSearchFocus   = useCallback(() => setSearchFocused(true), []);
  const handleSearchBlur    = useCallback(() => setSearchFocused(false), []);
  const handleClearSearch   = useCallback(() => { setQuery(""); searchRef.current?.blur(); Haptics.selectionAsync(); }, []);
  const handleSetTimeFilter = useCallback((v: TimeFilter) => setTimeFilter(v), []);
  const handleSetGroupBy    = useCallback((v: GroupBy) => setGroupBy(v), []);

  const renderListHeader = useCallback(() => (
    <View style={{ paddingTop: 8, paddingBottom: 8 }}>
      <View style={{ marginBottom: 12 }}>
        <Text style={{ fontSize: 30, color: C.text, fontFamily: "DMSans_700Bold" }}>All Flights</Text>
        <Text style={{ fontSize: 14, color: C.textSec, fontFamily: "DMSans_400Regular", marginTop: 2 }}>
          {isSearching
            ? `${totalShown} result${totalShown !== 1 ? "s" : ""} for "${query.trim()}"`
            : `${totalShown} flight${totalShown !== 1 ? "s" : ""}`
          }
        </Text>
      </View>
      {!isSearching && (
        <Animated.View entering={FadeIn.duration(150)} exiting={FadeOut.duration(100)} layout={Layout.springify()}>
          <View style={{ marginBottom: 12 }}>
            <PeriodDropdown value={timeFilter} options={dropdownOptions} onChange={handleSetTimeFilter} />
          </View>
          <View style={{ flexDirection: "row", backgroundColor: C.card, borderRadius: 12, borderWidth: 1, borderColor: C.border, padding: 3, marginBottom: 14 }}>
            {GROUP_OPTIONS.map((opt) => (
              <Pressable key={opt.key} onPress={() => { Haptics.selectionAsync(); handleSetGroupBy(opt.key); }}
                style={{ flex: 1, paddingVertical: 8, alignItems: "center", borderRadius: 10, backgroundColor: groupBy === opt.key ? C.accent : "transparent" }}>
                <Text style={{ fontSize: 13, fontFamily: groupBy === opt.key ? "DMSans_700Bold" : "DMSans_500Medium", color: groupBy === opt.key ? C.white : C.textSec }}>{opt.label}</Text>
              </Pressable>
            ))}
          </View>
        </Animated.View>
      )}
    </View>
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ), [isSearching, totalShown, query, timeFilter, dropdownOptions, groupBy]);

  return (
    <View style={{ flex: 1, backgroundColor: C.bg, paddingTop: topPadding }}>
      <View style={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: 4, backgroundColor: C.bg }}>
        <Animated.View
          layout={Layout.springify()}
          style={{ flexDirection: "row", alignItems: "center", backgroundColor: C.card, borderRadius: 14, borderWidth: 1, borderColor: searchFocused ? C.accent : C.border, paddingHorizontal: 12, gap: 8 }}
        >
          <Ionicons name="search-outline" size={18} color={searchFocused ? C.accent : C.textMuted} />
          <TextInput
            ref={searchRef}
            value={query}
            onChangeText={handleQueryChange}
            onFocus={handleSearchFocus}
            onBlur={handleSearchBlur}
            placeholder="Search by flight, airport, city\u2026"
            placeholderTextColor={C.textMuted}
            returnKeyType="search"
            clearButtonMode="while-editing"
            autoCorrect={false}
            autoCapitalize="characters"
            style={{ flex: 1, height: 46, fontSize: 15, color: C.text, fontFamily: "DMSans_400Regular" }}
          />
          {isSearching && (
            <Animated.View entering={FadeIn.duration(120)} exiting={FadeOut.duration(100)}>
              <Pressable hitSlop={10} onPress={handleClearSearch}>
                <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: C.textMuted, alignItems: "center", justifyContent: "center" }}>
                  <Ionicons name="close" size={12} color={C.white} />
                </View>
              </Pressable>
            </Animated.View>
          )}
        </Animated.View>
      </View>

      <SectionList
        sections={sections}
        keyExtractor={(f) => f.id}
        showsVerticalScrollIndicator={false}
        contentInsetAdjustmentBehavior="automatic"
        stickySectionHeadersEnabled={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 4, paddingBottom: bottomPadding + 100 }}
        ListHeaderComponent={renderListHeader}
        renderSectionHeader={({ section }) => (!isSearching && groupBy !== "all") ? (
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingTop: 16, paddingBottom: 8 }}>
            <Text style={{ fontSize: 15, color: C.text, fontFamily: "DMSans_700Bold" }}>{section.title}</Text>
            <Text style={{ fontSize: 12, color: C.textSec, fontFamily: "DMSans_400Regular" }}>{section.data.length} flight{section.data.length !== 1 ? "s" : ""}</Text>
          </View>
        ) : null}
        ListEmptyComponent={() => (
          <EmptyState
            isSearching={isSearching}
            query={query}
            timeFilter={timeFilter}
            searchRef={searchRef}
            setQuery={setQuery}
          />
        )}
        renderItem={({ item, index }) => (
          <FlightItem
            flight={item}
            index={index}
            query={query}
            onDelete={() => { removeFlight(item.id); Keyboard.dismiss(); }}
          />
        )}
      />
      {!searchFocused && (
        <Pressable
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); router.push("/add-flight"); }}
          style={({ pressed }) => [{ position: "absolute", right: 20, bottom: (Platform.OS === "web" ? 34 : insets.bottom) + 80, width: 52, height: 52, borderRadius: 26, backgroundColor: C.accent, alignItems: "center", justifyContent: "center", shadowColor: C.accent, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 12, elevation: 6, opacity: pressed ? 0.85 : 1, transform: [{ scale: pressed ? 0.95 : 1 }] }]}
        >
          <Ionicons name="add" size={26} color={C.white} />
        </Pressable>
      )}
    </View>
  );
}
