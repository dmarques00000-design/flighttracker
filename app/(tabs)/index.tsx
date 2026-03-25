import React, { useMemo, useState, useEffect, useRef } from "react";
import {
  View, Text, ScrollView, Pressable,
  Platform, Modal, TouchableWithoutFeedback,
  AppState, AppStateStatus,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Animated, { FadeInDown, FadeIn } from "react-native-reanimated";
import { useColors } from "@/constants/colors";
import { useFlights, Flight } from "@/context/flights";
import { useUser } from "@/context/user";
import GlobeView from "@/components/GlobeView";
import { LogbookLogo } from "@/components/LogbookLogo";
import { getCO2FunFact } from "@/utils/co2FunFact";
import { getRateLimiter, formatRetryAfter } from "@/lib/rate-limiter";

const percentileLimiter = getRateLimiter("percentile", { maxCalls: 10, windowMs: 60_000 });

function getDateString(): string { return new Date().toISOString().substring(0, 10); }
function msUntilMidnight(): number {
  const now = new Date(); const midnight = new Date(now); midnight.setHours(24, 0, 0, 0);
  return midnight.getTime() - now.getTime();
}
function useToday(): string {
  const [today, setToday] = useState(getDateString);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  function scheduleNextTick() {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => { setToday(getDateString()); scheduleNextTick(); }, msUntilMidnight());
  }
  useEffect(() => {
    scheduleNextTick();
    const sub = AppState.addEventListener("change", (state: AppStateStatus) => { if (state === "active") setToday(getDateString()); });
    return () => { if (timerRef.current) clearTimeout(timerRef.current); sub.remove(); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return today;
}

function formatHours(minutes: number): string {
  const h = Math.floor(minutes / 60); const m = minutes % 60;
  if (h === 0) return `${m}m`; if (m === 0) return `${h}h`; return `${h}h ${m}m`;
}
function formatNumber(n: number): string {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000)    return `${(n / 1000).toFixed(1)}K`;
  return String(n);
}
function daysUntil(dateStr: string, today: string): number {
  return Math.ceil((new Date(dateStr + "T00:00:00").getTime() - new Date(today + "T00:00:00").getTime()) / (1000 * 60 * 60 * 24));
}
function formatDateShort(dateStr: string): string {
  return new Date(dateStr + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

const FALLBACK_CDF: [number, number][] = [
  [0,0],[1,0.38],[2,0.57],[3,0.65],[4,0.708],[5,0.75],[6,0.784],[7,0.81],
  [8,0.83],[9,0.846],[10,0.86],[11,0.871],[12,0.881],[13,0.8895],[14,0.897],[15,0.904],
  [20,0.9292],[25,0.9455],[30,0.9562],[40,0.969],[50,0.976],[75,0.9855],[100,0.99],[150,0.9955],[200,1.0],
];
function computeFallbackPercentile(count: number): number {
  if (count <= 0) return 0;
  for (let i = 1; i < FALLBACK_CDF.length; i++) {
    const [x0, y0] = FALLBACK_CDF[i - 1]; const [x1, y1] = FALLBACK_CDF[i];
    if (count <= x1) { const t = (count - x0) / (x1 - x0); return Math.round((y0 + t * (y1 - y0)) * 1000) / 10; }
  }
  return 100;
}
function usePercentile(count: number): { topPercent: number } | null {
  const [result, setResult] = useState<{ topPercent: number } | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (count <= 0) { setResult(null); return; }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        // Check rate limit before firing
        const limit = await percentileLimiter.check();
        if (!limit.allowed) {
          // Silently fall back to the local CDF — no user-visible error for background calls
          const p = computeFallbackPercentile(count);
          setResult({ topPercent: Math.max(0.1, Math.round((100 - p) * 10) / 10) });
          return;
        }
        await percentileLimiter.consume();
        // Validate count is a safe positive integer before sending
        const safeCount = Math.max(0, Math.floor(count));
        const res = await fetch(`/api/percentile?count=${safeCount}`, { signal: AbortSignal.timeout(4000) });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        setResult((await res.json()) as { topPercent: number });
      } catch {
        const p = computeFallbackPercentile(count);
        setResult({ topPercent: Math.max(0.1, Math.round((100 - p) * 10) / 10) });
      }
    }, 400);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [count]);
  return result;
}
function useFilteredStats(flights: Flight[], period: "all" | number) {
  return useMemo(() => {
    const filtered = period === "all" ? flights : flights.filter((f) => f.date.startsWith(String(period)));
    return {
      count:     filtered.length,
      miles:     filtered.reduce((s, f) => s + f.distanceMiles, 0),
      co2:       filtered.reduce((s, f) => s + f.co2Kg, 0),
      flightMin: filtered.reduce((s, f) => s + f.durationMinutes, 0),
      delayMin:  filtered.reduce((s, f) => s + f.delayMinutes, 0),
    };
  }, [flights, period]);
}

