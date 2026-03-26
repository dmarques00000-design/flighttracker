import React, { useState, useEffect, useCallback } from "react";
import {
  View, Text, Pressable, Image,
  ActivityIndicator, ScrollView, Platform, Alert, KeyboardAvoidingView,
  AppState, AppStateStatus, TextInput,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Animated, { FadeInDown, FadeIn, Layout } from "react-native-reanimated";
import { useColors } from "@/constants/colors";
import { useFlights } from "@/context/flights";
import { apiRequest } from "@/lib/query-client";
import { getRateLimiter, formatRetryAfter } from "@/lib/rate-limiter";
import { DatePicker } from "@/components/DatePicker";
import { AirportInput } from "@/components/AirportInput";

const lookupLimiter = getRateLimiter("flight-lookup", { maxCalls: 5, windowMs: 60_000 });
export const percentileLimiter = getRateLimiter("percentile", { maxCalls: 10, windowMs: 60_000 });

// ─── Search mode ─────────────────────────────────────────────────────────────
type SearchMode = "code" | "airport";

// ─── Error types ─────────────────────────────────────────────────────────────
type LookupErrorKind = "offline" | "server" | "timeout" | "not_found" | "invalid_input" | "rate_limit" | "unknown";

interface LookupError {
  kind: LookupErrorKind;
  message: string;
  retryable: boolean;
}

function classifyError(err: unknown, isOnline: boolean): LookupError {
  if (!isOnline) return { kind: "offline",  message: "You're offline. Check your connection and try again.", retryable: true };
  const msg = err instanceof Error ? err.message : String(err);
  if (msg.includes("AbortError") || msg.toLowerCase().includes("timeout"))
    return { kind: "timeout",  message: "The server took too long to respond. It may be temporarily down — try again in a moment.", retryable: true };
  if (msg.startsWith("404"))
    return { kind: "not_found", message: "No flights found. Double-check the airports and date.", retryable: false };
  if (msg.startsWith("5") || msg.includes("Failed to fetch") || msg.includes("Network request failed") || msg.includes("ERR_CONNECTION_REFUSED"))
    return { kind: "server",   message: "Our server is unreachable right now. Please try again shortly.", retryable: true };
  return { kind: "unknown",   message:"Could not look up that flight. Please check the details and date.", retryable: true };
}

// ─── Network hook ─────────────────────────────────────────────────────────────
function useIsOnline(): boolean {
  const [online, setOnline] = useState(true);
  const check = useCallback(async () => {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 4000);
      await fetch("https://www.gstatic.com/generate_204", {
        method: "HEAD",
        cache: "no-store",
        signal: controller.signal,
      });
      clearTimeout(timer);
      setOnline(true);
    } catch {
      setOnline(false);
    }
  }, []);
  useEffect(() => {
    check();
    const sub = AppState.addEventListener("change", (s: AppStateStatus) => {
      if (s === "active") check();
    });
    return () => sub.remove();
  }, [check]);
  return online;
}

// ─── Validation ───────────────────────────────────────────────────────────────
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

