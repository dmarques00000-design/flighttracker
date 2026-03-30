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
  FadeInDown, FadeIn, FadeOut, Layout,
  useAnimatedStyle, useSharedValue, withSpring, withTiming, runOnJS,
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

const TODAY = new Date().toISOString().substring(0, 10);
const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];

type GroupBy = "month" | "year" | "all";
type TimeFilter = "all" | "upcoming" | "past" | number;

const SWIPE_DELETE_THRESHOLD = -80;

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
// Individual Flight Reminder Modal
// ---------------------------------------------------------------------------
function FlightReminderModal({
  flight,
  visible,
  onClose,
}: {
  flight: Flight | null;
  visible: boolean;
  onClose: () => void;
}) {
  const C = useColors();
  const insets = useSafeAreaInsets();
  const [activeOffsets, setActiveOffsets] = useState<Set<ReminderOffset>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Load existing individual reminders whenever the modal opens for a flight
  useEffect(() => {
    if (!visible || !flight) return;
    setLoading(true);
    getIndividualRemindersForFlight(flight.id).then((existing) => {
      setActiveOffsets(existing ?? new Set());
      setLoading(false);
    });
  }, [visible, flight?.id]);

  async function handleToggle(offset: ReminderOffset, value: boolean) {
    if (!flight) return;
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
    } catch (e) {
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
                    <Ionicons name="alarm-outline" size={18} color={C.accent} />
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
                    style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
                  >
                    <Ionicons name="close" size={22} color={C.textMuted} />
                  </Pressable>
                </View>
              </View>

              {/* Offset toggles */}
              <View style={{ paddingHorizontal: 20, gap: 8 }}>
                {!loading && REMINDER_OFFSETS.map((offset) => {
                  const isOn = activeOffsets.has(offset);
                  return (
                    <View
                      key={offset}
                      style={[
                        {
                          flexDirection: "row",
                          alignItems: "center",
                          justifyContent: "space-between",
                          paddingVertical: 11,
                          paddingHorizontal: 14,
                          borderRadius: 12,
                          borderWidth: 1,
                        },
                        isOn
                          ? { backgroundColor: C.accentDim, borderColor: C.accent + "55" }
                          : { backgroundColor: C.surface, borderColor: C.border },
                      ]}
                    >
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                        <View
                          style={{
                            width: 32, height: 32, borderRadius: 8,
                            backgroundColor: isOn ? C.accent + "22" : C.card,
                            alignItems: "center", justifyContent: "center",
                          }}
                        >
                          <Ionicons name="alarm-outline" size={16} color={isOn ? C.accent : C.textMuted} />
                        </View>
                        <Text
                          style={{
                            fontSize: 14,
                            fontFamily: isOn ? "DMSans_600SemiBold" : "DMSans_400Regular",
                            color: isOn ? C.text : C.textSec,
                          }}
                        >
                          {OFFSET_LABELS[offset]}
                        </Text>
                      </View>
                      <Switch
                        value={isOn}
                        onValueChange={(v) => handleToggle(offset, v)}
                        trackColor={{ false: C.border, true: C.accent }}
                        thumbColor={C.white}
                      />
                    </View>
                  );
                })}

                {loading && (
                  <View style={{ paddingVertical: 32, alignItems: "center" }}>
                    <Text style={{ fontSize: 13, color: C.textMuted, fontFamily: "DMSans_400Regular" }}>Loading…</Text>
                  </View>
                )}

                {!loading && (
                  <Text style={{ fontSize: 11, color: C.textMuted, fontFamily: "DMSans_400Regular", marginTop: 4, lineHeight: 16 }}>
                    These reminders are specific to this flight and override the global defaults.
                  </Text>
                )}
              </View>

              {/* Save button */}
              {!loading && (
                <View style={{ paddingHorizontal: 20, paddingTop: 20 }}>
                  <Pressable
                    onPress={handleSave}
                    disabled={saving}
                    style={({ pressed }) => ({
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 8,
                      backgroundColor: hasAny ? C.accent : C.surface,
                      borderRadius: 14,
                      paddingVertical: 14,
                      borderWidth: 1,
                      borderColor: hasAny ? C.accent : C.border,
                      opacity: pressed || saving ? 0.75 : 1,
                    })}
                  >
                    <Ionicons
                      name={hasAny ? "checkmark-circle-outline" : "notifications-off-outline"}
                      size={17}
                      color={hasAny ? C.white : C.textSec}
                    />
                    <Text
                      style={{
                        fontSize: 15,
                        fontFamily: "DMSans_700Bold",
                        color: hasAny ? C.white : C.textSec,
                      }}
                    >
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
function FlightItem({ flight, onDelete, onLongPress, index, query }: { flight: Flight; onDelete: () => void; onLongPress: () => void; index: number; query: string }) {
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
          <Ionicons name="trash" size={20} color={C.white} />
          <Text style={{ fontSize: 11, color: C.white, fontFamily: "DMSans_700Bold" }}>Delete</Text>
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
            onLongPress={() => {
              if (!isUpcoming) return; // only upcoming flights can have reminders
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              onLongPress();
            }}
            delayLongPress={400}
          >
            <View style={{
              backgroundColor: C.card,
              borderRadius: 16,
              borderWidth: 1,
              borderColor: C.border,
              overflow: "hidden",
              shadowColor: C.shadow,
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 1,
              shadowRadius: 8,
