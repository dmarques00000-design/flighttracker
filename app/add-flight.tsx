import React, { useState, useEffect, useCallback } from "react";
import {
  View, Text, TextInput, Pressable,
  ActivityIndicator, ScrollView, Platform, Alert, KeyboardAvoidingView,
  AppState, AppStateStatus,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as Network from "expo-network";
import Animated, { FadeInDown, FadeIn } from "react-native-reanimated";
import { useColors } from "@/constants/colors";
import { useFlights } from "@/context/flights";
import { apiRequest } from "@/lib/query-client";
import { getRateLimiter, formatRetryAfter } from "@/lib/rate-limiter";
import { DatePicker } from "@/components/DatePicker";

const lookupLimiter = getRateLimiter("flight-lookup", { maxCalls: 5, windowMs: 60_000 });
export const percentileLimiter = getRateLimiter("percentile", { maxCalls: 10, windowMs: 60_000 });

// ─── Error types ────────────────────────────────────────────────────────────
type LookupErrorKind = "offline" | "server" | "timeout" | "not_found" | "invalid_input" | "rate_limit" | "unknown";

interface LookupError {
  kind: LookupErrorKind;
  message: string;
  retryable: boolean;
}

function classifyError(err: unknown, isOnline: boolean): LookupError {
  if (!isOnline) return { kind: "offline",  message: "You\'re offline. Check your connection and try again.", retryable: true };
  const msg = err instanceof Error ? err.message : String(err);
  if (msg.includes("AbortError") || msg.toLowerCase().includes("timeout"))
    return { kind: "timeout",  message: "The server took too long to respond. It may be temporarily down — try again in a moment.", retryable: true };
  if (msg.startsWith("404"))
    return { kind: "not_found", message: "Flight not found. Double-check the code and date.", retryable: false };
  if (msg.startsWith("5") || msg.includes("Failed to fetch") || msg.includes("Network request failed") || msg.includes("ERR_CONNECTION_REFUSED"))
    return { kind: "server",   message: "Our server is unreachable right now. Please try again shortly.", retryable: true };
  return { kind: "unknown",   message: "Could not look up that flight. Please check the code and date.", retryable: true };
}

// ─── Network hook ────────────────────────────────────────────────────────────
function useIsOnline(): boolean {
  const [online, setOnline] = useState(true);
  const check = useCallback(async () => {
    try {
      const state = await Network.getNetworkStateAsync();
      setOnline(state.isInternetReachable !== false);
    } catch { setOnline(true); }
  }, []);
  useEffect(() => {
    check();
    const sub = AppState.addEventListener("change", (s: AppStateStatus) => { if (s === "active") check(); });
    return () => sub.remove();
  }, [check]);
  return online;
}

// ─── Validation ──────────────────────────────────────────────────────────────
function sanitiseFlightCode(raw: string): { value: string; error: string | null } {
  const value = raw.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (!value) return { value: "", error: "Please enter a flight code (e.g. LX2819)" };
  if (value.length < 3 || value.length > 8) return { value, error: "Flight code must be 3–8 characters (e.g. LX2819, BA456)" };
  if (!/^[A-Z]{2,3}\d{1,4}$/.test(value)) return { value, error: "Invalid format — use IATA code + flight number (e.g. LX2819)" };
  return { value, error: null };
}
function sanitiseDate(raw: string): { value: string; error: string | null } {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return { value: raw, error: "Invalid date format" };
  const d = new Date(raw + "T00:00:00");
  if (isNaN(d.getTime())) return { value: raw, error: "Invalid date" };
  const maxFuture = new Date(); maxFuture.setFullYear(maxFuture.getFullYear() + 1);
  if (d > maxFuture) return { value: raw, error: "Date cannot be more than 1 year in the future" };
  if (d < new Date("2000-01-01T00:00:00")) return { value: raw, error: "Date is too far in the past" };
  return { value: raw, error: null };
}

// ─── Types ───────────────────────────────────────────────────────────────────
interface FlightLookupResult {
  flightCode: string; date: string; airline: string; airlineCode: string;
  departureAirport: string; arrivalAirport: string; departureCity: string; arrivalCity: string;
  departureTime: string; arrivalTime: string; durationMinutes: number;
  distanceMiles: number; co2Kg: number; status: "on_time" | "delayed";
  delayMinutes: number; aircraft: string; isMock?: boolean;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function formatHours(minutes: number): string {
  const h = Math.floor(minutes / 60); const m = minutes % 60;
  if (h === 0) return `${m}m`; if (m === 0) return `${h}h`; return `${h}h ${m}m`;
}
function todayStr(): string { return new Date().toISOString().substring(0, 10); }
function formatDate(str: string): string {
  try {
    const [y, m, d] = str.split("-").map(Number);
    return new Date(y, m - 1, d).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
  } catch { return str; }
}

// ─── Error banner ─────────────────────────────────────────────────────────────
function ErrorBanner({ err, onRetry, C }: { err: LookupError; onRetry: () => void; C: ReturnType<typeof useColors> }) {
  const iconMap: Record<LookupErrorKind, string> = {
    offline:       "wifi-outline",
    server:        "cloud-offline-outline",
    timeout:       "time-outline",
    not_found:     "search-outline",
    invalid_input: "alert-circle-outline",
    rate_limit:    "warning-outline",
    unknown:       "alert-circle-outline",
  };
  return (
    <Animated.View entering={FadeIn} style={{ borderRadius: 12, overflow: "hidden", marginBottom: 16 }}>
      <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 10, backgroundColor: C.red + "14", borderWidth: 1, borderColor: C.red + "33", borderRadius: 12, padding: 14 }}>
        <Ionicons name={iconMap[err.kind] as never} size={18} color={C.red} style={{ marginTop: 1 }} />
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 13, color: C.red, fontFamily: "DMSans_600SemiBold", marginBottom: err.retryable ? 6 : 0 }}>
            {err.kind === "offline"  ? "No internet connection" :
             err.kind === "server"   ? "Server unreachable" :
             err.kind === "timeout"  ? "Request timed out" :
             err.kind === "not_found"? "Flight not found" :
             "Something went wrong"}
          </Text>
          <Text style={{ fontSize: 12, color: C.red + "cc", fontFamily: "DMSans_400Regular", lineHeight: 17 }}>{err.message}</Text>
          {err.retryable && (
            <Pressable onPress={onRetry} style={{ alignSelf: "flex-start", marginTop: 8, flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: C.red + "20", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 }}>
              <Ionicons name="refresh-outline" size={13} color={C.red} />
              <Text style={{ fontSize: 12, color: C.red, fontFamily: "DMSans_700Bold" }}>Try Again</Text>
            </Pressable>
          )}
        </View>
      </View>
    </Animated.View>
  );
}