function StatCard({ label, value, icon, accent }: { label: string; value: string; icon: string; accent: string }) {
  const C = useColors();
  return (
    <View style={{ flex: 1, minWidth: "44%", backgroundColor: C.card, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: C.border }}>
      <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: accent + "1A", alignItems: "center", justifyContent: "center", marginBottom: 10 }}>
        <Ionicons name={icon as never} size={18} color={accent} />
      </View>
      <Text style={{ fontSize: 22, color: C.text, fontFamily: "DMSans_700Bold" }}>{value}</Text>
      <Text style={{ fontSize: 12, color: C.textSec, fontFamily: "DMSans_400Regular", marginTop: 2 }}>{label}</Text>
    </View>
  );
}

function FlightRow({ flight, isUpcoming, today }: { flight: Flight; isUpcoming: boolean; today: string }) {
  const C = useColors();
  const days = isUpcoming ? daysUntil(flight.date, today) : null;
  return (
    <Pressable onPress={() => router.push({ pathname: "/flight/[id]", params: { id: flight.id } })}
      style={({ pressed }) => [{ flexDirection: "row", backgroundColor: C.card, borderRadius: 14, marginBottom: 8, borderWidth: 1, borderColor: C.border, overflow: "hidden", opacity: pressed ? 0.8 : 1 }]}>
      <View style={{ width: 3, backgroundColor: isUpcoming ? C.accent : C.green }} />
      <View style={{ flex: 1, paddingHorizontal: 14, paddingVertical: 13 }}>
        <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 7 }}>
          <Text style={{ fontSize: 18, color: C.text, fontFamily: "DMSans_700Bold" }}>{flight.departureAirport}</Text>
          <View style={{ flex: 1, flexDirection: "row", alignItems: "center", marginHorizontal: 8, gap: 3 }}>
            <View style={{ flex: 1, height: 1, backgroundColor: C.border }} />
            <Ionicons name="airplane" size={12} color={isUpcoming ? C.accent : C.green} />
            <View style={{ flex: 1, height: 1, backgroundColor: C.border }} />
          </View>
          <Text style={{ fontSize: 18, color: C.text, fontFamily: "DMSans_700Bold" }}>{flight.arrivalAirport}</Text>
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <Text style={{ fontSize: 12, color: C.textSec, fontFamily: "DMSans_400Regular" }}>{flight.flightCode}{"  \u00b7  "}{formatDateShort(flight.date)}</Text>
          {isUpcoming && days !== null ? (
            <View style={{ paddingHorizontal: 9, paddingVertical: 3, borderRadius: 8, backgroundColor: days === 0 ? C.accent : days <= 7 ? C.amber + "22" : C.accentDim }}>
              <Text style={{ fontSize: 11, fontFamily: "DMSans_700Bold", color: days === 0 ? C.white : days <= 7 ? C.amber : C.accent }}>
                {days === 0 ? "Today!" : days === 1 ? "Tomorrow" : `In ${days} days`}
              </Text>
            </View>
          ) : (
            <View style={{ paddingHorizontal: 9, paddingVertical: 3, borderRadius: 8, backgroundColor: C.green + "18" }}>
              <Text style={{ fontSize: 11, fontFamily: "DMSans_700Bold", color: C.green }}>
                {flight.status === "delayed" ? "Delayed" : flight.status === "cancelled" ? "Cancelled" : "Completed"}
              </Text>
            </View>
          )}
        </View>
      </View>
    </Pressable>
  );
}

