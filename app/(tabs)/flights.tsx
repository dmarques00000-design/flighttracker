import React, { useMemo, useState, useCallback, useRef, useEffect } from "react";
import {
  View, Text, Image, SectionList,
  Pressable, Platform, Modal, TouchableWithoutFeedback,
  TextInput, Keyboard, Switch, Alert,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Animated, {
  FadeInDown, FadeIn, FadeOut, Layout, SlideInDown, SlideOutDown,
  useAnimatedStyle, useSharedValue, withSpring, withTiming,
} from "react-native-reanimated";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { useColors } from "@/constants/colors";
import { useFlights, Flight } from "@/context/flights";
import { getAirlineInfo } from "@/utils/airlineLogos";
import {
  REMINDER_OFFSETS,
  ReminderOffset,
  requestNotificationPermission,
  getIndividualRemindersForFlight,
  saveIndividualRemindersForFlight,
} from "@/utils/notifications";
import { useSwipeNavigation } from "@/hooks/useSwipeNavigation";

const TODAY = new Date().toISOString().substring(0, 10);
const CURRENT_YEAR = new Date().getFullYear();
const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];

type GroupBy = "month" | "year" | "all";
type TimeFilter = "all" | "upcoming" | "past" | number;

// Raised from -80 → -120 to avoid accidental trigger on diagonal scrolls
const SWIPE_DELETE_THRESHOLD = -120;
const UNDO_DURATION_MS = 2500;

const OFFSET_LABELS: Record<ReminderOffset, string> = {
  24: "24h before",
  6:  "6h before",
  3:  "3h before",
};

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

/**
 * Returns the best default TimeFilter given the available flights:
 *  1. Current year, if it has at least one flight.
 *  2. The most recent year in the list that has flights.
 *  3. "all" if there are no flights at all.
 */
function smartDefaultFilter(flights: Flight[]): TimeFilter {
  if (flights.length === 0) return "all";
  const hasCurrentYear = flights.some((f) => f.date.startsWith(String(CURRENT_YEAR)));
  if (hasCurrentYear) return CURRENT_YEAR;
  const years = Array.from(
    new Set(flights.map((f) => parseInt(f.date.substring(0, 4), 10)).filter((y) => !isNaN(y)))
  ).sort((a, b) => b - a);
  return years.length > 0 ? years[0] : "all";
}

