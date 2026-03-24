import React, { useMemo, useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Platform,
  Modal,
  TouchableWithoutFeedback,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Animated, { FadeInDown, FadeIn } from "react-native-reanimated";
import { Colors } from "@/constants/colors";
import { useFlights, Flight } from "@/context/flights";
import { useUser } from "@/context/user";
import GlobeView from "@/components/GlobeView";
import { LogbookLogo } from "@/components/LogbookLogo";
import { getCO2FunFact } from "@/utils/co2FunFact";

const TODAY = new Date().toISOString().substring(0, 10);

function formatHours(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

function formatNumber(n: number): string {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(n);
}

function daysUntil(dateStr: string): number {
  const diff = new Date(dateStr + "T00:00:00").getTime() - new Date(TODAY + "T00:00:00").getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

function formatDateShort(dateStr: string): string {
  return new Date(dateStr + "T00:00:00").toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
  });
}

// ─── Fallback CDF (mirrors server/routes.ts — used when server is unreachable) ──
const FALLBACK_CDF: [number, number][] = [
  [  0, 0.0000 ], [  1, 0.3800 ], [  2, 0.5700 ], [  3, 0.6500 ],
  [  4, 0.7080 ], [  5, 0.7500 ], [  6, 0.7840 ], [  7, 0.8100 ],
  [  8, 0.8300 ], [  9, 0.8460 ], [ 10, 0.8600 ], [ 11, 0.8710 ],
  [ 12, 0.8810 ], [ 13, 0.8895 ], [ 14, 0.8970 ], [ 15, 0.9040 ],
  [ 16, 0.9100 ], [ 17, 0.9155 ], [ 18, 0.9205 ], [ 19, 0.9250 ],
  [ 20, 0.9292 ], [ 21, 0.9330 ], [ 22, 0.9365 ], [ 23, 0.9398 ],
  [ 24, 0.9428 ], [ 25, 0.9455 ], [ 26, 0.9480 ], [ 27, 0.9503 ],
  [ 28, 0.9524 ], [ 29, 0.9544 ], [ 30, 0.9562 ], [ 31, 0.9579 ],
  [ 32, 0.9595 ], [ 33, 0.9610 ], [ 34, 0.9624 ], [ 35, 0.9637 ],
  [ 36, 0.9649 ], [ 37, 0.9660 ], [ 38, 0.9671 ], [ 39, 0.9681 ],
  [ 40, 0.9690 ], [ 41, 0.9699 ], [ 42, 0.9707 ], [ 43, 0.9715 ],
  [ 44, 0.9722 ], [ 45, 0.9729 ], [ 46, 0.9736 ], [ 47, 0.9742 ],
  [ 48, 0.9748 ], [ 49, 0.9754 ], [ 50, 0.9760 ],
  [ 55, 0.9785 ], [ 60, 0.9808 ], [ 65, 0.9825 ], [ 70, 0.9840 ],
  [ 75, 0.9855 ], [ 80, 0.9867 ], [ 90, 0.9885 ], [100, 0.9900 ],
  [125, 0.9930 ], [150, 0.9955 ], [200, 1.0000 ],
];

function computeFallbackPercentile(count: number): number {
  if (count <= 0) return 0;
  for (let i = 1; i < FALLBACK_CDF.length; i++) {
    const [x0, y0] = FALLBACK_CDF[i - 1];
    const [x1, y1] = FALLBACK_CDF[i];
    if (count <= x1) {
      const t = (count - x0) / (x1 - x0);
      return Math.round((y0 + t * (y1 - y0)) * 1000) / 10;
    }
  }
  return 100;
}

// ─── usePercentile hook ───────────────────────────────────────────────────────
interface PercentileResult { topPercent: number; }

function usePercentile(count: number): PercentileResult | null {
  const [result, setResult] = useState<PercentileResult | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (count <= 0) { setResult(null); return; }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/percentile?count=${count}`, { signal: AbortSignal.timeout(4000) });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as { topPercent: number };
        setResult({ topPercent: data.topPercent });
      } catch {
        const percentile = computeFallbackPercentile(count);
        setResult({ topPercent: Math.max(0.1, Math.round((100 - percentile) * 10) / 10) });
      }
    }, 400);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [count]);

  return result;
}

function useFilteredStats(flights: Flight[], period: "all" | number) {
  return useMemo(() => {
    const filtered = period === "all" ? flights : flights.filter((f) => f.date.startsWith(String(period)));
    const count     = filtered.length;
    const miles     = filtered.reduce((s, f) => s + f.distanceMiles, 0);
    const co2       = filtered.reduce((s, f) => s + f.co2Kg, 0);
    const flightMin = filtered.reduce((s, f) => s + f.durationMinutes, 0);
    const delayMin  = filtered.reduce((s, f) => s + f.delayMinutes, 0);
    return { count, miles, co2, flightMin, delayMin };
  }, [flights, period]);
}

function StatCard({ label, value, icon, accent }: { label: string; value: string; icon: string; accent: string }) {
  return (
    <View style={styles.statCard}>
      <View style={[styles.statIcon, { backgroundColor: accent + "1A" }]}>
        <Ionicons name={icon as never} size={18} color={accent} />
      </View>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function FlightRow({ flight, isUpcoming }: { flight: Flight; isUpcoming: boolean }) {
  const days = isUpcoming ? daysUntil(flight.date) : null;
  return (
    <Pressable
      onPress={() => router.push({ pathname: "/flight/[id]", params: { id: flight.id } })}
      style={({ pressed }) => [styles.flightCard, { opacity: pressed ? 0.8 : 1 }]}
    >
      <View style={[styles.flightAccentBar, { backgroundColor: isUpcoming ? Colors.accent : Colors.green }]} />
      <View style={styles.flightCardInner}>
        <View style={styles.flightRouteRow}>
          <Text style={styles.flightAirport}>{flight.departureAirport}</Text>
          <View style={styles.flightArrowWrap}>
            <View style={styles.flightArrowLine} />
            <Ionicons name="airplane" size={12} color={isUpcoming ? Colors.accent : Colors.green} />
            <View style={styles.flightArrowLine} />
          </View>
          <Text style={styles.flightAirport}>{flight.arrivalAirport}</Text>
        </View>
        <View style={styles.flightMetaRow}>
          <Text style={styles.flightMeta}>
            {flight.flightCode}{"  \u00b7  "}{formatDateShort(flight.date)}
          </Text>
          {isUpcoming && days !== null ? (
            <View style={[styles.countdownPill, { backgroundColor: days === 0 ? Colors.accent : days <= 7 ? Colors.amber + "22" : Colors.accentDim }]}>
              <Text style={[styles.countdownText, { color: days === 0 ? Colors.white : days <= 7 ? Colors.amber : Colors.accent }]}>
                {days === 0 ? "Today!" : days === 1 ? "Tomorrow" : `In ${days} days`}
              </Text>
            </View>
          ) : (
            <View style={[styles.countdownPill, { backgroundColor: Colors.green + "18" }]}>
              <Text style={[styles.countdownText, { color: Colors.green }]}>
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
  { id: "wallet",        icon: "wallet-outline",       label: "Link Apple Wallet",  sub: "Import boarding passes" },
  { id: "monthly-recap", icon: "calendar-outline",      label: "Monthly Recap",       sub: "Share your month in the air" },
  { id: "share",         icon: "share-social-outline", label: "Share Year Recap",   sub: "Post to social media" },
  { id: "add",           icon: "add-circle-outline",   label: "Add Flight",         sub: "Log a flight manually" },
];

function HamburgerMenu({ visible, onClose, onSelect }: { visible: boolean; onClose: () => void; onSelect: (id: string) => void }) {
  if (!visible) return null;
  return (
    <Modal transparent animationType="fade" visible={visible} onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.menuOverlay}>
          <TouchableWithoutFeedback>
            <Animated.View entering={FadeIn.duration(150)} style={styles.menuCard}>
              {MENU_ITEMS.map((item, i) => (
                <Pressable
                  key={item.id}
                  onPress={() => { onSelect(item.id); onClose(); }}
                  style={({ pressed }) => [
                    styles.menuItem,
                    i < MENU_ITEMS.length - 1 && styles.menuItemBorder,
                    { backgroundColor: pressed ? Colors.surface : Colors.card },
                  ]}
                >
                  <View style={styles.menuItemIcon}>
                    <Ionicons name={item.icon as never} size={18} color={Colors.accent} />
                  </View>
                  <View style={styles.menuItemText}>
                    <Text style={styles.menuItemLabel}>{item.label}</Text>
                    <Text style={styles.menuItemSub}>{item.sub}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={14} color={Colors.textMuted} />
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
  return (
    <Animated.View entering={FadeInDown.delay(30).springify()} style={styles.loginBanner}>
      <View style={styles.loginBannerIcon}>
        <Ionicons name="cloud-upload-outline" size={18} color={Colors.accent} />
      </View>
      <View style={styles.loginBannerText}>
        <Text style={styles.loginBannerTitle}>Back up your flights</Text>
        <Text style={styles.loginBannerSub}>Create a free account to sync across devices.</Text>
      </View>
      <View style={styles.loginBannerActions}>
        <Pressable onPress={onSignUp} style={styles.loginBannerBtn}>
          <Text style={styles.loginBannerBtnText}>Sign Up</Text>
        </Pressable>
        <Pressable onPress={onDismiss} hitSlop={8}>
          <Ionicons name="close" size={16} color={Colors.textMuted} />
        </Pressable>
      </View>
    </Animated.View>
  );
}

// ─── Period dropdown (replaces the horizontal scroll of year pills) ────────────
function PeriodDropdown({
  period, years, onChange,
}: {
  period: "all" | number;
  years: number[];
  onChange: (p: "all" | number) => void;
}) {
  const [open, setOpen] = useState(false);
  const label = period === "all" ? "All Time" : String(period);
  const options: ("all" | number)[] = ["all", ...years];

  return (
    <>
      {/* Trigger button */}
      <Pressable
        onPress={() => { Haptics.selectionAsync(); setOpen(true); }}
        style={({ pressed }) => [styles.dropdownTrigger, { opacity: pressed ? 0.8 : 1 }]}
      >
        <Ionicons name="calendar-outline" size={14} color={Colors.accent} />
        <Text style={styles.dropdownLabel}>{label}</Text>
        <Ionicons name="chevron-down" size={14} color={Colors.accent} />
      </Pressable>

      {/* Picker modal */}
      <Modal transparent animationType="fade" visible={open} onRequestClose={() => setOpen(false)}>
        <TouchableWithoutFeedback onPress={() => setOpen(false)}>
          <View style={styles.dropdownOverlay}>
            <TouchableWithoutFeedback>
              <Animated.View entering={FadeIn.duration(120)} style={styles.dropdownSheet}>
                <Text style={styles.dropdownSheetTitle}>Filter by period</Text>
                {options.map((opt, i) => {
                  const isActive = opt === period;
                  const optLabel = opt === "all" ? "All Time" : String(opt);
                  return (
                    <Pressable
                      key={String(opt)}
                      onPress={() => {
                        Haptics.selectionAsync();
                        onChange(opt);
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
                        {optLabel}
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

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { flights } = useFlights();
  const { profile, isLoggedIn, dismissedPrompt, dismissPrompt } = useUser();
  const [period, setPeriod] = useState<"all" | number>(new Date().getFullYear());
  const [menuOpen, setMenuOpen] = useState(false);

  const topPadding    = Platform.OS === "web" ? 67 : insets.top;
  const bottomPadding = Platform.OS === "web" ? 34 : 0;

  const showLoginPrompt = !isLoggedIn && !dismissedPrompt;

  const years = useMemo(() => {
    const set = new Set<number>();
    flights.forEach((f) => { const y = parseInt(f.date.substring(0, 4), 10); if (!isNaN(y)) set.add(y); });
    return Array.from(set).sort((a, b) => b - a);
  }, [flights]);

  const upcomingFlights = useMemo(
    () => flights.filter((f) => f.date >= TODAY).sort((a, b) => a.date.localeCompare(b.date)).slice(0, 3),
    [flights]
  );
  const pastFlights = useMemo(
    () => flights.filter((f) => f.date < TODAY).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 3),
    [flights]
  );

  const stats = useFilteredStats(flights, period);
  const percentileData = usePercentile(stats.count);
  const hasFlights = flights.length > 0;

  function handleMenuSelect(id: string) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (id === "wallet")             router.push("/wallet-import");
    else if (id === "monthly-recap") router.push("/monthly-recap");
    else if (id === "share")         router.push("/share");
    else if (id === "add")           router.push("/add-flight");
  }

  function handleAdd() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push("/add-flight");
  }

  function handleAvatarPress() {
    Haptics.selectionAsync();
    if (isLoggedIn) router.push("/(tabs)/profile");
    else            router.push("/auth");
  }

  return (
    <View style={[styles.container, { paddingTop: topPadding }]}>
      <HamburgerMenu visible={menuOpen} onClose={() => setMenuOpen(false)} onSelect={handleMenuSelect} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scroll, { paddingBottom: bottomPadding + 100 }]}
        contentInsetAdjustmentBehavior="automatic"
      >
        {/* ─── HEADER ─── */}
        <Animated.View entering={FadeInDown.delay(0).springify()} style={styles.header}>
          <LogbookLogo size={38} showName />
          <View style={styles.headerRight}>
            <Pressable
              onPress={handleAvatarPress}
              style={({ pressed }) => [styles.avatarBtn, { opacity: pressed ? 0.8 : 1 }]}
              hitSlop={6}
            >
              {isLoggedIn && profile.avatarInitials ? (
                <View style={styles.avatarFilled}>
                  <Text style={styles.avatarInitials}>{profile.avatarInitials}</Text>
                </View>
              ) : (
                <View style={styles.avatarEmpty}>
                  <Ionicons name="person-outline" size={18} color={Colors.textSec} />
                </View>
              )}
            </Pressable>
            <Pressable
              onPress={() => { Haptics.selectionAsync(); setMenuOpen(true); }}
              style={({ pressed }) => [styles.menuBtn, { opacity: pressed ? 0.7 : 1 }]}
              hitSlop={8}
            >
              <View style={styles.burgerLine} />
              <View style={[styles.burgerLine, { width: 14 }]} />
              <View style={[styles.burgerLine, { width: 10 }]} />
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
            {/* ── Period dropdown ── */}
            <Animated.View entering={FadeInDown.delay(40).springify()} style={styles.periodRow}>
              <PeriodDropdown
                period={period}
                years={years}
                onChange={(p) => { Haptics.selectionAsync(); setPeriod(p); }}
              />
            </Animated.View>

            <Animated.View entering={FadeInDown.delay(80).springify()} style={styles.heroCard}>
              <View style={styles.heroTopRow}>
                <View>
                  <Text style={styles.heroLabel}>{period === "all" ? "All time flights" : `Flights in ${period}`}</Text>
                  <Text style={styles.heroNum}>{stats.count}</Text>
                </View>
                <View style={styles.heroIconWrap}>
                  <Ionicons name="airplane" size={28} color={Colors.accent} />
                </View>
              </View>
              <View style={styles.heroDivider} />
              <View style={styles.heroBottomRow}>
                <Text style={styles.heroStat}>{formatNumber(stats.miles)} mi</Text>
                <View style={styles.heroDot} />
                <Text style={styles.heroStat}>{stats.co2.toFixed(0)}{" kg CO"}{"\u2082"}</Text>
                {percentileData && percentileData.topPercent <= 30 && (
                  <View style={styles.rankPill}>
                    <Text style={styles.rankPillText}>Top {percentileData.topPercent}%</Text>
                  </View>
                )}
              </View>
              {stats.co2 > 0 && (
                <Text style={styles.co2FunFact}>
                  {"\uD83C\uDF43 "}{"That\u2019s like "}{getCO2FunFact(stats.co2)}
                </Text>
              )}
            </Animated.View>

            <Animated.View entering={FadeInDown.delay(120).springify()} style={styles.mapContainer}>
              <Text style={styles.sectionTitle}>Your Flight Network</Text>
              <GlobeView flights={flights} />
            </Animated.View>

            <Animated.View entering={FadeInDown.delay(140).springify()}>
              <Text style={styles.sectionTitle}>Statistics</Text>
              <View style={styles.statsGrid}>
                <StatCard label="Miles Flown"       value={formatNumber(stats.miles)}                                    icon="globe-outline"     accent={Colors.accent} />
                <StatCard label={"CO\u2082 Emitted"} value={`${formatNumber(stats.co2)}kg`}                            icon="leaf-outline"      accent={Colors.green} />
                <StatCard label="Time in Air"       value={formatHours(stats.flightMin)}                                icon="time-outline"      accent={Colors.amber} />
                <StatCard label="Delay Time"         value={stats.delayMin > 0 ? formatHours(stats.delayMin) : "\u2014"} icon="hourglass-outline" accent={Colors.red} />
              </View>
            </Animated.View>

            {upcomingFlights.length > 0 && (
              <Animated.View entering={FadeInDown.delay(180).springify()} style={styles.section}>
                <View style={styles.sectionRow}>
                  <View style={styles.sectionTitleRow}>
                    <View style={[styles.sectionDot, { backgroundColor: Colors.accent }]} />
                    <Text style={styles.sectionTitle}>Upcoming</Text>
                  </View>
                  <Pressable onPress={() => { Haptics.selectionAsync(); router.push({ pathname: "/(tabs)/flights", params: { filter: "upcoming" } }); }} hitSlop={10}>
                    <Text style={styles.seeAll}>See all</Text>
                  </Pressable>
                </View>
                {upcomingFlights.map((f) => <FlightRow key={f.id} flight={f} isUpcoming={true} />)}
              </Animated.View>
            )}

            {pastFlights.length > 0 && (
              <Animated.View entering={FadeInDown.delay(210).springify()} style={styles.section}>
                <View style={styles.sectionRow}>
                  <View style={styles.sectionTitleRow}>
                    <View style={[styles.sectionDot, { backgroundColor: Colors.green }]} />
                    <Text style={styles.sectionTitle}>Past Flights</Text>
                  </View>
                  <Pressable onPress={() => { Haptics.selectionAsync(); router.push({ pathname: "/(tabs)/flights", params: { filter: "past" } }); }} hitSlop={10}>
                    <Text style={styles.seeAll}>See all</Text>
                  </Pressable>
                </View>
                {pastFlights.map((f) => <FlightRow key={f.id} flight={f} isUpcoming={false} />)}
              </Animated.View>
            )}
          </>
        ) : (
          <Animated.View entering={FadeInDown.delay(100).springify()} style={styles.emptyState}>
            <LogbookLogo size={72} />
            <Text style={styles.emptyTitle}>Welcome to Logbook</Text>
            <Text style={styles.emptyText}>Tap the + button to add your first flight and start tracking your year in the air.</Text>
            <Pressable onPress={handleAdd} style={({ pressed }) => [styles.emptyBtn, { opacity: pressed ? 0.8 : 1 }]}>
              <Text style={styles.emptyBtnText}>Add First Flight</Text>
            </Pressable>
          </Animated.View>
        )}
      </ScrollView>

      {/* ─── Sticky FAB ─── */}
      <Pressable
        onPress={handleAdd}
        style={({ pressed }) => [
          styles.fab,
          {
            bottom: (Platform.OS === "web" ? 34 : insets.bottom) + 80,
            opacity: pressed ? 0.85 : 1,
            transform: [{ scale: pressed ? 0.95 : 1 }],
          },
        ]}
      >
        <Ionicons name="add" size={26} color={Colors.white} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: Colors.bg },
  scroll:       { paddingHorizontal: 20 },
  header:       { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingTop: 16, paddingBottom: 20 },
  headerRight:  { flexDirection: "row", alignItems: "center", gap: 10 },

  avatarBtn:    { justifyContent: "center", alignItems: "center" },
  avatarFilled: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.accent,
    alignItems: "center", justifyContent: "center",
    shadowColor: Colors.accent, shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25, shadowRadius: 6, elevation: 3,
  },
  avatarInitials: { fontSize: 13, color: Colors.white, fontFamily: "DMSans_700Bold" },
  avatarEmpty: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.surface,
    borderWidth: 1.5, borderColor: Colors.border,
    alignItems: "center", justifyContent: "center",
  },

  menuBtn:    { width: 36, height: 36, alignItems: "center", justifyContent: "center", gap: 4 },
  burgerLine: { width: 18, height: 2, borderRadius: 1, backgroundColor: Colors.text },

  fab: {
    position: "absolute", right: 20,
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: Colors.accent,
    alignItems: "center", justifyContent: "center",
    shadowColor: Colors.accent, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4, shadowRadius: 12, elevation: 6,
  },

  loginBanner: {
    flexDirection: "row", alignItems: "center", gap: 10,
    backgroundColor: Colors.accentDim, borderRadius: 14,
    borderWidth: 1, borderColor: Colors.accent + "33",
    padding: 12, marginBottom: 16,
  },
  loginBannerIcon:    { width: 36, height: 36, borderRadius: 10, backgroundColor: Colors.accent + "22", alignItems: "center", justifyContent: "center" },
  loginBannerText:    { flex: 1 },
  loginBannerTitle:   { fontSize: 13, color: Colors.text, fontFamily: "DMSans_700Bold" },
  loginBannerSub:     { fontSize: 11, color: Colors.textSec, fontFamily: "DMSans_400Regular", marginTop: 1 },
  loginBannerActions: { flexDirection: "row", alignItems: "center", gap: 10 },
  loginBannerBtn:     { backgroundColor: Colors.accent, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20 },
  loginBannerBtnText: { fontSize: 12, color: Colors.white, fontFamily: "DMSans_700Bold" },

  menuOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.18)" },
  menuCard: {
    position: "absolute", top: 90, right: 20, width: 260,
    backgroundColor: Colors.card, borderRadius: 16,
    borderWidth: 1, borderColor: Colors.border, overflow: "hidden",
    shadowColor: "#000", shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12, shadowRadius: 24, elevation: 10,
  },
  menuItem:       { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 14, gap: 12 },
  menuItemBorder: { borderBottomWidth: 1, borderBottomColor: Colors.border },
  menuItemIcon:   { width: 34, height: 34, borderRadius: 10, backgroundColor: Colors.accentDim, alignItems: "center", justifyContent: "center" },
  menuItemText:   { flex: 1 },
  menuItemLabel:  { fontSize: 14, color: Colors.text, fontFamily: "DMSans_700Bold" },
  menuItemSub:    { fontSize: 11, color: Colors.textSec, fontFamily: "DMSans_400Regular", marginTop: 1 },

  // ── Period dropdown ──
  periodRow: { marginBottom: 16 },
  dropdownTrigger: {
    flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start",
    backgroundColor: Colors.card, borderRadius: 20,
    borderWidth: 1, borderColor: Colors.accent + "55",
    paddingHorizontal: 14, paddingVertical: 9,
  },
  dropdownLabel: { fontSize: 13, color: Colors.accent, fontFamily: "DMSans_700Bold" },
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
  dropdownOptionBorder: { borderBottomWidth: 1, borderBottomColor: Colors.border },
  dropdownOptionActive: { backgroundColor: Colors.accentDim },
  dropdownOptionText: { fontSize: 16, color: Colors.text, fontFamily: "DMSans_400Regular" },
  dropdownOptionTextActive: { color: Colors.accent, fontFamily: "DMSans_700Bold" },

  heroCard:      { backgroundColor: Colors.card, borderRadius: 20, padding: 20, marginBottom: 24, borderWidth: 1, borderColor: Colors.border },
  heroTopRow:    { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  heroLabel:     { fontSize: 13, color: Colors.textSec, fontFamily: "DMSans_400Regular", letterSpacing: 0.2, marginBottom: 2 },
  heroNum:       { fontSize: 52, color: Colors.text, fontFamily: "DMSans_700Bold", lineHeight: 60 },
  heroIconWrap:  { width: 52, height: 52, borderRadius: 14, backgroundColor: Colors.accentDim, alignItems: "center", justifyContent: "center" },
  heroDivider:   { height: 1, backgroundColor: Colors.border, marginVertical: 14 },
  heroBottomRow: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  heroStat:      { fontSize: 14, color: Colors.textSec, fontFamily: "DMSans_500Medium" },
  heroDot:       { width: 3, height: 3, borderRadius: 2, backgroundColor: Colors.border },
  co2FunFact:    { fontSize: 11, color: Colors.textMuted, fontFamily: "DMSans_400Regular", marginTop: 6, fontStyle: "italic" },
  rankPill:      { backgroundColor: Colors.accentDim, paddingHorizontal: 10, paddingVertical: 3, borderRadius: 10 },
  rankPillText:  { fontSize: 12, color: Colors.accent, fontFamily: "DMSans_700Bold" },

  mapContainer:  { marginTop: 4, marginBottom: 24 },

  sectionTitle:    { fontSize: 12, color: Colors.textSec, fontFamily: "DMSans_500Medium", letterSpacing: 0.8, textTransform: "uppercase", marginBottom: 10 },
  sectionRow:      { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  sectionTitleRow: { flexDirection: "row", alignItems: "center", gap: 7 },
  sectionDot:      { width: 6, height: 6, borderRadius: 3 },
  section:         { marginBottom: 8 },
  seeAll:          { fontSize: 13, color: Colors.accent, fontFamily: "DMSans_500Medium" },

  statsGrid:  { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 24 },
  statCard:   { flex: 1, minWidth: "44%", backgroundColor: Colors.card, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: Colors.border },
  statIcon:   { width: 32, height: 32, borderRadius: 10, alignItems: "center", justifyContent: "center", marginBottom: 10 },
  statValue:  { fontSize: 22, color: Colors.text, fontFamily: "DMSans_700Bold" },
  statLabel:  { fontSize: 12, color: Colors.textSec, fontFamily: "DMSans_400Regular", marginTop: 2 },

  flightCard:      { flexDirection: "row", backgroundColor: Colors.card, borderRadius: 14, marginBottom: 8, borderWidth: 1, borderColor: Colors.border, overflow: "hidden" },
  flightAccentBar: { width: 3 },
  flightCardInner: { flex: 1, paddingHorizontal: 14, paddingVertical: 13 },
  flightRouteRow:  { flexDirection: "row", alignItems: "center", marginBottom: 7 },
  flightAirport:   { fontSize: 18, color: Colors.text, fontFamily: "DMSans_700Bold" },
  flightArrowWrap: { flex: 1, flexDirection: "row", alignItems: "center", marginHorizontal: 8, gap: 3 },
  flightArrowLine: { flex: 1, height: 1, backgroundColor: Colors.border },
  flightMetaRow:   { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  flightMeta:      { fontSize: 12, color: Colors.textSec, fontFamily: "DMSans_400Regular" },
  countdownPill:   { paddingHorizontal: 9, paddingVertical: 3, borderRadius: 8 },
  countdownText:   { fontSize: 11, fontFamily: "DMSans_700Bold" },

  emptyState:  { flex: 1, alignItems: "center", paddingTop: 60, paddingHorizontal: 20 },
  emptyTitle:  { fontSize: 22, color: Colors.text, fontFamily: "DMSans_700Bold", marginBottom: 10, marginTop: 24 },
  emptyText:   { fontSize: 15, color: Colors.textSec, fontFamily: "DMSans_400Regular", textAlign: "center", lineHeight: 22, marginBottom: 28 },
  emptyBtn:    { backgroundColor: Colors.accent, paddingHorizontal: 28, paddingVertical: 16, borderRadius: 30 },
  emptyBtnText:{ fontSize: 15, color: Colors.white, fontFamily: "DMSans_700Bold" },
});