const MENU_ITEMS = [
  { id: "passport",      icon: "earth-outline",        label: "Travel Passport",   sub: "Countries & airports visited" },
  { id: "wallet",        icon: "wallet-outline",        label: "Link Apple Wallet", sub: "Import boarding passes" },
  { id: "monthly-recap", icon: "calendar-outline",      label: "Monthly Recap",     sub: "Share your month in the air" },
  { id: "share",         icon: "share-social-outline",  label: "Share Year Recap",  sub: "Post to social media" },
  { id: "add",           icon: "add-circle-outline",    label: "Add Flight",        sub: "Log a flight manually" },
];

function HamburgerMenu({ visible, onClose, onSelect }: { visible: boolean; onClose: () => void; onSelect: (id: string) => void }) {
  const C = useColors();
  if (!visible) return null;
  return (
    <Modal transparent animationType="fade" visible={visible} onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.18)" }}>
          <TouchableWithoutFeedback>
            <Animated.View entering={FadeIn.duration(150)} style={{ position: "absolute", top: 90, right: 20, width: 260, backgroundColor: C.card, borderRadius: 16, borderWidth: 1, borderColor: C.border, overflow: "hidden", shadowColor: "#000", shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.12, shadowRadius: 24, elevation: 10 }}>
              {MENU_ITEMS.map((item, i) => (
                <Pressable key={item.id} onPress={() => { onSelect(item.id); onClose(); }}
                  style={({ pressed }) => [{ flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 14, gap: 12, backgroundColor: pressed ? C.surface : C.card },
                    i < MENU_ITEMS.length - 1 && { borderBottomWidth: 1, borderBottomColor: C.border }]}>
                  <View style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: C.accentDim, alignItems: "center", justifyContent: "center" }}>
                    <Ionicons name={item.icon as never} size={18} color={C.accent} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 14, color: C.text,    fontFamily: "DMSans_700Bold" }}>{item.label}</Text>
                    <Text style={{ fontSize: 11, color: C.textSec, fontFamily: "DMSans_400Regular", marginTop: 1 }}>{item.sub}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={14} color={C.textMuted} />
                </Pressable>
              ))}
            </Animated.View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

function LoginPromptBanner({ onSignUp, onDismiss }: { onSignUp: () => void; onDismiss: () => void }) {
  const C = useColors();
  return (
    <Animated.View entering={FadeInDown.delay(30).springify()}
      style={{ flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: C.accentDim, borderRadius: 14, borderWidth: 1, borderColor: C.accent + "33", padding: 12, marginBottom: 16 }}>
      <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: C.accent + "22", alignItems: "center", justifyContent: "center" }}>
        <Ionicons name="cloud-upload-outline" size={18} color={C.accent} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 13, color: C.text,    fontFamily: "DMSans_700Bold" }}>Back up your flights</Text>
        <Text style={{ fontSize: 11, color: C.textSec, fontFamily: "DMSans_400Regular", marginTop: 1 }}>Create a free account to sync across devices.</Text>
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        <Pressable onPress={onSignUp} style={{ backgroundColor: C.accent, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20 }}>
          <Text style={{ fontSize: 12, color: C.white, fontFamily: "DMSans_700Bold" }}>Sign Up</Text>
        </Pressable>
        <Pressable onPress={onDismiss} hitSlop={8}>
          <Ionicons name="close" size={16} color={C.textMuted} />
        </Pressable>
      </View>
    </Animated.View>
  );
}