// ─── Screen ──────────────────────────────────────────────────────────────────
export default function AddFlightScreen() {
  const insets  = useSafeAreaInsets();
  const C       = useColors();
  const { addFlight, flights } = useFlights();
  const isOnline = useIsOnline();

  const [code, setCode]       = useState("");
  const [date, setDate]       = useState(todayStr());
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<FlightLookupResult | null>(null);
  const [lookupErr, setLookupErr] = useState<LookupError | null>(null);
  const [saving, setSaving]   = useState(false);
  const [remainingCalls, setRemainingCalls] = useState<number | null>(null);

  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;
  const topPad    = Platform.OS === "web" ? 67 : insets.top + 8;

  // Show offline banner as soon as connectivity is lost
  useEffect(() => {
    if (!isOnline) setLookupErr({ kind: "offline", message: "You\'re offline. Check your connection and try again.", retryable: true });
    else if (lookupErr?.kind === "offline") setLookupErr(null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOnline]);

  const handleLookup = useCallback(async () => {
    setLookupErr(null);
    setPreview(null);

    // 1. Offline check
    if (!isOnline) {
      setLookupErr({ kind: "offline", message: "You\'re offline. Check your connection and try again.", retryable: true });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }

    // 2. Sanitise inputs
    const codeResult = sanitiseFlightCode(code);
    if (codeResult.error) { setLookupErr({ kind: "invalid_input", message: codeResult.error, retryable: false }); return; }
    const dateResult = sanitiseDate(date);
    if (dateResult.error) { setLookupErr({ kind: "invalid_input", message: dateResult.error, retryable: false }); return; }

    // 3. Rate limit
    const limit = await lookupLimiter.check();
    setRemainingCalls(limit.remainingCalls - 1);
    if (!limit.allowed) {
      setLookupErr({ kind: "rate_limit", message: `Too many lookups — please wait ${formatRetryAfter(limit.retryAfterMs)} before trying again.`, retryable: false });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }

    setLoading(true);
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      await lookupLimiter.consume();
      const res  = await apiRequest("GET", `/api/flights/lookup?code=${encodeURIComponent(codeResult.value)}&date=${encodeURIComponent(dateResult.value)}`);
      const data = (await res.json()) as FlightLookupResult;
      setPreview(data);
      const updated = await lookupLimiter.check();
      setRemainingCalls(updated.remainingCalls);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err) {
      const classified = classifyError(err, isOnline);
      setLookupErr(classified);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setLoading(false);
    }
  }, [code, date, isOnline]);

  async function handleSave() {
    if (!preview) return;
    setSaving(true);
    try {
      const isDuplicate = flights.some((f) => f.flightCode === preview.flightCode && f.date === preview.date);
      if (isDuplicate) {
        setLookupErr({ kind: "unknown", message: "This flight has already been added to your logbook.", retryable: false });
        setSaving(false);
        return;
      }
      await addFlight({
        flightCode: preview.flightCode, date: preview.date,
        airline: preview.airline, airlineCode: preview.airlineCode,
        departureAirport: preview.departureAirport, arrivalAirport: preview.arrivalAirport,
        departureCity: preview.departureCity, arrivalCity: preview.arrivalCity,
        departureTime: preview.departureTime, arrivalTime: preview.arrivalTime,
        durationMinutes: preview.durationMinutes, distanceMiles: preview.distanceMiles,
        co2Kg: preview.co2Kg, status: preview.status || "on_time",
        delayMinutes: preview.delayMinutes ?? 0, aircraft: preview.aircraft,
        verified: false, isMock: preview.isMock ?? false,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.dismissAll();
    } catch {
      Alert.alert("Error", "Could not save the flight. Please try again.");
    } finally { setSaving(false); }
  }

  const dep = preview?.departureAirport || "\u2014";
  const arr = preview?.arrivalAirport   || "\u2014";

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1, backgroundColor: C.bg }}>
      <View style={[{ flex: 1, backgroundColor: C.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20 }, { paddingTop: topPad }]}>
        <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 24, paddingBottom: bottomPad + 24 }}>

          {/* Header */}
          <Animated.View entering={FadeInDown.delay(0).springify()}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <Text style={{ fontSize: 24, color: C.text, fontFamily: "DMSans_700Bold" }}>Add Flight</Text>
              <Pressable onPress={() => router.back()} hitSlop={12}>
                <Ionicons name="close" size={24} color={C.textSec} />
              </Pressable>
            </View>
            <Text style={{ fontSize: 14, color: C.textSec, fontFamily: "DMSans_400Regular", marginBottom: 28, lineHeight: 20 }}>
              Enter your flight number and tap the date to pick it from the calendar.
            </Text>
          </Animated.View>

          {/* Offline persistent banner */}
          {!isOnline && (
            <Animated.View entering={FadeIn} style={{ flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: C.amber + "18", borderWidth: 1, borderColor: C.amber + "44", borderRadius: 12, padding: 12, marginBottom: 20 }}>
              <Ionicons name="wifi-outline" size={16} color={C.amber} />
              <Text style={{ fontSize: 13, color: C.amber, fontFamily: "DMSans_500Medium", flex: 1 }}>No internet — flight lookup unavailable</Text>
            </Animated.View>
          )}

          {/* Inputs */}
          <Animated.View entering={FadeInDown.delay(80).springify()} style={{ gap: 16, marginBottom: 24 }}>
            <View style={{ gap: 8 }}>
              <Text style={{ fontSize: 13, color: C.textSec, fontFamily: "DMSans_500Medium", letterSpacing: 0.3, textTransform: "uppercase" }}>Flight Code</Text>
              <TextInput
                style={{ backgroundColor: C.card, borderRadius: 14, padding: 16, fontSize: 17, color: C.text, fontFamily: "DMSans_500Medium", borderWidth: 1, borderColor: C.border }}
                value={code}
                onChangeText={(t) => { setCode(t.toUpperCase()); setPreview(null); setLookupErr(null); }}
                placeholder="e.g. LX2819, BA456"
                placeholderTextColor={C.textSec}
                autoCapitalize="characters"
                autoCorrect={false}
                returnKeyType="done"
                maxLength={8}
              />
            </View>
            <View style={{ gap: 8 }}>
              <Text style={{ fontSize: 13, color: C.textSec, fontFamily: "DMSans_500Medium", letterSpacing: 0.3, textTransform: "uppercase" }}>Date</Text>
              <DatePicker value={date} onChange={(d) => { setDate(d); setPreview(null); setLookupErr(null); }} />
            </View>
          </Animated.View>

          {/* Rate limit warning */}
          {remainingCalls !== null && remainingCalls <= 2 && !lookupErr && (
            <Animated.View entering={FadeIn} style={{ flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: C.amberDim, borderRadius: 10, padding: 10, marginBottom: 12 }}>
              <Ionicons name="warning-outline" size={14} color={C.amber} />
              <Text style={{ fontSize: 12, color: C.amber, fontFamily: "DMSans_500Medium", flex: 1 }}>
                {remainingCalls === 0 ? "No lookups remaining this minute." : `${remainingCalls} lookup${remainingCalls !== 1 ? "s" : ""} remaining this minute`}
              </Text>
            </Animated.View>
          )}

          {/* Error banner */}
          {lookupErr && <ErrorBanner err={lookupErr} onRetry={handleLookup} C={C} />}

          {/* Lookup button */}
          <Pressable onPress={handleLookup} disabled={loading || !isOnline}
            style={({ pressed }) => [{ backgroundColor: isOnline ? C.accent : C.textMuted, borderRadius: 14, padding: 16, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 4, opacity: loading || pressed ? 0.7 : 1 }]}>
            {loading
              ? <ActivityIndicator color={C.white} size="small" />
              : <><Ionicons name="search-outline" size={18} color={C.white} /><Text style={{ fontSize: 16, color: C.white, fontFamily: "DMSans_700Bold" }}>Look Up Flight</Text></>}
          </Pressable>

          {/* Preview card */}
          {preview && (
            <Animated.View entering={FadeInDown.springify()} style={{ backgroundColor: C.card, borderRadius: 18, padding: 20, borderWidth: 1, borderColor: C.border, marginTop: 20 }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
                <View>
                  <Text style={{ fontSize: 20, color: C.accent, fontFamily: "DMSans_700Bold" }}>{preview.flightCode}</Text>
                  <Text style={{ fontSize: 13, color: C.textSec, fontFamily: "DMSans_400Regular", marginTop: 2 }}>{preview.airline}</Text>
                </View>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  {preview.isMock && (
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: C.amberDim, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 }}>
                      <Ionicons name="sparkles-outline" size={11} color={C.amber} />
                      <Text style={{ fontSize: 11, color: C.amber, fontFamily: "DMSans_700Bold" }}>Estimated</Text>
                    </View>
                  )}
                  <View style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, backgroundColor: preview.status === "delayed" ? C.red + "22" : C.green + "22" }}>
                    <Text style={{ fontSize: 12, fontFamily: "DMSans_700Bold", color: preview.status === "delayed" ? C.red : C.green }}>
                      {preview.status === "delayed" ? `Delayed +${preview.delayMinutes}m` : "On Time"}
                    </Text>
                  </View>
                </View>
              </View>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 5, marginBottom: 14 }}>
                <Ionicons name="calendar-outline" size={13} color={C.textSec} />
                <Text style={{ fontSize: 13, color: C.textSec, fontFamily: "DMSans_400Regular" }}>{formatDate(preview.date)}</Text>
              </View>
              <View style={{ height: 1, backgroundColor: C.border, marginVertical: 14 }} />
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 28, color: C.text, fontFamily: "DMSans_700Bold" }}>{dep}</Text>
                  <Text style={{ fontSize: 12, color: C.textSec, fontFamily: "DMSans_400Regular", marginTop: 2 }}>{preview.departureCity}</Text>
                  <Text style={{ fontSize: 15, color: C.text, fontFamily: "DMSans_500Medium", marginTop: 6 }}>{preview.departureTime}</Text>
                </View>
                <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 8, flex: 1 }}>
                  <View style={{ flex: 1, height: 1, backgroundColor: C.border }} />
                  <Ionicons name="airplane" size={20} color={C.accent} />
                  <View style={{ flex: 1, height: 1, backgroundColor: C.border }} />
                </View>
                <View style={{ flex: 1, alignItems: "flex-end" }}>
                  <Text style={{ fontSize: 28, color: C.text, fontFamily: "DMSans_700Bold" }}>{arr}</Text>
                  <Text style={{ fontSize: 12, color: C.textSec, fontFamily: "DMSans_400Regular", marginTop: 2 }}>{preview.arrivalCity}</Text>
                  <Text style={{ fontSize: 15, color: C.text, fontFamily: "DMSans_500Medium", marginTop: 6 }}>{preview.arrivalTime}</Text>
                </View>
              </View>
              <View style={{ height: 1, backgroundColor: C.border, marginVertical: 14 }} />
              <View style={{ flexDirection: "row", alignItems: "center", gap: 5, marginBottom: 10 }}>
                <Ionicons name="airplane-outline" size={13} color={C.textSec} />
                <Text style={{ fontSize: 13, color: C.textSec, fontFamily: "DMSans_400Regular" }}>{preview.aircraft}</Text>
              </View>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 18 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                  <Ionicons name="time-outline" size={14} color={C.textSec} />
                  <Text style={{ fontSize: 13, color: C.textSec, fontFamily: "DMSans_500Medium" }}>{formatHours(preview.durationMinutes)}</Text>
                </View>
                <View style={{ width: 3, height: 3, borderRadius: 2, backgroundColor: C.border }} />
                <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                  <Ionicons name="navigate-outline" size={14} color={C.textSec} />
                  <Text style={{ fontSize: 13, color: C.textSec, fontFamily: "DMSans_500Medium" }}>{preview.distanceMiles.toLocaleString()} mi</Text>
                </View>
                <View style={{ width: 3, height: 3, borderRadius: 2, backgroundColor: C.border }} />
                <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                  <Ionicons name="leaf-outline" size={14} color={C.green} />
                  <Text style={{ fontSize: 13, color: C.green, fontFamily: "DMSans_500Medium" }}>{preview.co2Kg} kg CO\u2082</Text>
                </View>
              </View>
              <Pressable onPress={handleSave} disabled={saving}
                style={({ pressed }) => [{ backgroundColor: C.accent, borderRadius: 14, padding: 16, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, opacity: saving || pressed ? 0.8 : 1 }]}>
                {saving
                  ? <ActivityIndicator color={C.white} size="small" />
                  : <><Ionicons name="checkmark" size={20} color={C.white} /><Text style={{ fontSize: 16, color: C.white, fontFamily: "DMSans_700Bold" }}>Add to Logbook</Text></>}
              </Pressable>
            </Animated.View>
          )}
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
}