// ─── Types ────────────────────────────────────────────────────────────────────
interface FlightLookupResult {
  flightCode: string; date: string; airline: string; airlineCode: string;
  departureAirport: string; arrivalAirport: string; departureCity: string; arrivalCity: string;
  departureTime: string; arrivalTime: string; durationMinutes: number;
  distanceMiles: number; co2Kg: number; status: "on_time" | "delayed";
  delayMinutes: number; aircraft: string; isMock?: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
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

/** Clearbit favicon — small, no API key needed, covers all major airlines. */
function airlineLogoUrl(airlineCode: string): string {
  const domainMap: Record<string, string> = {
    LX: "swiss.com", LH: "lufthansa.com", BA: "britishairways.com",
    AF: "airfrance.com", KL: "klm.com", EK: "emirates.com",
    QR: "qatarairways.com", SQ: "singaporeair.com", CX: "cathaypacific.com",
    TK: "turkishairlines.com", AY: "finnair.com", SK: "sas.se",
    IB: "iberia.com", VY: "vueling.com", FR: "ryanair.com",
    U2: "easyjet.com", EJU: "easyjet.com", W6: "wizzair.com",
    HV: "transavia.com", TO: "transavia.com", EI: "aerlingus.com",
    TP: "flytap.com", AZ: "ita-airways.com", AA: "aa.com",
    UA: "united.com", DL: "delta.com", WN: "southwest.com",
    B6: "jetblue.com", AS: "alaskaair.com", AC: "aircanada.com",
    WS: "westjet.com", LA: "latam.com", QF: "qantas.com",
    NZ: "airnewzealand.com", JL: "jal.com", NH: "ana.co.jp",
    KE: "koreanair.com", OZ: "flyasiana.com", CA: "airchina.com.cn",
    MU: "ceair.com", CZ: "csair.com", TG: "thaiairways.com",
    MH: "malaysiaairlines.com", SV: "saudia.com", EY: "etihad.com",
    FZ: "flydubai.com", PC: "flypgs.com", VU: "volotea.com",
    MS: "egyptair.com", ET: "ethiopianairlines.com",
  };
  const domain = domainMap[airlineCode] ?? null;
  if (!domain) return "";
  return `https://logo.clearbit.com/${domain}?size=64`;
}

// ─── Error banner ─────────────────────────────────────────────────────────────
function ErrorBanner({ err, onRetry, C }: { err: LookupError; onRetry: () => void; C: ReturnType<typeof useColors> }) {
  const iconMap: Record<LookupErrorKind, string> = {
    offline: "wifi-outline", server: "cloud-offline-outline", timeout: "time-outline",
    not_found: "search-outline", invalid_input: "alert-circle-outline",
    rate_limit: "warning-outline", unknown: "alert-circle-outline",
  };
  return (
    <Animated.View entering={FadeIn} style={{ borderRadius: 12, overflow: "hidden", marginBottom: 16 }}>
      <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 10, backgroundColor: C.red + "14", borderWidth: 1, borderColor: C.red + "33", borderRadius: 12, padding: 14 }}>
        <Ionicons name={iconMap[err.kind] as never} size={18} color={C.red} style={{ marginTop: 1 }} />
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 13, color: C.red, fontFamily: "DMSans_600SemiBold", marginBottom: err.retryable ? 6 : 0 }}>
            {err.kind === "offline" ? "No internet connection" : err.kind === "server" ? "Server unreachable" :
             err.kind === "timeout" ? "Request timed out" : err.kind === "not_found" ? "Flight not found" : "Something went wrong"}
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