function AirlineLogoSmall({ airlineCode }: { airlineCode: string }) {
  const C = useColors();
  const [errored, setErrored] = useState(false);
  const { logoUrl, color } = getAirlineInfo(airlineCode);
  const SIZE = 28;
  if (errored) return (
    <View style={{ width: SIZE, height: SIZE, borderRadius: SIZE / 4, backgroundColor: color + "18", borderColor: color + "40", borderWidth: 1, alignItems: "center", justifyContent: "center" }}>
      <Ionicons name="airplane" size={14} color={color} accessible={false} />
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
      <Pressable
        onPress={() => { Haptics.selectionAsync(); setOpen(true); }}
        accessibilityRole="button"
        accessibilityLabel={`Filter by period, currently ${label}`}
        style={({ pressed }) => [{ flexDirection: "row" as const, alignItems: "center" as const, gap: 6, alignSelf: "flex-start" as const, backgroundColor: C.card, borderRadius: 20, borderWidth: 1, borderColor: C.accent + "55", paddingHorizontal: 14, paddingVertical: 9, opacity: pressed ? 0.8 : 1 }]}>
        <Ionicons name="calendar-outline" size={14} color={C.accent} accessible={false} />
        <Text style={{ fontSize: 13, color: C.accent, fontFamily: "DMSans_700Bold" }}>{label}</Text>
        <Ionicons name="chevron-down" size={14} color={C.accent} accessible={false} />
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
                    <Pressable
                      key={String(opt.key)}
                      onPress={() => { Haptics.selectionAsync(); onChange(opt.key); setOpen(false); }}
                      accessibilityRole="radio"
                      accessibilityLabel={opt.label}
                      accessibilityState={{ checked: isActive }}
                      style={({ pressed }) => [{ flexDirection: "row" as const, alignItems: "center" as const, justifyContent: "space-between" as const, paddingHorizontal: 24, paddingVertical: 16, opacity: pressed ? 0.8 : 1 },
                        i < options.length - 1 && { borderBottomWidth: 1, borderBottomColor: C.border },
                        isActive && { backgroundColor: C.accentDim }]}>
                      <Text style={{ fontSize: 16, fontFamily: isActive ? "DMSans_700Bold" : "DMSans_400Regular", color: isActive ? C.accent : C.text }}>{opt.label}</Text>
                      {isActive && <Ionicons name="checkmark" size={16} color={C.accent} accessible={false} />}
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
// Undo Toast
// ---------------------------------------------------------------------------
function UndoToast({
  flight,
  onUndo,
  onCommit,
}: {
  flight: Flight;
  onUndo: () => void;
  onCommit: () => void;
}) {
  const C = useColors();
  const insets = useSafeAreaInsets();
  const progress = useSharedValue(1);

  useEffect(() => {
    progress.value = withTiming(0, { duration: UNDO_DURATION_MS });
    const timer = setTimeout(() => { onCommit(); }, UNDO_DURATION_MS);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const barStyle = useAnimatedStyle(() => ({ width: `${progress.value * 100}%` as unknown as number }));

  return (
    <Animated.View
      entering={SlideInDown.springify().damping(18)}
      exiting={SlideOutDown.duration(200)}
      style={{
        position: "absolute",
        bottom: (Platform.OS === "web" ? 34 : insets.bottom) + 88,
        left: 16,
        right: 16,
        backgroundColor: C.card,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: C.border,
        overflow: "hidden",
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.14,
        shadowRadius: 16,
        elevation: 8,
      }}
    >
      {/* Progress bar */}
      <View style={{ height: 3, backgroundColor: C.border }}>
        <Animated.View style={[barStyle, { height: 3, backgroundColor: C.red }]} />
      </View>

      <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 14, paddingVertical: 12, gap: 10 }}>
        <View style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: C.red + "18", alignItems: "center", justifyContent: "center" }}>
          <Ionicons name="trash-outline" size={16} color={C.red} accessible={false} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 13, color: C.text, fontFamily: "DMSans_700Bold" }} numberOfLines={1}>
            {flight.departureAirport} → {flight.arrivalAirport} deleted
          </Text>
          <Text style={{ fontSize: 11, color: C.textSec, fontFamily: "DMSans_400Regular", marginTop: 1 }}>
            {flight.flightCode}  ·  {formatDate(flight.date)}
          </Text>
        </View>
        <Pressable
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); onUndo(); }}
          accessibilityRole="button"
          accessibilityLabel={`Undo delete of ${flight.departureAirport} to ${flight.arrivalAirport}`}
          style={({ pressed }) => [{ backgroundColor: C.accent, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, opacity: pressed ? 0.8 : 1 }]}
        >
          <Text style={{ fontSize: 13, color: C.white, fontFamily: "DMSans_700Bold" }}>Undo</Text>
        </Pressable>
      </View>
    </Animated.View>
  );
}