function PeriodDropdown({ period, years, onChange }: { period: "all" | number; years: number[]; onChange: (p: "all" | number) => void }) {
  const C = useColors();
  const [open, setOpen] = useState(false);
  const label = period === "all" ? "All Time" : String(period);
  const options: ("all" | number)[] = ["all", ...years];
  return (
    <>
      <Pressable onPress={() => { Haptics.selectionAsync(); setOpen(true); }}
        style={({ pressed }) => [{ flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start", backgroundColor: C.card, borderRadius: 20, borderWidth: 1, borderColor: C.accent + "55", paddingHorizontal: 14, paddingVertical: 9, opacity: pressed ? 0.8 : 1 }]}>
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
                  const isActive = opt === period;
                  const optLabel = opt === "all" ? "All Time" : String(opt);
                  return (
                    <Pressable key={String(opt)} onPress={() => { Haptics.selectionAsync(); onChange(opt); setOpen(false); }}
                      style={({ pressed }) => [{ flexDirection: "row" as const, alignItems: "center" as const, justifyContent: "space-between" as const, paddingHorizontal: 24, paddingVertical: 16, opacity: pressed ? 0.8 : 1 },
                        i < options.length - 1 && { borderBottomWidth: 1, borderBottomColor: C.border },
                        isActive && { backgroundColor: C.accentDim }]}>
                      <Text style={{ fontSize: 16, fontFamily: isActive ? "DMSans_700Bold" : "DMSans_400Regular", color: isActive ? C.accent : C.text }}>{optLabel}</Text>
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

export default function HomeScreen() {
  const C = useColors();
  const insets = useSafeAreaInsets();
  const { flights } = useFlights();
  const { profile, isLoggedIn, dismissedPrompt, dismissPrompt } = useUser();
  const [period, setPeriod] = useState<"all" | number>(new Date().getFullYear());
  const [menuOpen, setMenuOpen] = useState(false);
  const today = useToday();
  const topPadding    = Platform.OS === "web" ? 67 : insets.top;
  const bottomPadding = Platform.OS === "web" ? 34 : 0;
  const showLoginPrompt = !isLoggedIn && !dismissedPrompt;

  const years = useMemo(() => {
    const set = new Set<number>();
    flights.forEach((f) => { const y = parseInt(f.date.substring(0, 4), 10); if (!isNaN(y)) set.add(y); });
    return Array.from(set).sort((a, b) => b - a);
  }, [flights]);

  const upcomingFlights = useMemo(() => flights.filter((f) => f.date >= today).sort((a, b) => a.date.localeCompare(b.date)).slice(0, 3), [flights, today]);
  const pastFlights     = useMemo(() => flights.filter((f) => f.date < today).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 3), [flights, today]);
  const stats = useFilteredStats(flights, period);
  const percentileData = usePercentile(stats.count);
  const hasFlights = flights.length > 0;

  function handleMenuSelect(id: string) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (id === "passport")           router.push("/passport");
    else if (id === "wallet")        router.push("/wallet-import");
    else if (id === "monthly-recap") router.push("/monthly-recap");
    else if (id === "share")         router.push("/share");
    else if (id === "add")           router.push("/add-flight");
  }

  return (
    <View style={{ flex: 1, backgroundColor: C.bg, paddingTop: topPadding }}>
      <HamburgerMenu visible={menuOpen} onClose={() => setMenuOpen(false)} onSelect={handleMenuSelect} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: bottomPadding + 100 }} contentInsetAdjustmentBehavior="automatic">

        {/* Header */}
        <Animated.View entering={FadeInDown.delay(0).springify()} style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingTop: 16, paddingBottom: 20 }}>
          <LogbookLogo size={38} showName />
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <Pressable onPress={() => { Haptics.selectionAsync(); isLoggedIn ? router.push("/(tabs)/profile") : router.push("/auth"); }} style={({ pressed }) => [{ opacity: pressed ? 0.8 : 1 }]} hitSlop={6}>
              {isLoggedIn && profile.avatarInitials ? (
                <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: C.accent, alignItems: "center", justifyContent: "center", shadowColor: C.accent, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 6, elevation: 3 }}>
                  <Text style={{ fontSize: 13, color: C.white, fontFamily: "DMSans_700Bold" }}>{profile.avatarInitials}</Text>
                </View>
              ) : (
                <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: C.surface, borderWidth: 1.5, borderColor: C.border, alignItems: "center", justifyContent: "center" }}>
                  <Ionicons name="person-outline" size={18} color={C.textSec} />
                </View>
              )}
            </Pressable>
            <Pressable onPress={() => { Haptics.selectionAsync(); setMenuOpen(true); }} style={({ pressed }) => [{ width: 36, height: 36, alignItems: "center", justifyContent: "center", gap: 4, opacity: pressed ? 0.7 : 1 }]} hitSlop={8}>
              <View style={{ width: 18, height: 2, borderRadius: 1, backgroundColor: C.text }} />
              <View style={{ width: 14, height: 2, borderRadius: 1, backgroundColor: C.text }} />
              <View style={{ width: 10, height: 2, borderRadius: 1, backgroundColor: C.text }} />
            </Pressable>
          </View>
        </Animated.View>

        {showLoginPrompt && (
          <LoginPromptBanner
            onSignUp={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push("/auth"); }}
            onDismiss={() => { Haptics.selectionAsync(); dismissPrompt(); }}
          />
        )}

        {hasFlights ? (
          <>
            <Animated.View entering={FadeInDown.delay(40).springify()} style={{ marginBottom: 16 }}>
              <PeriodDropdown period={period} years={years} onChange={(p) => { Haptics.selectionAsync(); setPeriod(p); }} />
            </Animated.View>

            <Animated.View entering={FadeInDown.delay(80).springify()} style={{ backgroundColor: C.card, borderRadius: 20, padding: 20, marginBottom: 24, borderWidth: 1, borderColor: C.border }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <View>
                  <Text style={{ fontSize: 13, color: C.textSec, fontFamily: "DMSans_400Regular", letterSpacing: 0.2, marginBottom: 2 }}>{period === "all" ? "All time flights" : `Flights in ${period}`}</Text>
                  <Text style={{ fontSize: 52, color: C.text, fontFamily: "DMSans_700Bold", lineHeight: 60 }}>{stats.count}</Text>
                </View>
                <View style={{ width: 52, height: 52, borderRadius: 14, backgroundColor: C.accentDim, alignItems: "center", justifyContent: "center" }}>
                  <Ionicons name="airplane" size={28} color={C.accent} />
                </View>
              </View>
              <View style={{ height: 1, backgroundColor: C.border, marginVertical: 14 }} />
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <Text style={{ fontSize: 14, color: C.textSec, fontFamily: "DMSans_500Medium" }}>{formatNumber(stats.miles)} mi</Text>
                <View style={{ width: 3, height: 3, borderRadius: 2, backgroundColor: C.border }} />
                <Text style={{ fontSize: 14, color: C.textSec, fontFamily: "DMSans_500Medium" }}>{stats.co2.toFixed(0)}{" kg CO\u2082"}</Text>
                {percentileData && percentileData.topPercent <= 30 && (
                  <View style={{ backgroundColor: C.accentDim, paddingHorizontal: 10, paddingVertical: 3, borderRadius: 10 }}>
                    <Text style={{ fontSize: 12, color: C.accent, fontFamily: "DMSans_700Bold" }}>Top {percentileData.topPercent}%</Text>
                  </View>
                )}
              </View>
              {stats.co2 > 0 && <Text style={{ fontSize: 11, color: C.textMuted, fontFamily: "DMSans_400Regular", marginTop: 6, fontStyle: "italic" }}>\uD83C\uDF43 {"That\u2019s like "}{getCO2FunFact(stats.co2)}</Text>}
            </Animated.View>

            <Animated.View entering={FadeInDown.delay(120).springify()} style={{ marginTop: 4, marginBottom: 24 }}>
              <Text style={{ fontSize: 12, color: C.textSec, fontFamily: "DMSans_500Medium", letterSpacing: 0.8, textTransform: "uppercase", marginBottom: 10 }}>Your Flight Network</Text>
              <GlobeView flights={flights} />
            </Animated.View>

            <Animated.View entering={FadeInDown.delay(140).springify()}>
              <Text style={{ fontSize: 12, color: C.textSec, fontFamily: "DMSans_500Medium", letterSpacing: 0.8, textTransform: "uppercase", marginBottom: 10 }}>Statistics</Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 24 }}>
                <StatCard label="Miles Flown"       value={formatNumber(stats.miles)}                                     icon="globe-outline"     accent={C.accent} />
                <StatCard label={"CO\u2082 Emitted"} value={`${formatNumber(stats.co2)}kg`}                             icon="leaf-outline"      accent={C.green} />
                <StatCard label="Time in Air"       value={formatHours(stats.flightMin)}                                 icon="time-outline"      accent={C.amber} />
                <StatCard label="Delay Time"        value={stats.delayMin > 0 ? formatHours(stats.delayMin) : "\u2014"}  icon="hourglass-outline" accent={C.red} />
              </View>
            </Animated.View>

            {upcomingFlights.length > 0 && (
              <Animated.View entering={FadeInDown.delay(180).springify()} style={{ marginBottom: 8 }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 7 }}>
                    <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: C.accent }} />
                    <Text style={{ fontSize: 12, color: C.textSec, fontFamily: "DMSans_500Medium", letterSpacing: 0.8, textTransform: "uppercase" }}>Upcoming</Text>
                  </View>
                  <Pressable onPress={() => { Haptics.selectionAsync(); router.push({ pathname: "/(tabs)/flights", params: { filter: "upcoming" } }); }} hitSlop={10}>
                    <Text style={{ fontSize: 13, color: C.accent, fontFamily: "DMSans_500Medium" }}>See all</Text>
                  </Pressable>
                </View>
                {upcomingFlights.map((f) => <FlightRow key={f.id} flight={f} isUpcoming={true} today={today} />)}
              </Animated.View>
            )}

            {pastFlights.length > 0 && (
              <Animated.View entering={FadeInDown.delay(210).springify()} style={{ marginBottom: 8 }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 7 }}>
                    <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: C.green }} />
                    <Text style={{ fontSize: 12, color: C.textSec, fontFamily: "DMSans_500Medium", letterSpacing: 0.8, textTransform: "uppercase" }}>Past Flights</Text>
                  </View>
                  <Pressable onPress={() => { Haptics.selectionAsync(); router.push({ pathname: "/(tabs)/flights", params: { filter: "past" } }); }} hitSlop={10}>
                    <Text style={{ fontSize: 13, color: C.accent, fontFamily: "DMSans_500Medium" }}>See all</Text>
                  </Pressable>
                </View>
                {pastFlights.map((f) => <FlightRow key={f.id} flight={f} isUpcoming={false} today={today} />)}
              </Animated.View>
            )}
          </>
        ) : (
          <Animated.View entering={FadeInDown.delay(100).springify()} style={{ flex: 1, alignItems: "center", paddingTop: 60, paddingHorizontal: 20 }}>
            <LogbookLogo size={72} />
            <Text style={{ fontSize: 22, color: C.text,    fontFamily: "DMSans_700Bold",    marginBottom: 10, marginTop: 24 }}>Welcome to Logbook</Text>
            <Text style={{ fontSize: 15, color: C.textSec, fontFamily: "DMSans_400Regular", textAlign: "center", lineHeight: 22, marginBottom: 28 }}>Tap the + button to add your first flight and start tracking your year in the air.</Text>
            <Pressable onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); router.push("/add-flight"); }}
              style={({ pressed }) => [{ backgroundColor: C.accent, paddingHorizontal: 28, paddingVertical: 16, borderRadius: 30, opacity: pressed ? 0.8 : 1 }]}>
              <Text style={{ fontSize: 15, color: C.white, fontFamily: "DMSans_700Bold" }}>Add First Flight</Text>
            </Pressable>
          </Animated.View>
        )}
      </ScrollView>

      <Pressable onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); router.push("/add-flight"); }}
        style={({ pressed }) => [{ position: "absolute", right: 20, bottom: (Platform.OS === "web" ? 34 : insets.bottom) + 80, width: 52, height: 52, borderRadius: 26, backgroundColor: C.accent, alignItems: "center", justifyContent: "center", shadowColor: C.accent, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 12, elevation: 6, opacity: pressed ? 0.85 : 1, transform: [{ scale: pressed ? 0.95 : 1 }] }]}>
        <Ionicons name="add" size={26} color={C.white} />
      </Pressable>
    </View>
  );
}
