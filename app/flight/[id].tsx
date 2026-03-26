import React, { useRef, useState, useEffect } from "react";
import {
  View,
  Text,
  Image,
  ScrollView,
  Pressable,
  Platform,
  ActivityIndicator,
  Alert,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as Sharing from "expo-sharing";
import * as MediaLibrary from "expo-media-library";
import * as Calendar from "expo-calendar";
import * as Notifications from "expo-notifications";
import ViewShot from "react-native-view-shot";
import Animated, { FadeInDown, FadeIn } from "react-native-reanimated";
import { useColors } from "@/constants/colors";
import { useFlights } from "@/context/flights";
import { useUser } from "@/context/user";
import { getAirlineInfo } from "@/utils/airlineLogos";
import FlightShareCard from "@/components/FlightShareCard";
import { computeActualBlockMinutes } from "@/utils/airportTimezones";
import {
  REMINDER_OFFSETS,
  ReminderOffset,
  notifId,
  scheduleFlightReminder,
  cancelFlightReminder,
  requestNotificationPermission,
} from "@/utils/notifications";

function formatDate(dateStr: string): string {
  return new Date(dateStr + "T00:00:00").toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric", year: "numeric",
  });
}
function formatDateShort(dateStr: string): string {
  return new Date(dateStr + "T00:00:00").toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
  });
}
function formatHours(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

/** Parse "HH:MM" and a date string into a JS Date in local time. */
function parseLocalDateTime(dateStr: string, timeStr: string): Date {
  const [year, month, day] = dateStr.split("-").map(Number);
  const [hour, minute]     = timeStr.split(":").map(Number);
  return new Date(year, month - 1, day, hour, minute, 0);
}

const OFFSET_LABEL_MAP: Record<ReminderOffset, string> = {
  24: "24h before",
  6:  "6h before",
  3:  "3h before",
};

function InfoRow({ label, value, accent }: { label: string; value: string; accent?: string }) {
  const C = useColors();
  return (
    <View style={{
      flexDirection: "row", justifyContent: "space-between", alignItems: "center",
      paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: C.border,
    }}>
      <Text style={{ fontSize: 14, color: C.textSec, fontFamily: "DMSans_400Regular", flexShrink: 0 }}>{label}</Text>
      <Text style={[
        { fontSize: 14, color: C.text, fontFamily: "DMSans_500Medium", textAlign: "right", flex: 1, marginLeft: 16 },
        accent ? { color: accent } : undefined,
      ]}>{value}</Text>
    </View>
  );
}

function AirlineLogo({ logoUrl, color, size = 32 }: { logoUrl: string; color: string; size?: number }) {
  const C = useColors();
  const [errored, setErrored] = useState(false);
  if (errored) {
    return (
      <View style={{
        width: size, height: size, borderRadius: size / 4,
        backgroundColor: color + "18", borderColor: color + "40",
        borderWidth: 1, alignItems: "center", justifyContent: "center",
      }}>
        <Ionicons name="airplane" size={size * 0.5} color={color} />
      </View>
    );
  }
  return (
    <View style={{
      width: size, height: size, borderRadius: size / 4,
      borderColor: C.border, borderWidth: 1,
      alignItems: "center", justifyContent: "center",
      backgroundColor: "#FFFFFF", overflow: "hidden",
    }}>
      <Image
        source={{ uri: logoUrl }}
        style={{ width: size - 4, height: size - 4 }}
        resizeMode="contain"
        onError={() => setErrored(true)}
      />
    </View>
  );
}

function FlightNotFound({ topPad }: { topPad: number }) {
  const C = useColors();
  return (
    <View style={{ flex: 1, backgroundColor: C.bg, paddingTop: topPad }}>
      <View style={{
        flexDirection: "row", alignItems: "center", justifyContent: "space-between",
        paddingHorizontal: 16, paddingTop: 8, paddingBottom: 10,
        borderBottomWidth: 1, borderBottomColor: C.border,
      }}>
        <Pressable onPress={() => router.back()} style={{
          width: 40, height: 40, alignItems: "center", justifyContent: "center",
          borderRadius: 20, backgroundColor: C.card, borderWidth: 1, borderColor: C.border,
        }} hitSlop={8}>
          <Ionicons name="chevron-back" size={22} color={C.text} />
        </Pressable>
        <View style={{ flex: 1 }} />
      </View>
      <Animated.View entering={FadeIn.delay(60)} style={{
        flex: 1, alignItems: "center", justifyContent: "center",
        paddingHorizontal: 36, paddingBottom: 60,
      }}>
        <View style={{
          width: 80, height: 80, borderRadius: 40,
          backgroundColor: C.accentDim, borderWidth: 1, borderColor: C.accent + "30",
          alignItems: "center", justifyContent: "center", marginBottom: 20,
        }}>
          <Ionicons name="airplane-outline" size={40} color={C.accent} />
        </View>
        <Text style={{ fontSize: 20, color: C.text, fontFamily: "DMSans_700Bold", marginBottom: 10, textAlign: "center" }}>Flight not found</Text>
        <Text style={{ fontSize: 14, color: C.textSec, fontFamily: "DMSans_400Regular", textAlign: "center", lineHeight: 21, marginBottom: 28 }}>
          This flight may have been deleted or the link is no longer valid.
        </Text>
        <Pressable
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            if (router.canGoBack()) router.back();
            else router.replace("/(tabs)");
          }}
          style={({ pressed }) => [{
            flexDirection: "row", alignItems: "center", gap: 8,
            backgroundColor: C.accent, paddingHorizontal: 24, paddingVertical: 14, borderRadius: 30,
          }, { opacity: pressed ? 0.85 : 1 }]}
        >
          <Ionicons name="arrow-back-outline" size={16} color={C.white} />
          <Text style={{ fontSize: 15, color: C.white, fontFamily: "DMSans_700Bold" }}>Go Back</Text>
        </Pressable>
      </Animated.View>
    </View>
  );
}