// ---------------------------------------------------------------------------
// Individual Flight Reminder Modal
// ---------------------------------------------------------------------------
function FlightReminderModal({
  flight,
  visible,
  onClose,
  onSaved,
}: {
  flight: Flight | null;
  visible: boolean;
  onClose: () => void;
  onSaved: (flightId: string, hasReminders: boolean) => void;
}) {
  const C = useColors();
  const insets = useSafeAreaInsets();
  const [activeOffsets, setActiveOffsets] = useState<Set<ReminderOffset>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!visible || !flight) return;
    setLoading(true);
    getIndividualRemindersForFlight(flight.id).then((existing) => {
      setActiveOffsets(existing ?? new Set());
      setLoading(false);
    });
  }, [visible, flight?.id]);

  function handleToggle(offset: ReminderOffset, value: boolean) {
    Haptics.selectionAsync();
    setActiveOffsets((prev) => {
      const next = new Set(prev);
      value ? next.add(offset) : next.delete(offset);
      return next;
    });
  }

  async function handleSave() {
    if (!flight) return;
    setSaving(true);
    try {
      if (activeOffsets.size > 0) {
        const granted = await requestNotificationPermission();
        if (!granted) {
          Alert.alert(
            "Permission Required",
            "Please enable notifications for Logbook in your device Settings to receive flight reminders.",
          );
          setSaving(false);
          return;
        }
      }
      await saveIndividualRemindersForFlight(flight, activeOffsets.size > 0 ? activeOffsets : null);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onSaved(flight.id, activeOffsets.size > 0);
    } catch {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setSaving(false);
      onClose();
    }
  }

  if (!flight) return null;
  const hasAny = activeOffsets.size > 0;

  return (
    <Modal
      transparent
      animationType="fade"
      visible={visible}
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.35)", justifyContent: "flex-end" }}>
          <TouchableWithoutFeedback>
            <Animated.View
              entering={FadeIn.duration(140)}
              style={{
                backgroundColor: C.card,
                borderTopLeftRadius: 24,
                borderTopRightRadius: 24,
                borderWidth: 1,
                borderColor: C.border,
                paddingBottom: Math.max(insets.bottom, 24),
                paddingTop: 8,
              }}
            >
              {/* Drag handle */}
              <View style={{ alignItems: "center", paddingTop: 8, paddingBottom: 4 }}>
                <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: C.border }} />
              </View>

              {/* Header */}
              <View style={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: 16 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                  <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: C.accent + "18", alignItems: "center", justifyContent: "center" }}>
                    <Ionicons name="alarm-outline" size={18} color={C.accent} accessible={false} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 16, color: C.text, fontFamily: "DMSans_700Bold" }}>Flight Reminder</Text>
                    <Text style={{ fontSize: 12, color: C.textSec, fontFamily: "DMSans_400Regular", marginTop: 1 }}>
                      {flight.flightCode}  ·  {flight.departureAirport} → {flight.arrivalAirport}
                    </Text>
                  </View>
                  <Pressable
                    onPress={onClose}
                    hitSlop={10}
                    accessibilityRole="button"
                    accessibilityLabel="Close reminder modal"
                    style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}>
                    <Ionicons name="close" size={22} color={C.textMuted} accessible={false} />
                  </Pressable>
                </View>
              </View>

              {/* Offset toggles */}
              <View style={{ paddingHorizontal: 20, gap: 8 }}>
                {loading && (
                  <View style={{ paddingVertical: 32, alignItems: "center" }}>
                    <Text style={{ fontSize: 13, color: C.textMuted, fontFamily: "DMSans_400Regular" }}>Loading…</Text>
                  </View>
                )}

                {!loading && REMINDER_OFFSETS.map((offset) => {
                  const isOn = activeOffsets.has(offset);
                  return (
                    <View
                      key={offset}
                      style={[
                        { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 11, paddingHorizontal: 14, borderRadius: 12, borderWidth: 1 },
                        isOn ? { backgroundColor: C.accentDim, borderColor: C.accent + "55" } : { backgroundColor: C.surface, borderColor: C.border },
                      ]}
                    >
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                        <View style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: isOn ? C.accent + "22" : C.card, alignItems: "center", justifyContent: "center" }}>
                          <Ionicons name="alarm-outline" size={16} color={isOn ? C.accent : C.textMuted} accessible={false} />
                        </View>
                        <Text style={{ fontSize: 14, fontFamily: isOn ? "DMSans_600SemiBold" : "DMSans_400Regular", color: isOn ? C.text : C.textSec }}>
                          {OFFSET_LABELS[offset]}
                        </Text>
                      </View>
                      <Switch
                        value={isOn}
                        onValueChange={(v) => handleToggle(offset, v)}
                        trackColor={{ false: C.border, true: C.accent }}
                        thumbColor={C.white}
                        accessibilityLabel={`Reminder ${OFFSET_LABELS[offset]}`}
                      />
                    </View>
                  );
                })}

                {!loading && (
                  <Text style={{ fontSize: 11, color: C.textMuted, fontFamily: "DMSans_400Regular", marginTop: 4, lineHeight: 16 }}>
                    These reminders are specific to this flight and override your global defaults.
                  </Text>
                )}
              </View>

              {/* Save button */}
              {!loading && (
                <View style={{ paddingHorizontal: 20, paddingTop: 20 }}>
                  <Pressable
                    onPress={handleSave}
                    disabled={saving}
                    accessibilityRole="button"
                    accessibilityLabel={saving ? "Saving reminders" : hasAny ? "Save reminders" : "Clear reminders"}
                    style={({ pressed }) => ({
                      flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
                      backgroundColor: hasAny ? C.accent : C.surface,
                      borderRadius: 14, paddingVertical: 14,
                      borderWidth: 1, borderColor: hasAny ? C.accent : C.border,
                      opacity: pressed || saving ? 0.75 : 1,
                    })}
                  >
                    <Ionicons
                      name={hasAny ? "checkmark-circle-outline" : "notifications-off-outline"}
                      size={17}
                      color={hasAny ? C.white : C.textSec}
                      accessible={false}
                    />
                    <Text style={{ fontSize: 15, fontFamily: "DMSans_700Bold", color: hasAny ? C.white : C.textSec }}>
                      {saving ? "Saving…" : hasAny ? "Save Reminders" : "Clear Reminders"}
                    </Text>
                  </Pressable>
                </View>
              )}
            </Animated.View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Swipeable Flight Card