// ─── Flight result card ───────────────────────────────────────────────────────
function FlightCard({
  flight, C, action, actionLabel, actionLoading,
}: {
  flight: FlightLookupResult;
  C: ReturnType<typeof useColors>;
  action: () => void;
  actionLabel: string;
  actionLoading: boolean;
}) {
  const dep = flight.departureAirport || "—";
  const arr = flight.arrivalAirport   || "—";
  const logoUrl = airlineLogoUrl(flight.airlineCode);
  const [logoError, setLogoError] = useState(false);

  const displayMinutes = flight.durationMinutes;

  return (
    <Animated.View entering={FadeInDown.springify()} layout={Layout.springify()} style={{ backgroundColor: C.card, borderRadius: 18, padding: 20, borderWidth: 1, borderColor: C.border, marginTop: 16 }}>
      {/* ── Header row: logo + name / badges ── */}
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10, flex: 1, marginRight: 8 }}>
          {logoUrl && !logoError ? (
            <Image
              source={{ uri: logoUrl }}
              style={{ width: 28, height: 28, borderRadius: 6 }}
              onError={() => setLogoError(true)}
            />
          ) : (
            <View style={{ width: 28, height: 28, borderRadius: 6, backgroundColor: C.accent + "22", alignItems: "center", justifyContent: "center" }}>
              <Text style={{ fontSize: 11, color: C.accent, fontFamily: "DMSans_700Bold" }}>
                {flight.airlineCode.slice(0, 2)}
              </Text>
            </View>
          )}
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 20, color: C.accent, fontFamily: "DMSans_700Bold" }}>{flight.flightCode}</Text>
            <Text style={{ fontSize: 13, color: C.textSec, fontFamily: "DMSans_400Regular", marginTop: 1 }}>{flight.airline}</Text>
          </View>
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          {flight.isMock && (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: C.amberDim, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 }}>
              <Ionicons name="sparkles-outline" size={11} color={C.amber} />
              <Text style={{ fontSize: 11, color: C.amber, fontFamily: "DMSans_700Bold" }}>Estimated</Text>
            </View>
          )}
          <View style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, backgroundColor: flight.status === "delayed" ? C.red + "22" : C.green + "22" }}>
            <Text style={{ fontSize: 12, fontFamily: "DMSans_700Bold", color: flight.status === "delayed" ? C.red : C.green }}>
              {flight.status === "delayed" ? `Delayed +${flight.delayMinutes}m` : "On Time"}
            </Text>
          </View>
        </View>
      </View>

      {/* ── Date row ── */}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 5, marginBottom: 14 }}>
        <Ionicons name="calendar-outline" size={13} color={C.textSec} />
        <Text style={{ fontSize: 13, color: C.textSec, fontFamily: "DMSans_400Regular" }}>{formatDate(flight.date)}</Text>
      </View>

      <View style={{ height: 1, backgroundColor: C.border, marginVertical: 14 }} />

      {/* ── Route row ── */}
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 28, color: C.text, fontFamily: "DMSans_700Bold" }}>{dep}</Text>
          <Text style={{ fontSize: 12, color: C.textSec, fontFamily: "DMSans_400Regular", marginTop: 2 }}>{flight.departureCity}</Text>
          <Text style={{ fontSize: 15, color: C.text, fontFamily: "DMSans_500Medium", marginTop: 6 }}>{flight.departureTime}</Text>
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 8, flex: 1 }}>
          <View style={{ flex: 1, height: 1, backgroundColor: C.border }} />
          <Ionicons name="airplane" size={20} color={C.accent} />
          <View style={{ flex: 1, height: 1, backgroundColor: C.border }} />
        </View>
        <View style={{ flex: 1, alignItems: "flex-end" }}>
          <Text style={{ fontSize: 28, color: C.text, fontFamily: "DMSans_700Bold" }}>{arr}</Text>
          <Text style={{ fontSize: 12, color: C.textSec, fontFamily: "DMSans_400Regular", marginTop: 2 }}>{flight.arrivalCity}</Text>
          <Text style={{ fontSize: 15, color: C.text, fontFamily: "DMSans_500Medium", marginTop: 6 }}>{flight.arrivalTime}</Text>
          <Text style={{ fontSize: 10, color: C.textMuted, fontFamily: "DMSans_400Regular", marginTop: 1 }}>local time</Text>
        </View>
      </View>

      <View style={{ height: 1, backgroundColor: C.border, marginVertical: 14 }} />

      {/* ── Aircraft row ── */}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 5, marginBottom: 10 }}>
        <Ionicons name="airplane-outline" size={13} color={C.textSec} />
        <Text style={{ fontSize: 13, color: C.textSec, fontFamily: "DMSans_400Regular" }}>{flight.aircraft}</Text>
      </View>

      {/* ── Stats row ── */}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 18 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
          <Ionicons name="time-outline" size={14} color={C.textSec} />
          <Text style={{ fontSize: 13, color: C.textSec, fontFamily: "DMSans_500Medium" }}>{formatHours(displayMinutes)}</Text>
        </View>
        <View style={{ width: 3, height: 3, borderRadius: 2, backgroundColor: C.border }} />
        <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
          <Ionicons name="navigate-outline" size={14} color={C.textSec} />
          <Text style={{ fontSize: 13, color: C.textSec, fontFamily: "DMSans_500Medium" }}>{flight.distanceMiles.toLocaleString()} mi</Text>
        </View>
        <View style={{ width: 3, height: 3, borderRadius: 2, backgroundColor: C.border }} />
        <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
          <Ionicons name="leaf-outline" size={14} color={C.green} />
          <Text style={{ fontSize: 13, color: C.green, fontFamily: "DMSans_500Medium" }}>{flight.co2Kg} kg CO₂</Text>
        </View>
      </View>

      {/* ── Action button ── */}
      <Pressable onPress={action} disabled={actionLoading}
        style={({ pressed }) => [{ backgroundColor: C.accent, borderRadius: 14, padding: 16, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, opacity: actionLoading || pressed ? 0.8 : 1 }]}>
        {actionLoading
          ? <ActivityIndicator color={C.white} size="small" />
          : <><Ionicons name="checkmark" size={20} color={C.white} /><Text style={{ fontSize: 16, color: C.white, fontFamily: "DMSans_700Bold" }}>{actionLabel}</Text></>}
      </Pressable>
    </Animated.View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────