/** Tracks which notification IDs are currently scheduled for a given flight. */
function useScheduledReminders(flightId: string) {
  const [scheduled, setScheduled] = useState<Set<ReminderOffset>>(new Set());

  async function refresh() {
    if (Platform.OS === "web") return;
    const all = await Notifications.getAllScheduledNotificationsAsync();
    const ids = new Set(all.map((n) => n.identifier));
    const active = new Set<ReminderOffset>();
    for (const offset of REMINDER_OFFSETS) {
      if (ids.has(notifId(flightId, offset))) active.add(offset);
    }
    setScheduled(active);
  }

  useEffect(() => { refresh(); }, [flightId]);

  return { scheduled, refresh };
}

/** Add the flight as a calendar event. Returns true on success. */
async function addFlightToCalendar(flight: {
  flightCode: string;
  airline: string;
  departureAirport: string;
  arrivalAirport: string;
  departureCity: string;
  arrivalCity: string;
  date: string;
  departureTime: string;
  arrivalTime: string;
  departureTerminal?: string;
  departureGate?: string;
  arrivalTerminal?: string;
  aircraft: string;
}): Promise<boolean> {
  if (Platform.OS === "web") return false;

  const { status } = await Calendar.requestCalendarPermissionsAsync();
  if (status !== "granted") return false;

  const startDate = parseLocalDateTime(flight.date, flight.departureTime);

  // Arrival: if arrival time < departure time the flight crosses midnight — add 1 day
  const rawEnd = parseLocalDateTime(flight.date, flight.arrivalTime);
  const endDate = rawEnd < startDate
    ? new Date(rawEnd.getTime() + 24 * 60 * 60 * 1000)
    : rawEnd;

  const notes = [
    `✈️  ${flight.airline}  ·  ${flight.flightCode}`,
    `Aircraft: ${flight.aircraft}`,
    flight.departureTerminal || flight.departureGate
      ? `Departure: ${[flight.departureTerminal ? `Terminal ${flight.departureTerminal}` : null, flight.departureGate ? `Gate ${flight.departureGate}` : null].filter(Boolean).join("  ·  ")}`
      : null,
    flight.arrivalTerminal || flight.arrivalGate
      ? `Arrival: ${[flight.arrivalTerminal ? `Terminal ${flight.arrivalTerminal}` : null, flight.arrivalGate ? `Gate ${flight.arrivalGate}` : null].filter(Boolean).join("  ·  ")}`
      : null,
    "\nAdded from Logbook ✈️",
  ].filter(Boolean).join("\n");

  // Find (or create) a default writable calendar
  const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
  const writable  = calendars.find(
    (c) => c.allowsModifications && c.source?.isLocalAccount !== false,
  ) ?? calendars.find((c) => c.allowsModifications);

  if (!writable) return false;

  await Calendar.createEventAsync(writable.id, {
    title: `${flight.flightCode}  ${flight.departureAirport} → ${flight.arrivalAirport}`,
    startDate,
    endDate,
    location: `${flight.departureCity} (${flight.departureAirport}) → ${flight.arrivalCity} (${flight.arrivalAirport})`,
    notes,
    alarms: [{ relativeOffset: -60 }], // 1h reminder as a sensible default
    timeZone: "local",
  });

  return true;
}