// ---------------------------------------------------------------------------
function FlightItem({
  flight, onDeleteIntent, onLongPress, index, query, hasIndividualReminder,
}: {
  flight: Flight;
  onDeleteIntent: () => void;
  onLongPress: () => void;
  index: number;
  query: string;
  hasIndividualReminder: boolean;
}) {
  const C = useColors();
  const isUpcoming = flight.date >= TODAY;

  const translateX = useSharedValue(0);
  const deleteOpacity = useSharedValue(0);

  // ── Memoize derived colours so inline style objects are not reallocated
  // on every render pass (critical: this component is rendered per SectionList row).
  const derived = useMemo(() => {
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
    return { accentColor, pillBg, pillText, pillColor };
  }, [C, isUpcoming, flight.date, flight.status]);

  const { accentColor, pillBg, pillText, pillColor } = derived;

  // Build a concise VoiceOver label for the card
  const cardA11yLabel = useMemo(() => {
    const base = `${flight.departureAirport} to ${flight.arrivalAirport}, ${flight.flightCode}, ${formatDate(flight.date)}`;
    return `${base}, ${pillText}`;
  }, [flight.departureAirport, flight.arrivalAirport, flight.flightCode, flight.date, pillText]);

  const panGesture = Gesture.Pan()
    .activeOffsetX([-16, 16])
    .onUpdate((e) => {
      if (e.translationX < 0) {
        translateX.value = Math.max(e.translationX, -120);
        deleteOpacity.value = Math.min(Math.abs(e.translationX) / 120, 1);
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

  function collapse() {
    translateX.value = withSpring(0);
    deleteOpacity.value = withTiming(0);
  }

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
        position: "absolute", right: 0, top: 0, bottom: 0, width: 120, borderRadius: 16,
        backgroundColor: C.red, alignItems: "center", justifyContent: "center", gap: 4,
      }]}>
        <Pressable
          onPress={() => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            collapse();
            onDeleteIntent();
          }}
          accessibilityRole="button"
          accessibilityLabel={`Delete flight ${flight.departureAirport} to ${flight.arrivalAirport}`}
          style={{ alignItems: "center", justifyContent: "center", gap: 4, width: "100%", height: "100%" }}
        >
          <Ionicons name="trash" size={20} color={C.white} accessible={false} />
          <Text style={{ fontSize: 11, color: C.white, fontFamily: "DMSans_700Bold" }}>Delete</Text>
        </Pressable>
      </Animated.View>

      {/* Card */}
      <GestureDetector gesture={panGesture}>
        <Animated.View style={cardAnimStyle}>
          <Pressable
            onPress={() => { router.push({ pathname: "/flight/[id]", params: { id: flight.id } }); }}
            onLongPress={() => {
              if (!isUpcoming) return;
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              onLongPress();
            }}
            delayLongPress={400}
            accessibilityRole="button"
            accessibilityLabel={cardA11yLabel}
            accessibilityHint="Opens flight details"
          >
            <View style={{
              backgroundColor: C.card, borderRadius: 16, borderWidth: 1, borderColor: C.border,
              overflow: "hidden", shadowColor: C.shadow,
              shadowOffset: { width: 0, height: 2 }, shadowOpacity: 1, shadowRadius: 8,
            }}>
              {/* Colored left edge */}
              <View style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 3, backgroundColor: accentColor }} />

              <View style={{ paddingLeft: 16, paddingRight: 14, paddingVertical: 14 }}>
                {/* Route row */}
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <Highlight text={flight.departureAirport} style={{ fontSize: 20, color: C.text, fontFamily: "DMSans_700Bold" }} />
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 3, paddingHorizontal: 4 }}>
                      <View style={{ width: 16, height: 1, backgroundColor: C.border }} />
                      <Ionicons name="airplane" size={12} color={accentColor} accessible={false} />
                      <View style={{ width: 16, height: 1, backgroundColor: C.border }} />
                    </View>
                    <Highlight text={flight.arrivalAirport} style={{ fontSize: 20, color: C.text, fontFamily: "DMSans_700Bold" }} />
                    {flight.verified && <Ionicons name="checkmark-circle" size={14} color={C.accent} accessible={false} />}
                  </View>
                  <View style={{ paddingHorizontal: 9, paddingVertical: 4, borderRadius: 8, backgroundColor: pillBg }}>
                    <Text style={{ fontSize: 11, fontFamily: "DMSans_700Bold", color: pillColor }}>{pillText}</Text>
                  </View>
                </View>

                {/* Meta row */}
                <View style={{ flexDirection: "row", alignItems: "center", gap: 7, flexWrap: "wrap" }}>
                  <AirlineLogoSmall airlineCode={flight.airlineCode} />
                  <Highlight
                    text={`${flight.flightCode}  ·  ${formatDate(flight.date)}`}
                    style={{ fontSize: 12, color: C.textSec, fontFamily: "DMSans_400Regular" }}
                  />
                  {flight.isMock && (
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 3, backgroundColor: C.amberDim, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 }}>
                      <Ionicons name="sparkles-outline" size={9} color={C.amber} accessible={false} />
                      <Text style={{ fontSize: 10, color: C.amber, fontFamily: "DMSans_700Bold" }}>Estimated</Text>
                    </View>
                  )}
                  {isUpcoming && hasIndividualReminder && (
                    <View style={{ marginLeft: "auto" }}>
                      <Ionicons name="alarm-outline" size={13} color={C.accent} accessible={false} />
                    </View>
                  )}
                </View>
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

