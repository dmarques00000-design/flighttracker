import React, { useState } from "react";
import {
  View, Text, StyleSheet, TextInput, Pressable,
  ActivityIndicator, ScrollView, Platform, Alert, KeyboardAvoidingView,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Animated, { FadeInDown, FadeIn } from "react-native-reanimated";
import { useColors } from "@/constants/colors";
import { useFlights } from "@/context/flights";
import { apiRequest } from "@/lib/query-client";
import { getRateLimiter, formatRetryAfter } from "@/lib/rate-limiter";
import { DatePicker } from "@/components/DatePicker";

// 5 lookups per minute per device
const lookupLimiter = getRateLimiter("flight-lookup", { maxCalls: 5, windowMs: 60_000 });
// Percentile API: 10 per minute (called from home screen on every period change)
export const percentileLimiter = getRateLimiter("percentile", { maxCalls: 10, windowMs: 60_000 });

/** Strip everything except alphanumeric characters and validate basic format */
function sanitiseFlightCode(raw: string): { value: string; error: string | null } {
  const value = raw.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (!value) return { value: "", error: "Please enter a flight code (e.g. LX2819)" };
  if (value.length < 3 || value.length > 8) return { value, error: "Flight code must be 3–8 characters (e.g. LX2819, BA456)" };
  // Must start with 2 letters (IATA airline code) followed by 1–4 digits
  if (!/^[A-Z]{2,3}\d{1,4}$/.test(value)) return { value, error: "Invalid format — use IATA code + flight number (e.g. LX2819)" };
  return { value, error: null };
}

/** Validate date is YYYY-MM-DD and not suspiciously far in the future */
function sanitiseDate(raw: string): { value: string; error: string | null } {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return { value: raw, error: "Invalid date format" };
  const d = new Date(raw + "T00:00:00");
  if (isNaN(d.getTime())) return { value: raw, error: "Invalid date" };
  const maxFuture = new Date(); maxFuture.setFullYear(maxFuture.getFullYear() + 1);
  if (d > maxFuture) return { value: raw, error: "Date cannot be more than 1 year in the future" };
  const minPast = new Date("2000-01-01T00:00:00");
  if (d < minPast) return { value: raw, error: "Date is too far in the past" };
  return { value: raw, error: null };
}

interface FlightLookupResult {
  flightCode: string; date: string; airline: string; airlineCode: string;
  departureAirport: string; arrivalAirport: string; departureCity: string; arrivalCity: string;
  departureTime: string; arrivalTime: string; durationMinutes: number;
  distanceMiles: number; co2Kg: number; status: "on_time" | "delayed";
  delayMinutes: number; aircraft: string; isMock?: boolean;
}

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

export default function AddFlightScreen() {
  const insets = useSafeAreaInsets();
  const C = useColors();
  const { addFlight, flights } = useFlights();

  const [code, setCode]       = useState("");
  const [date, setDate]       = useState(todayStr());
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<FlightLookupResult | null>(null);
  const [error, setError]     = useState("");
  const [saving, setSaving]   = useState(false);
  const [remainingCalls, setRemainingCalls] = useState<number | null>(null);

  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;
  const topPad    = Platform.OS === "web" ? 67 : insets.top + 8;

  async function handleLookup() {
    setError("");
    setPreview(null);

    // 1. Sanitise inputs
    const codeResult = sanitiseFlightCode(code);
    if (codeResult.error) { setError(codeResult.error); return; }
    const dateResult = sanitiseDate(date);
    if (dateResult.error) { setError(dateResult.error); return; }

    // 2. Check rate limit
    const limit = await lookupLimiter.check();
    setRemainingCalls(limit.remainingCalls - 1);
    if (!limit.allowed) {
      setError(`Too many lookups — please wait ${formatRetryAfter(limit.retryAfterMs)} before trying again.`);
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
      // Update remaining after consume
      const updated = await lookupLimiter.check();
      setRemainingCalls(updated.remainingCalls);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      setError("Could not look up that flight. Please check the code and date.");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    if (!preview) return;
    setSaving(true);
    try {
      const isDuplicate = flights.some((f) => f.flightCode === preview.flightCode && f.date === preview.date);
      if (isDuplicate) { setError("This flight has already been added to your logbook."); setSaving(false); return; }
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

          <Animated.View entering={FadeInDown.delay(80).springify()} style={{ gap: 16, marginBottom: 24 }}>
            <View style={{ gap: 8 }}>
              <Text style={{ fontSize: 13, color: C.textSec, fontFamily: "DMSans_500Medium", letterSpacing: 0.3, textTransform: "uppercase" }}>Flight Code</Text>
              <TextInput
                style={{ backgroundColor: C.card, borderRadius: 14, padding: 16, fontSize: 17, color: C.text, fontFamily: "DMSans_500Medium", borderWidth: 1, borderColor: C.border }}
                value={code}
                onChangeText={(t) => { setCode(t.toUpperCase()); setPreview(null); }}
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
              <DatePicker value={date} onChange={(d) => { setDate(d); setPreview(null); }} />
            </View>
          </Animated.View>

          {/* Rate limit indicator */}
          {remainingCalls !== null && remainingCalls <= 2 && (
            <Animated.View entering={FadeIn} style={{ flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: C.amberDim, borderRadius: 10, padding: 10, marginBottom: 12 }}>
              <Ionicons name="warning-outline" size={14} color={C.amber} />
              <Text style={{ fontSize: 12, color: C.amber, fontFamily: "DMSans_500Medium", flex: 1 }}>
                {remainingCalls === 0 ? "No lookups remaining this minute." : `${remainingCalls} lookup${remainingCalls !== 1 ? "s" : ""} remaining this minute`}
              </Text>
            </Animated.View>
          )}

          {error ? (
            <Animated.View entering={FadeIn} style={{ flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: C.red + "18", borderRadius: 10, padding: 12, marginBottom: 16 }}>
              <Ionicons name="alert-circle-outline" size={16} color={C.red} />
              <Text style={{ fontSize: 13, color: C.red, fontFamily: "DMSans_400Regular", flex: 1 }}>{error}</Text>
            </Animated.View>
          ) : null}

          <Pressable onPress={handleLookup} disabled={loading}
            style={({ pressed }) => [{ backgroundColor: C.accent, borderRadius: 14, padding: 16, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 4, opacity: loading || pressed ? 0.7 : 1 }]}>
            {loading
              ? <ActivityIndicator color={C.white} size="small" />
              : <><Ionicons name="search-outline" size={18} color={C.white} /><Text style={{ fontSize: 16, color: C.white, fontFamily: "DMSans_700Bold" }}>Look Up Flight</Text></>}
          </Pressable>

          {preview && (
            <Animated.View entering={FadeInDown.springify()} style={{ backgroundColor: C.card, borderRadius: 18, padding: 20, borderWidth: 1, borderColor: C.border, marginTop: 20 }}>
              {/* Header */}
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
              {/* Date */}
              <View style={{ flexDirection: "row", alignItems: "center", gap: 5, marginBottom: 14 }}>
                <Ionicons name="calendar-outline" size={13} color={C.textSec} />
                <Text style={{ fontSize: 13, color: C.textSec, fontFamily: "DMSans_400Regular" }}>{formatDate(preview.date)}</Text>
              </View>
              <View style={{ height: 1, backgroundColor: C.border, marginVertical: 14 }} />
              {/* Route */}
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
              {/* Meta */}
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