export default function AddFlightScreen() {
  const insets   = useSafeAreaInsets();
  const C        = useColors();
  const { addFlight, flights } = useFlights();
  const isOnline = useIsOnline();

  const [searchMode, setSearchMode]   = useState<SearchMode>("code");
  const [date, setDate]               = useState(todayStr());
  const [loading, setLoading]         = useState(false);
  const [lookupErr, setLookupErr]     = useState<LookupError | null>(null);
  const [savingId, setSavingId]       = useState<string | null>(null);
  const [remainingCalls, setRemainingCalls] = useState<number | null>(null);

  const [code, setCode]     = useState("");
  const [preview, setPreview] = useState<FlightLookupResult | null>(null);

  const [depIATA, setDepIATA]           = useState("");
  const [arrIATA, setArrIATA]           = useState("");
  const [airportResults, setAirportResults] = useState<FlightLookupResult[]>([]);

  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;
  const topPad    = Platform.OS === "web" ? 67 : insets.top + 8;

  function switchMode(mode: SearchMode) {
    setSearchMode(mode);
    setPreview(null);
    setAirportResults([]);
    setLookupErr(null);
  }

  useEffect(() => {
    if (!isOnline) setLookupErr({ kind: "offline", message: "You're offline. Check your connection and try again.", retryable: true });
    else if (lookupErr?.kind === "offline") setLookupErr(null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOnline]);

  const handleCodeLookup = useCallback(async () => {
    setLookupErr(null); setPreview(null);
    if (!isOnline) { setLookupErr({ kind: "offline", message: "You're offline. Check your connection and try again.", retryable: true }); Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error); return; }
    const codeResult = sanitiseFlightCode(code);
    if (codeResult.error) { setLookupErr({ kind: "invalid_input", message: codeResult.error, retryable: false }); return; }
    const dateResult = sanitiseDate(date);
    if (dateResult.error) { setLookupErr({ kind: "invalid_input", message: dateResult.error, retryable: false }); return; }
    const limit = await lookupLimiter.check();
    setRemainingCalls(limit.remainingCalls - 1);
    if (!limit.allowed) { setLookupErr({ kind: "rate_limit", message: `Too many lookups — please wait ${formatRetryAfter(limit.retryAfterMs)} before trying again.`, retryable: false }); Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error); return; }
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
      setLookupErr(classifyError(err, isOnline));
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally { setLoading(false); }
  }, [code, date, isOnline]);

  const handleAirportSearch = useCallback(async () => {
    setLookupErr(null); setAirportResults([]);
    if (!isOnline) { setLookupErr({ kind: "offline", message: "You're offline. Check your connection and try again.", retryable: true }); Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error); return; }
    if (!depIATA && !arrIATA) { setLookupErr({ kind: "invalid_input", message: "Enter at least one airport — departure, arrival, or both.", retryable: false }); return; }
    const dateResult = sanitiseDate(date);
    if (dateResult.error) { setLookupErr({ kind: "invalid_input", message: dateResult.error, retryable: false }); return; }
    const limit = await lookupLimiter.check();
    setRemainingCalls(limit.remainingCalls - 1);
    if (!limit.allowed) { setLookupErr({ kind: "rate_limit", message: `Too many lookups — please wait ${formatRetryAfter(limit.retryAfterMs)} before trying again.`, retryable: false }); Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error); return; }
    setLoading(true);
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      await lookupLimiter.consume();
      const params = new URLSearchParams({ date: dateResult.value });
      if (depIATA) params.set("dep", depIATA);
      if (arrIATA) params.set("arr", arrIATA);
      const res  = await apiRequest("GET", `/api/flights/search?${params.toString()}`);
      const data = (await res.json()) as FlightLookupResult[];
      setAirportResults(Array.isArray(data) ? data : []);
      const updated = await lookupLimiter.check();
      setRemainingCalls(updated.remainingCalls);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err) {
      setLookupErr(classifyError(err, isOnline));
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally { setLoading(false); }
  }, [depIATA, arrIATA, date, isOnline]);

  async function handleSave(flight: FlightLookupResult) {
    setSavingId(flight.flightCode);
    try {
      const isDuplicate = flights.some((f) => f.flightCode === flight.flightCode && f.date === flight.date);
      if (isDuplicate) { setLookupErr({ kind: "unknown", message: "This flight has already been added to your logbook.", retryable: false }); setSavingId(null); return; }
      await addFlight({
        flightCode: flight.flightCode, date: flight.date, airline: flight.airline, airlineCode: flight.airlineCode,
        departureAirport: flight.departureAirport, arrivalAirport: flight.arrivalAirport,
        departureCity: flight.departureCity, arrivalCity: flight.arrivalCity,
        departureTime: flight.departureTime, arrivalTime: flight.arrivalTime,
        durationMinutes: flight.durationMinutes,
        distanceMiles: flight.distanceMiles,
        co2Kg: flight.co2Kg, status: flight.status || "on_time",
        delayMinutes: flight.delayMinutes ?? 0, aircraft: flight.aircraft,
        verified: false, isMock: flight.isMock ?? false,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.dismissAll();
    } catch {
      Alert.alert("Error", "Could not save the flight. Please try again.");
    } finally { setSavingId(null); }
  }

  const activeSearch = searchMode === "code" ? handleCodeLookup : handleAirportSearch;

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={{ flex: 1, backgroundColor: C.surface }}
    >
      {/* Fill the area below the sheet with the surface colour so no black shows through */}
      <View style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 300, backgroundColor: C.surface }} />
      <View style={{
        flex: 1,
        backgroundColor: C.surface,
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        overflow: "hidden",
        paddingTop: topPad,
      }}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ padding: 24, paddingBottom: bottomPad + 24 }}
        >
          {/* Header */}
          <Animated.View entering={FadeInDown.delay(0).springify()}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <Text style={{ fontSize: 24, color: C.text, fontFamily: "DMSans_700Bold" }}>Add Flight</Text>
              <Pressable onPress={() => router.back()} hitSlop={12}>
                <Ionicons name="close" size={24} color={C.textSec} />
              </Pressable>
            </View>
            <Text style={{ fontSize: 14, color: C.textSec, fontFamily: "DMSans_400Regular", marginBottom: 24, lineHeight: 20 }}>
              Search by flight code or browse flights departing / arriving at an airport.
            </Text>
          </Animated.View>

          {/* Mode toggle */}
          <Animated.View entering={FadeInDown.delay(40).springify()} style={{ flexDirection: "row", backgroundColor: C.card, borderRadius: 14, borderWidth: 1, borderColor: C.border, padding: 4, marginBottom: 24, gap: 4 }}>
            {(["code", "airport"] as SearchMode[]).map((mode) => {
              const active = searchMode === mode;
              return (
                <Pressable key={mode} onPress={() => switchMode(mode)}
                  style={{ flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 10, borderRadius: 11, backgroundColor: active ? C.accent : "transparent" }}>
                  <Ionicons name={mode === "code" ? "barcode-outline" : "navigate-outline"} size={15} color={active ? C.white : C.textSec} />
                  <Text style={{ fontSize: 13, fontFamily: "DMSans_600SemiBold", color: active ? C.white : C.textSec }}>
                    {mode === "code" ? "Flight Code" : "By Airport"}
                  </Text>
                </Pressable>
              );
            })}
          </Animated.View>

          {/* Offline banner */}
          {!isOnline && (
            <Animated.View entering={FadeIn} style={{ flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: C.amber + "18", borderWidth: 1, borderColor: C.amber + "44", borderRadius: 12, padding: 12, marginBottom: 20 }}>
              <Ionicons name="wifi-outline" size={16} color={C.amber} />
              <Text style={{ fontSize: 13, color: C.amber, fontFamily: "DMSans_500Medium", flex: 1 }}>No internet — flight lookup unavailable</Text>
            </Animated.View>
          )}

          {/* Inputs */}
          <Animated.View entering={FadeInDown.delay(80).springify()} style={{ gap: 16, marginBottom: 24 }}>
            {searchMode === "code" ? (
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
            ) : (
              <View style={{ gap: 14 }}>
                <AirportInput
                  label="Departure Airport"
                  value={depIATA}
                  onChange={(v) => { setDepIATA(v); setAirportResults([]); setLookupErr(null); }}
                  placeholder="e.g. ZRH  (optional)"
                  icon="airplane-outline"
                  returnKeyType="next"
                />
                <AirportInput
                  label="Arrival Airport"
                  value={arrIATA}
                  onChange={(v) => { setArrIATA(v); setAirportResults([]); setLookupErr(null); }}
                  placeholder="e.g. LHR  (optional)"
                  icon="location-outline"
                  returnKeyType="done"
                />
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <Ionicons name="information-circle-outline" size={13} color={C.textMuted} />
                  <Text style={{ fontSize: 12, color: C.textMuted, fontFamily: "DMSans_400Regular" }}>
                    Fill one or both airports — at least one is required.
                  </Text>
                </View>
              </View>
            )}

            {/* Date (shared) */}
            <View style={{ gap: 8 }}>
              <Text style={{ fontSize: 13, color: C.textSec, fontFamily: "DMSans_500Medium", letterSpacing: 0.3, textTransform: "uppercase" }}>Date</Text>
              <DatePicker value={date} onChange={(d) => { setDate(d); setPreview(null); setAirportResults([]); setLookupErr(null); }} />
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
          {lookupErr && <ErrorBanner err={lookupErr} onRetry={activeSearch} C={C} />}

          {/* Search button */}
          <Pressable onPress={activeSearch} disabled={loading || !isOnline}
            style={({ pressed }) => [{ backgroundColor: isOnline ? C.accent : C.textMuted, borderRadius: 14, padding: 16, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 4, opacity: loading || pressed ? 0.7 : 1 }]}>
            {loading
              ? <ActivityIndicator color={C.white} size="small" />
              : <><Ionicons name="search-outline" size={18} color={C.white} /><Text style={{ fontSize: 16, color: C.white, fontFamily: "DMSans_700Bold" }}>{searchMode === "code" ? "Look Up Flight" : "Search Flights"}</Text></>}
          </Pressable>

          {/* Code-mode: single preview card */}
          {searchMode === "code" && preview && (
            <FlightCard flight={preview} C={C} action={() => handleSave(preview)} actionLabel="Add to Logbook" actionLoading={savingId === preview.flightCode} />
          )}

          {/* Airport-mode: results list */}
          {searchMode === "airport" && airportResults.length > 0 && (
            <Animated.View entering={FadeInDown.springify()} style={{ marginTop: 8 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 }}>
                <Ionicons name="list-outline" size={15} color={C.textSec} />
                <Text style={{ fontSize: 13, color: C.textSec, fontFamily: "DMSans_500Medium" }}>
                  {airportResults.length} flight{airportResults.length !== 1 ? "s" : ""} found
                </Text>
              </View>
              {airportResults.map((flight) => (
                <FlightCard key={`${flight.flightCode}-${flight.date}`} flight={flight} C={C} action={() => handleSave(flight)} actionLabel="Add to Logbook" actionLoading={savingId === flight.flightCode} />
              ))}
            </Animated.View>
          )}

          {/* Airport-mode: empty state */}
          {searchMode === "airport" && !loading && airportResults.length === 0 && !lookupErr && (depIATA || arrIATA) && (
            <Animated.View entering={FadeIn} style={{ alignItems: "center", paddingVertical: 32, gap: 10 }}>
              <Ionicons name="airplane-outline" size={36} color={C.textMuted} />
              <Text style={{ fontSize: 14, color: C.textMuted, fontFamily: "DMSans_400Regular", textAlign: "center" }}>
                No results yet — tap Search Flights to look up schedules.
              </Text>
            </Animated.View>
          )}
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
}