export default function FlightDetailScreen() {
  const C = useColors();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { flights } = useFlights();
  const { notifPrefs } = useUser();
  const insets = useSafeAreaInsets();
  const flight = flights.find((f) => f.id === id);
  const shareRef = useRef<ViewShot>(null);
  const [sharing, setSharing] = useState(false);
  const [addingCalendar, setAddingCalendar] = useState(false);
  const [togglingOffset, setTogglingOffset] = useState<ReminderOffset | null>(null);

  const topPad    = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom + 20;

  const TODAY      = new Date().toISOString().substring(0, 10);
  const isUpcoming = !!flight && flight.date >= TODAY;

  const { scheduled, refresh: refreshReminders } = useScheduledReminders(flight?.id ?? "");

  if (!flight) return <FlightNotFound topPad={topPad} />;

  // ─── Share ───────────────────────────────────────────────────────────────
  async function handleShare() {
    if (!flight) return;
    setSharing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const uri = await (shareRef.current as unknown as { capture: () => Promise<string> }).capture();
      const available = await Sharing.isAvailableAsync();
      if (available) {
        await Sharing.shareAsync(uri, {
          mimeType: "image/png",
          dialogTitle: `Share ${flight.flightCode} — ${flight.departureAirport} to ${flight.arrivalAirport}`,
        });
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else {
        const { status } = await MediaLibrary.requestPermissionsAsync();
        if (status === "granted") {
          await MediaLibrary.saveToLibraryAsync(uri);
          Alert.alert("Saved!", "Flight card saved to your camera roll.");
        }
      }
    } catch (e) {
      console.error("Share failed:", e);
      Alert.alert("Error", "Could not share this flight. Please try again.");
    } finally {
      setSharing(false);
    }
  }

  // ─── Add to Calendar ─────────────────────────────────────────────────────
  async function handleAddToCalendar() {
    if (!flight) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setAddingCalendar(true);
    try {
      const ok = await addFlightToCalendar(flight);
      if (ok) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert(
          "Added to Calendar ✓",
          `${flight.flightCode} · ${flight.departureAirport} → ${flight.arrivalAirport} has been added to your calendar with a 1-hour reminder.`,
        );
      } else {
        Alert.alert(
          "Permission Required",
          "Please allow calendar access in your device Settings to add this flight.",
        );
      }
    } catch (e) {
      console.error("Calendar add failed:", e);
      Alert.alert("Error", "Could not add to calendar. Please try again.");
    } finally {
      setAddingCalendar(false);
    }
  }

  // ─── Per-flight reminder toggle ──────────────────────────────────────────
  async function handleReminderToggle(offset: ReminderOffset, currentlyOn: boolean) {
    Haptics.selectionAsync();
    setTogglingOffset(offset);
    try {
      if (currentlyOn) {
        await cancelFlightReminder(flight.id, offset);
      } else {
        const granted = await requestNotificationPermission();
        if (!granted) {
          Alert.alert(
            "Permission Required",
            "Please enable notifications for Logbook in your device Settings.",
          );
          return;
        }
        const result = await scheduleFlightReminder(flight, offset);
        if (!result) {
          Alert.alert("Too late", "This reminder time has already passed.");
          return;
        }
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      await refreshReminders();
    } finally {
      setTogglingOffset(null);
    }
  }

  const isDelayed   = flight.status === "delayed";
  const co2Trees    = (flight.co2Kg / 21).toFixed(1);
  const avgSpeedMph = flight.durationMinutes > 0
    ? Math.round((flight.distanceMiles / flight.durationMinutes) * 60)
    : 0;

  const scheduledDuration = formatHours(flight.durationMinutes);
  const actualBlockMins   = computeActualBlockMinutes(
    flight.departureTime,
    flight.arrivalTime,
    flight.departureAirport,
    flight.arrivalAirport,
    flight.date,
  );
  const actualDuration = actualBlockMins !== null ? formatHours(actualBlockMins) : null;

  const statusColor = isUpcoming ? C.accent : isDelayed ? C.red : C.green;
  const statusLabel = isUpcoming ? "Upcoming" : isDelayed ? `Delayed +${flight.delayMinutes} min` : "Completed";
  const airlineInfo = getAirlineInfo(flight.airlineCode);

  return (
    <View style={{ flex: 1, backgroundColor: C.bg, paddingTop: topPad }}>
      <ViewShot ref={shareRef} options={{ format: "png", quality: 1.0 }} style={{ position: "absolute", left: -9999, top: 0 }}>
        <FlightShareCard flight={flight} />
      </ViewShot>

      {/* ─── Nav bar ─── */}
      <View style={{
        flexDirection: "row", alignItems: "center", justifyContent: "space-between",
        paddingHorizontal: 16, paddingTop: 8, paddingBottom: 10,
        borderBottomWidth: 1, borderBottomColor: C.border,
      }}>
        <Pressable onPress={() => router.back()} style={{
          width: 40, height: 40, alignItems: "center", justifyContent: "center",
          borderRadius: 20, backgroundColor: C.card, borderWidth: 1, borderColor: C.border,
        }} hitSlop={8}>
          <Ionicons name="chevron-back" size={22} color={C.text} />
        </Pressable>
        <View style={{ flex: 1, alignItems: "center", paddingHorizontal: 12 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 5, marginBottom: 2 }}>
            <AirlineLogo logoUrl={airlineInfo.logoUrl} color={airlineInfo.color} size={18} />
            <Text style={{ fontSize: 11, color: C.textSec, fontFamily: "DMSans_400Regular", letterSpacing: 0.5, textTransform: "uppercase" }}>{flight.airline}</Text>
          </View>
          <Text style={{ fontSize: 16, color: C.text, fontFamily: "DMSans_700Bold" }}>
            {flight.departureAirport}{" → "}{flight.arrivalAirport}
          </Text>
        </View>
        <Pressable
          onPress={handleShare}
          disabled={sharing}
          style={({ pressed }) => [{
            width: 40, height: 40, alignItems: "center", justifyContent: "center",
            borderRadius: 20, backgroundColor: C.card, borderWidth: 1, borderColor: C.border,
          }, { opacity: sharing || pressed ? 0.7 : 1 }]}
          hitSlop={8}
        >
          {sharing
            ? <ActivityIndicator size="small" color={C.accent} />
            : <Ionicons name="share-outline" size={20} color={C.accent} />}
        </Pressable>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: bottomPad }}
        contentInsetAdjustmentBehavior="automatic"
      >
        {/* ─── HERO CARD ─── */}
        <Animated.View entering={FadeInDown.delay(0).springify()} style={{
          backgroundColor: C.card, borderRadius: 20,
          borderWidth: 1, borderColor: C.border,
          padding: 20, marginBottom: 14,
        }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
            <Text style={{ fontSize: 14, color: C.textSec, fontFamily: "DMSans_700Bold", letterSpacing: 1.2, textTransform: "uppercase" }}>{flight.flightCode}</Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flexShrink: 1 }}>
              <View style={[{
                flexDirection: "row", alignItems: "center", gap: 5,
                paddingHorizontal: 10, paddingVertical: 5,
                borderRadius: 20, borderWidth: 1,
              }, { backgroundColor: statusColor + "18", borderColor: statusColor + "50" }]}>
                <View style={{ width: 5, height: 5, borderRadius: 2.5, backgroundColor: statusColor }} />
                <Text style={{ fontSize: 11, fontFamily: "DMSans_500Medium", color: statusColor }}>{statusLabel}</Text>
              </View>
              {flight.verified && (
                <View style={{
                  flexDirection: "row", alignItems: "center", gap: 3,
                  backgroundColor: C.accentDim, borderWidth: 1, borderColor: C.accent + "40",
                  paddingHorizontal: 7, paddingVertical: 4, borderRadius: 10,
                }}>
                  <Ionicons name="checkmark-circle" size={13} color={C.accent} />
                  <Text style={{ fontSize: 10, color: C.accent, fontFamily: "DMSans_500Medium" }}>Verified</Text>
                </View>
              )}
            </View>
          </View>

          {/* Route */}
          <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 18 }}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={{ fontSize: 38, color: C.text, fontFamily: "DMSans_700Bold", lineHeight: 44 }}>{flight.departureAirport}</Text>
              <Text style={{ fontSize: 12, color: C.textSec, fontFamily: "DMSans_400Regular", marginTop: 4 }} numberOfLines={1}>{flight.departureCity}</Text>
            </View>
            <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 6 }}>
              <View style={{ width: 20, height: 1.5, backgroundColor: C.border }} />
              <View style={{
                width: 38, height: 38, borderRadius: 19,
                alignItems: "center", justifyContent: "center", marginHorizontal: 4,
                backgroundColor: C.accentDim, borderWidth: 1, borderColor: C.border,
              }}>
                <Ionicons name="airplane" size={18} color={C.accent} />
              </View>
              <View style={{ width: 20, height: 1.5, backgroundColor: C.border }} />
            </View>
            <View style={{ flex: 1, minWidth: 0, alignItems: "flex-end" }}>
              <Text style={{ fontSize: 38, color: C.text, fontFamily: "DMSans_700Bold", lineHeight: 44 }}>{flight.arrivalAirport}</Text>
              <Text style={{ fontSize: 12, color: C.textSec, fontFamily: "DMSans_400Regular", marginTop: 4, textAlign: "right" }} numberOfLines={1}>{flight.arrivalCity}</Text>
            </View>
          </View>

          {/* Times */}
          <View style={{
            flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start",
            paddingTop: 16, borderTopWidth: 1, borderTopColor: C.border, marginBottom: 16,
          }}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={{ fontSize: 22, color: C.text, fontFamily: "DMSans_700Bold" }}>{flight.departureTime}</Text>
              {(flight.departureTerminal || flight.departureGate) ? (
                <Text style={{ fontSize: 10, color: C.textMuted, fontFamily: "DMSans_400Regular", marginTop: 3 }} numberOfLines={1}>
                  {[flight.departureTerminal ? `T${flight.departureTerminal}` : null, flight.departureGate ? `Gate ${flight.departureGate}` : null].filter(Boolean).join(" · ")}
                </Text>
              ) : null}
            </View>
            <View style={{ flex: 1, alignItems: "center", paddingTop: 2 }}>
              {actualDuration !== null ? (
                <>
                  <Text style={{ fontSize: 12, color: C.text, fontFamily: "DMSans_600SemiBold", marginBottom: 1 }}>{actualDuration}</Text>
                  <Text style={{ fontSize: 10, color: C.textMuted, fontFamily: "DMSans_400Regular", marginBottom: 1 }}>{scheduledDuration} scheduled</Text>
                </>
              ) : (
                <Text style={{ fontSize: 12, color: C.textSec, fontFamily: "DMSans_400Regular", marginBottom: 2 }}>{scheduledDuration}</Text>
              )}
              <Text style={{ fontSize: 11, color: C.textMuted, fontFamily: "DMSans_400Regular" }}>{formatDateShort(flight.date)}</Text>
            </View>
            <View style={{ flex: 1, minWidth: 0, alignItems: "flex-end" }}>
              <Text style={{ fontSize: 22, color: C.text, fontFamily: "DMSans_700Bold" }}>{flight.arrivalTime}</Text>
              <Text style={{ fontSize: 10, color: C.textSec, fontFamily: "DMSans_400Regular", marginTop: 2, letterSpacing: 0.3 }}>local time</Text>
              {(flight.arrivalTerminal || flight.arrivalGate) ? (
                <Text style={{ fontSize: 10, color: C.textMuted, fontFamily: "DMSans_400Regular", marginTop: 3 }} numberOfLines={1}>
                  {[flight.arrivalTerminal ? `T${flight.arrivalTerminal}` : null, flight.arrivalGate ? `Gate ${flight.arrivalGate}` : null].filter(Boolean).join(" · ")}
                </Text>
              ) : null}
            </View>
          </View>

          {/* Airline row */}
          <View style={{
            flexDirection: "row", alignItems: "center", justifyContent: "space-between",
            paddingTop: 14, borderTopWidth: 1, borderTopColor: C.border, gap: 12,
          }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flex: 1, minWidth: 0 }}>
              <AirlineLogo logoUrl={airlineInfo.logoUrl} color={airlineInfo.color} size={32} />
              <Text style={{ fontSize: 13, color: C.text, fontFamily: "DMSans_500Medium", flexShrink: 1 }} numberOfLines={1}>{flight.airline}</Text>
            </View>
            <Text style={{ fontSize: 12, color: C.textSec, fontFamily: "DMSans_400Regular", flexShrink: 1, textAlign: "right" }} numberOfLines={1} ellipsizeMode="tail">
              {flight.aircraft}
            </Text>
          </View>
        </Animated.View>

        {/* ─── QUICK ACTION BAR ─── */}
        <Animated.View entering={FadeInDown.delay(60).springify()} style={{
          flexDirection: "row", gap: 10, marginBottom: 20,
        }}>
          {/* Share */}
          <Pressable
            onPress={handleShare}
            disabled={sharing}
            style={({ pressed }) => [{
              flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
              gap: 8, paddingVertical: 14, borderRadius: 14,
              backgroundColor: C.accent,
            }, { opacity: sharing || pressed ? 0.78 : 1 }]}
          >
            {sharing
              ? <ActivityIndicator size="small" color={C.white} />
              : <Ionicons name="share-social-outline" size={18} color={C.white} />}
            <Text style={{ fontSize: 14, color: C.white, fontFamily: "DMSans_700Bold" }}>Share</Text>
          </Pressable>

          {/* Add to Calendar — upcoming & native only */}
          {isUpcoming && Platform.OS !== "web" && (
            <Pressable
              onPress={handleAddToCalendar}
              disabled={addingCalendar}
              style={({ pressed }) => [{
                flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
                gap: 8, paddingVertical: 14, borderRadius: 14,
                backgroundColor: C.card, borderWidth: 1, borderColor: C.border,
              }, { opacity: addingCalendar || pressed ? 0.78 : 1 }]}
            >
              {addingCalendar
                ? <ActivityIndicator size="small" color={C.accent} />
                : <Ionicons name="calendar-outline" size={18} color={C.accent} />}
              <Text style={{ fontSize: 14, color: C.accent, fontFamily: "DMSans_700Bold" }}>
                {addingCalendar ? "Adding…" : "Add to Calendar"}
              </Text>
            </Pressable>
          )}
        </Animated.View>

        {/* ─── STATS ROW ─── */}
        <Animated.View entering={FadeInDown.delay(80).springify()} style={{
          backgroundColor: C.card, borderRadius: 16, flexDirection: "row",
          marginBottom: 24, borderWidth: 1, borderColor: C.border, overflow: "hidden",
        }}>
          <View style={{ flex: 1, alignItems: "center", paddingVertical: 18, gap: 4, paddingHorizontal: 4 }}>
            <Ionicons name="navigate-outline" size={18} color={C.accent} />
            <Text style={{ fontSize: 15, color: C.text, fontFamily: "DMSans_700Bold" }} adjustsFontSizeToFit numberOfLines={1}>{flight.distanceMiles.toLocaleString()}</Text>
            <Text style={{ fontSize: 10, color: C.textSec, fontFamily: "DMSans_400Regular" }}>miles</Text>
          </View>
          <View style={{ width: 1, backgroundColor: C.border, marginVertical: 12 }} />
          <View style={{ flex: 1, alignItems: "center", paddingVertical: 18, gap: 4, paddingHorizontal: 4 }}>
            <Ionicons name="speedometer-outline" size={18} color={C.amber} />
            <Text style={{ fontSize: 15, color: C.text, fontFamily: "DMSans_700Bold" }}>{avgSpeedMph}</Text>
            <Text style={{ fontSize: 10, color: C.textSec, fontFamily: "DMSans_400Regular" }}>mph avg</Text>
          </View>
          <View style={{ width: 1, backgroundColor: C.border, marginVertical: 12 }} />
          <View style={{ flex: 1, alignItems: "center", paddingVertical: 18, gap: 4, paddingHorizontal: 4 }}>
            <Ionicons name="leaf-outline" size={18} color={C.green} />
            <Text style={{ fontSize: 15, color: C.text, fontFamily: "DMSans_700Bold" }} adjustsFontSizeToFit numberOfLines={1}>{flight.co2Kg}</Text>
            <Text style={{ fontSize: 10, color: C.textSec, fontFamily: "DMSans_400Regular" }}>kg CO₂</Text>
          </View>
          <View style={{ width: 1, backgroundColor: C.border, marginVertical: 12 }} />
          <View style={{ flex: 1, alignItems: "center", paddingVertical: 18, gap: 4, paddingHorizontal: 4 }}>
            <Ionicons name="time-outline" size={18} color={C.textSec} />
            <Text style={{ fontSize: 15, color: C.text, fontFamily: "DMSans_700Bold" }} adjustsFontSizeToFit numberOfLines={1}>
              {actualBlockMins !== null ? formatHours(actualBlockMins) : formatHours(flight.durationMinutes)}
            </Text>
            <Text style={{ fontSize: 10, color: C.textSec, fontFamily: "DMSans_400Regular" }}>duration</Text>
          </View>
        </Animated.View>

        {/* ─── REMINDERS (upcoming flights only, native only) ─── */}
        {isUpcoming && Platform.OS !== "web" && (
          <Animated.View entering={FadeInDown.delay(120).springify()} style={{ marginBottom: 16 }}>
            <Text style={{ fontSize: 12, color: C.textSec, fontFamily: "DMSans_500Medium", letterSpacing: 0.8, textTransform: "uppercase", marginBottom: 10 }}>Reminders</Text>
            <View style={{ backgroundColor: C.card, borderRadius: 16, borderWidth: 1, borderColor: C.border, overflow: "hidden" }}>
              {REMINDER_OFFSETS.map((offset, i) => {
                const isOn      = scheduled.has(offset);
                const isDefault = notifPrefs.enabled && notifPrefs.offsets.includes(offset);
                const isLast    = i === REMINDER_OFFSETS.length - 1;
                const toggling  = togglingOffset === offset;
                return (
                  <Pressable
                    key={offset}
                    onPress={() => !toggling && handleReminderToggle(offset, isOn)}
                    style={({ pressed }) => [{
                      flexDirection: "row", alignItems: "center",
                      paddingHorizontal: 16, paddingVertical: 14,
                      gap: 12,
                      backgroundColor: pressed ? C.surface : C.card,
                    },
                    !isLast && { borderBottomWidth: 1, borderBottomColor: C.border },
                    ]}
                  >
                    <View style={{
                      width: 34, height: 34, borderRadius: 9,
                      backgroundColor: isOn ? C.accentDim : C.surface,
                      alignItems: "center", justifyContent: "center",
                    }}>
                      {toggling
                        ? <ActivityIndicator size="small" color={C.accent} />
                        : <Ionicons name={isOn ? "notifications" : "notifications-outline"} size={18} color={isOn ? C.accent : C.textMuted} />}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 14, color: C.text, fontFamily: isOn ? "DMSans_600SemiBold" : "DMSans_400Regular" }}>
                        {OFFSET_LABEL_MAP[offset]}
                      </Text>
                      {isDefault && !isOn && (
                        <Text style={{ fontSize: 11, color: C.textMuted, fontFamily: "DMSans_400Regular", marginTop: 1 }}>
                          Default — not yet scheduled
                        </Text>
                      )}
                    </View>
                    <View style={[{
                      paddingHorizontal: 10, paddingVertical: 4,
                      borderRadius: 20, borderWidth: 1,
                    },
                    isOn
                      ? { backgroundColor: C.accentDim, borderColor: C.accent + "55" }
                      : { backgroundColor: C.surface,   borderColor: C.border },
                    ]}>
                      <Text style={{
                        fontSize: 11, fontFamily: "DMSans_600SemiBold",
                        color: isOn ? C.accent : C.textMuted,
                      }}>
                        {isOn ? "On" : "Off"}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>
            <Text style={{ fontSize: 11, color: C.textMuted, fontFamily: "DMSans_400Regular", marginTop: 8, lineHeight: 16, paddingHorizontal: 2 }}>
              Reminders are local to this device. Manage default settings in your Profile.
            </Text>
          </Animated.View>
        )}

        {/* ─── FLIGHT INFO ─── */}
        <Animated.View entering={FadeInDown.delay(isUpcoming ? 160 : 120).springify()} style={{ marginBottom: 16 }}>
          <Text style={{ fontSize: 12, color: C.textSec, fontFamily: "DMSans_500Medium", letterSpacing: 0.8, textTransform: "uppercase", marginBottom: 10 }}>Flight Info</Text>
          <View style={{ backgroundColor: C.card, borderRadius: 16, paddingHorizontal: 16, borderWidth: 1, borderColor: C.border }}>
            <InfoRow label="Airline" value={flight.airline} />
            <InfoRow label="Flight" value={flight.flightCode} />
            <InfoRow label="Aircraft" value={flight.aircraft} />
            {flight.tailNumber ? <InfoRow label="Tail Number" value={flight.tailNumber} /> : null}
            <InfoRow label="Date" value={formatDate(flight.date)} />
            <InfoRow
              label="Departure"
              value={`${flight.departureAirport}  ·  ${flight.departureTime}${flight.departureTerminal ? `  ·  T${flight.departureTerminal}` : ""}${flight.departureGate ? `  ·  Gate ${flight.departureGate}` : ""}`}
            />
            <InfoRow
              label="Arrival"
              value={`${flight.arrivalAirport}  ·  ${flight.arrivalTime} (local)${flight.arrivalTerminal ? `  ·  T${flight.arrivalTerminal}` : ""}${flight.arrivalGate ? `  ·  Gate ${flight.arrivalGate}` : ""}`}
            />
            {actualDuration !== null && (
              <InfoRow label="Block Time" value={`${actualDuration} (tz-corrected)  ·  ${scheduledDuration} scheduled`} />
            )}
            <InfoRow
              label="Distance"
              value={`${flight.distanceMiles.toLocaleString()} mi  ·  ${Math.round(flight.distanceMiles * 1.60934).toLocaleString()} km`}
            />
            {avgSpeedMph > 0 && (
              <InfoRow label="Avg Speed" value={`${avgSpeedMph} mph  ·  ${Math.round(avgSpeedMph * 1.60934)} km/h`} />
            )}
          </View>
        </Animated.View>

        {/* ─── ENV IMPACT ─── */}
        <Animated.View entering={FadeInDown.delay(isUpcoming ? 200 : 160).springify()} style={{ marginBottom: 16 }}>
          <Text style={{ fontSize: 12, color: C.textSec, fontFamily: "DMSans_500Medium", letterSpacing: 0.8, textTransform: "uppercase", marginBottom: 10 }}>Environmental Impact</Text>
          <View style={{ backgroundColor: C.card, borderRadius: 16, paddingHorizontal: 16, borderWidth: 1, borderColor: C.border }}>
            <InfoRow label="CO₂ Emitted" value={`${flight.co2Kg} kg`} accent={C.green} />
            <InfoRow label="Tree equivalent" value={`${co2Trees} trees / year to offset`} />
          </View>
        </Animated.View>

        {/* ─── SHARE (full section, scroll-to convenience) ─── */}
        <Animated.View entering={FadeInDown.delay(isUpcoming ? 240 : 200).springify()} style={{ marginBottom: 8 }}>
          <Text style={{ fontSize: 12, color: C.textSec, fontFamily: "DMSans_500Medium", letterSpacing: 0.8, textTransform: "uppercase", marginBottom: 10 }}>Share This Flight</Text>
          <Pressable
            onPress={handleShare}
            disabled={sharing}
            style={({ pressed }) => [{
              backgroundColor: C.accent, borderRadius: 14, padding: 17,
              flexDirection: "row", alignItems: "center", justifyContent: "center",
              gap: 10, marginBottom: 10,
            }, { opacity: sharing || pressed ? 0.75 : 1 }]}
          >
            {sharing
              ? <ActivityIndicator size="small" color={C.white} />
              : (
                <>
                  <Ionicons name="share-social-outline" size={20} color={C.white} />
                  <Text style={{ fontSize: 16, color: C.white, fontFamily: "DMSans_700Bold" }}>Share with friends</Text>
                </>
              )}
          </Pressable>
          <Text style={{ fontSize: 12, color: C.textSec, fontFamily: "DMSans_400Regular", textAlign: "center", lineHeight: 17 }}>
            Generates a boarding-pass style card — share to Instagram, WhatsApp, and more.
          </Text>
        </Animated.View>
      </ScrollView>
    </View>
  );
}