export default function FlightsScreen() {
  const C = useColors();
  const insets = useSafeAreaInsets();
  const { flights, isLoading, removeFlight } = useFlights();
  const params = useLocalSearchParams<{ filter?: string }>();
  const topPadding    = Platform.OS === "web" ? 67 : insets.top;
  const bottomPadding = Platform.OS === "web" ? 34 : 0;

  const [groupBy, setGroupBy]               = useState<GroupBy>("month");
  // Initialise to "all" cheaply; corrected to the smart default once flights load.
  const [timeFilter, setTimeFilter]         = useState<TimeFilter>("all");
  const defaultApplied                      = useRef(false);
  const [query, setQuery]                   = useState("");
  const [searchFocused, setSearchFocused]   = useState(false);
  const [reminderFlight, setReminderFlight] = useState<Flight | null>(null);
  const [reminderVisible, setReminderVisible] = useState(false);
  const [reminderFlags, setReminderFlags]   = useState<Record<string, boolean>>({});

  // Undo-delete state
  const [pendingDelete, setPendingDelete]   = useState<Flight | null>(null);
  const pendingDeleteRef = useRef<Flight | null>(null);

  const searchRef = useRef<TextInput>(null);
  const isSearching = query.trim().length > 0;

  const swipeHandlers = useSwipeNavigation(1, !searchFocused);

  // ── Smart default: set once, as soon as the flights array is non-empty ──────
  useEffect(() => {
    if (defaultApplied.current || isLoading) return;
    if (flights.length === 0) return;
    defaultApplied.current = true;
    setTimeFilter(smartDefaultFilter(flights));
  }, [flights, isLoading]);

  // ── Undo helpers ──────────────────────────────────────────────────────────
  const handleDeleteIntent = useCallback((flight: Flight) => {
    if (pendingDeleteRef.current) {
      // A previous deletion was pending — commit it immediately (fire-and-forget;
      // errors are handled inside handleCommitDelete).
      pendingDeleteRef.current = null;
      setPendingDelete(null);
    }
    pendingDeleteRef.current = flight;
    setPendingDelete(flight);
    Keyboard.dismiss();
  }, []);

  const handleUndoDelete = useCallback(() => {
    pendingDeleteRef.current = null;
    setPendingDelete(null);
  }, []);

  const handleCommitDelete = useCallback(() => {
    const flight = pendingDeleteRef.current;
    if (!flight) return;
    pendingDeleteRef.current = null;
    setPendingDelete(null);

    // Warning haptic fires at the moment of irrevocable deletion —
    // after the undo window has closed and removeFlight is called.
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);

    removeFlight(flight.id).catch(() => {
      // The context already reverted the optimistic removal; let the user know.
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert(
        "Couldn't Delete Flight",
        `${flight.departureAirport} → ${flight.arrivalAirport} has been restored. Please check your connection and try again.`,
        [{ text: "OK" }],
      );
    });
  }, [removeFlight]);
  // ─────────────────────────────────────────────────────────────────────────

  useEffect(() => {
    const upcomingFlights = flights.filter((f) => f.date >= TODAY);
    Promise.all(
      upcomingFlights.map((f) =>
        getIndividualRemindersForFlight(f.id).then((offsets) => ({
          id: f.id,
          hasReminder: offsets !== null && offsets.size > 0,
        }))
      )
    ).then((results) => {
      const flags: Record<string, boolean> = {};
      results.forEach(({ id, hasReminder }) => { flags[id] = hasReminder; });
      setReminderFlags(flags);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flights.length]);

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

  // Sections exclude the pending-delete flight so the card disappears immediately
  const sections = useMemo(() => {
    const visibleFlights = pendingDelete
      ? flights.filter((f) => f.id !== pendingDelete.id)
      : flights;
    if (isSearching) {
      const results = visibleFlights
        .filter((f) => matchesFlight(f, query))
        .sort((a, b) => b.date.localeCompare(a.date));
      return results.length > 0 ? [{ title: "Results", data: results }] : [];
    }
    return groupFlights(visibleFlights, groupBy, timeFilter);
  }, [flights, pendingDelete, groupBy, timeFilter, query, isSearching]);

  const totalShown = sections.reduce((s, sec) => s + sec.data.length, 0);

  const handleQueryChange     = useCallback((q: string) => setQuery(q), []);
  const handleSearchFocus     = useCallback(() => setSearchFocused(true), []);
  const handleSearchBlur      = useCallback(() => setSearchFocused(false), []);
  const handleClearSearch     = useCallback(() => { setQuery(""); searchRef.current?.blur(); Haptics.selectionAsync(); }, []);
  const handleSetTimeFilter   = useCallback((v: TimeFilter) => setTimeFilter(v), []);
  const handleSetGroupBy      = useCallback((v: GroupBy) => setGroupBy(v), []);

  const handleLongPress = useCallback((flight: Flight) => {
    setReminderFlight(flight);
    setReminderVisible(true);
  }, []);

  const handleReminderClose = useCallback(() => { setReminderVisible(false); }, []);

  const handleReminderSaved = useCallback((flightId: string, hasReminders: boolean) => {
    setReminderFlags((prev) => ({ ...prev, [flightId]: hasReminders }));
  }, []);

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
              <Pressable
                key={opt.key}
                onPress={() => { Haptics.selectionAsync(); handleSetGroupBy(opt.key); }}
                accessibilityRole="radio"
                accessibilityLabel={`Group ${opt.label}`}
                accessibilityState={{ checked: groupBy === opt.key }}
                style={{ flex: 1, paddingVertical: 8, alignItems: "center", borderRadius: 10, backgroundColor: groupBy === opt.key ? C.accent : "transparent" }}>
                <Text style={{ fontSize: 13, fontFamily: groupBy === opt.key ? "DMSans_700Bold" : "DMSans_500Medium", color: groupBy === opt.key ? C.white : C.textSec }}>{opt.label}</Text>
              </Pressable>
            ))}
          </View>
        </Animated.View>
      )}
    </View>
  // C is intentionally included so the bar re-renders immediately when the
  // colour scheme changes (light ↔ dark), without needing a user interaction.
  ), [C, isSearching, totalShown, query, timeFilter, dropdownOptions, groupBy]);

  return (
    <View style={{ flex: 1, backgroundColor: C.bg, paddingTop: topPadding }} {...swipeHandlers}>
      {/* Search bar */}
      <View style={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: 4, backgroundColor: C.bg }}>
        <Animated.View
          layout={Layout.springify()}
          style={{ flexDirection: "row", alignItems: "center", backgroundColor: C.card, borderRadius: 14, borderWidth: 1, borderColor: searchFocused ? C.accent : C.border, paddingHorizontal: 12, gap: 8 }}
        >
          <Ionicons name="search-outline" size={18} color={searchFocused ? C.accent : C.textMuted} accessible={false} />
          <TextInput
            ref={searchRef}
            value={query}
            onChangeText={handleQueryChange}
            onFocus={handleSearchFocus}
            onBlur={handleSearchBlur}
            placeholder="Search by flight, airport, city…"
            placeholderTextColor={C.textMuted}
            returnKeyType="search"
            clearButtonMode="while-editing"
            autoCorrect={false}
            autoCapitalize="characters"
            accessibilityLabel="Search flights"
            style={{ flex: 1, height: 46, fontSize: 15, color: C.text, fontFamily: "DMSans_400Regular" }}
          />
          {isSearching && (
            <Animated.View entering={FadeIn.duration(120)} exiting={FadeOut.duration(100)}>
              <Pressable
                hitSlop={10}
                onPress={handleClearSearch}
                accessibilityRole="button"
                accessibilityLabel="Clear search">
                <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: C.textMuted, alignItems: "center", justifyContent: "center" }}>
                  <Ionicons name="close" size={12} color={C.white} accessible={false} />
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
          <Animated.View entering={FadeInDown.springify()} style={{ paddingTop: 60, alignItems: "center", paddingHorizontal: 20 }}>
            <View style={{ width: 72, height: 72, borderRadius: 20, backgroundColor: C.card, alignItems: "center", justifyContent: "center", marginBottom: 16, borderWidth: 1, borderColor: C.border }}>
              <Ionicons name={isSearching ? "search-outline" : "airplane-outline"} size={36} color={C.textSec} accessible={false} />
            </View>
            <Text style={{ fontSize: 20, color: C.text, fontFamily: "DMSans_700Bold", marginBottom: 8 }}>
              {isSearching
                ? `No results for "${query.trim()}"`
                : timeFilter === "upcoming" ? "No upcoming flights"
                : timeFilter === "past"     ? "No past flights"
                : "No flights yet"
              }
            </Text>
            <Text style={{ fontSize: 14, color: C.textSec, fontFamily: "DMSans_400Regular", textAlign: "center", lineHeight: 20, marginBottom: 24 }}>
              {isSearching
                ? "Try searching by IATA code, airport, city or airline."
                : timeFilter === "upcoming" ? "Add a future flight to see it here."
                : timeFilter === "past"     ? "Flights with past dates will appear here."
                : "Add your first flight to start building your logbook."
              }
            </Text>
            {isSearching && (
              <Pressable
                onPress={() => { setQuery(""); searchRef.current?.focus(); Haptics.selectionAsync(); }}
                accessibilityRole="button"
                accessibilityLabel="Clear search and try again"
                style={({ pressed }) => [{ backgroundColor: C.card, borderWidth: 1, borderColor: C.border, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12, opacity: pressed ? 0.8 : 1 }]}>
                <Text style={{ fontSize: 15, color: C.accent, fontFamily: "DMSans_700Bold" }}>Clear Search</Text>
              </Pressable>
            )}
            {!isSearching && timeFilter !== "upcoming" && timeFilter !== "past" && (
              <Pressable
                onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); router.push("/add-flight"); }}
                accessibilityRole="button"
                accessibilityLabel="Add your first flight"
                style={({ pressed }) => [{ backgroundColor: C.accent, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12, opacity: pressed ? 0.8 : 1 }]}>
                <Text style={{ fontSize: 15, color: C.white, fontFamily: "DMSans_700Bold" }}>Add Flight</Text>
              </Pressable>
            )}
          </Animated.View>
        )}
        renderItem={({ item, index }) => (
          <FlightItem
            flight={item}
            index={index}
            query={query}
            hasIndividualReminder={!!reminderFlags[item.id]}
            onDeleteIntent={() => handleDeleteIntent(item)}
            onLongPress={() => handleLongPress(item)}
          />
        )}
      />

      {/* FAB */}
      {!searchFocused && (
        <Pressable
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); router.push("/add-flight"); }}
          accessibilityRole="button"
          accessibilityLabel="Add flight"
          accessibilityHint="Opens the add flight form"
          style={({ pressed }) => [{
            position: "absolute", right: 20,
            bottom: (Platform.OS === "web" ? 34 : insets.bottom) + 80,
            width: 52, height: 52, borderRadius: 26, backgroundColor: C.accent,
            alignItems: "center", justifyContent: "center",
            shadowColor: C.accent, shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.4, shadowRadius: 12, elevation: 6,
            opacity: pressed ? 0.85 : 1, transform: [{ scale: pressed ? 0.95 : 1 }],
          }]}
        >
          <Ionicons name="add" size={26} color={C.white} accessible={false} />
        </Pressable>
      )}

      {/* Undo-delete toast */}
      {pendingDelete && (
        <UndoToast
          flight={pendingDelete}
          onUndo={handleUndoDelete}
          onCommit={handleCommitDelete}
        />
      )}

      {/* Individual flight reminder modal */}
      <FlightReminderModal
        flight={reminderFlight}
        visible={reminderVisible}
        onClose={handleReminderClose}
        onSaved={handleReminderSaved}
      />
    </View>
  );
}
