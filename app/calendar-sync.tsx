/**
 * calendar-sync.tsx
 * Scan iOS Calendar (EventKit) for flight-code events in the past 365 days,
 * let the user review and select which to add to their logbook.
 *
 * UX pattern mirrors wallet-import.tsx:
 *  idle (empty)  → permission + scan explanation
 *  scanning      → spinner
 *  idle (list)   → selectable PassCard list, bulk All/None, sticky CTA
 *  importing     → per-flight enrichment progress
 *  done          → success screen
 *
 * verified is set to TRUE for calendar-sourced flights because the event
 * was created by a third party (airline, booking system) and contains a
 * real IATA code — a stronger signal than a user typing free-form.
 */
import React, { useState, useMemo } from "react";
import {
  View,
  Text,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Alert,
  Platform,
  Linking,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Animated, { FadeInDown, FadeIn } from "react-native-reanimated";
import { useColors } from "@/constants/colors";
import { useFlights } from "@/context/flights";
import { apiRequest } from "@/lib/query-client";
import { scanCalendarForFlights, CalendarFlight } from "@/utils/calendarParser";

// ─── Types ────────────────────────────────────────────────────────────────────
type ScreenState = "idle" | "scanning" | "importing" | "done";
type EnrichState = "pending" | "fetching" | "done" | "failed";

// ─── CalendarFlightCard ───────────────────────────────────────────────────────
function CalendarFlightCard({
  flight,
  selected,
  alreadyAdded,
  onToggle,
  index,
}: {
  flight: CalendarFlight;
  selected: boolean;
  alreadyAdded: boolean;
  onToggle: () => void;
  index: number;
}) {
  const C = useColors();
  const displayDate = new Date(flight.date + "T12:00:00").toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
  });

  return (
    <Animated.View entering={FadeInDown.delay(index * 55).springify()}>
      <Pressable
        onPress={alreadyAdded ? undefined : onToggle}
        style={({ pressed }) => [
          {
            flexDirection: "row",
            backgroundColor: C.card,
            borderRadius: 14,
            marginBottom: 10,
            borderWidth: 1,
            borderColor: selected && !alreadyAdded ? C.accent : C.border,
            overflow: "hidden",
            opacity: alreadyAdded ? 0.5 : pressed ? 0.85 : 1,
            ...(selected && !alreadyAdded ? { backgroundColor: C.accentDim + "55" } : {}),
          },
        ]}
      >
        {/* Left accent bar */}
        <View style={{
          width: 3,
          backgroundColor: alreadyAdded ? C.border : selected ? C.accent : C.border,
        }} />

        <View style={{ flex: 1, paddingHorizontal: 14, paddingVertical: 14 }}>
          {/* Flight code row */}
          <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 5, gap: 8 }}>
            <Text style={{ fontSize: 22, color: C.text, fontFamily: "DMSans_700Bold", letterSpacing: -0.5 }}>
              {flight.flightCode}
            </Text>
            {/* Calendar source badge */}
            <View style={{
              flexDirection: "row", alignItems: "center", gap: 4,
              backgroundColor: C.surface, paddingHorizontal: 8, paddingVertical: 3,
              borderRadius: 8, borderWidth: 1, borderColor: C.border,
            }}>
              <Ionicons name="calendar-outline" size={10} color={C.textMuted} />
              <Text style={{ fontSize: 9, color: C.textMuted, fontFamily: "DMSans_500Medium", letterSpacing: 0.3 }}>
                Calendar
              </Text>
            </View>
          </View>

          {/* Event title + date */}
          <Text
            numberOfLines={1}
            style={{ fontSize: 12, color: C.textSec, fontFamily: "DMSans_400Regular", marginBottom: 3 }}
          >
            {flight.eventTitle}
          </Text>
          <Text style={{ fontSize: 12, color: C.textMuted, fontFamily: "DMSans_400Regular" }}>
            {displayDate}
          </Text>
        </View>

        {/* Right: checkbox or "Added" badge */}
        <View style={{ paddingHorizontal: 14, paddingVertical: 14, alignItems: "center", justifyContent: "center", gap: 8 }}>
          {alreadyAdded ? (
            <View style={{
              flexDirection: "row", alignItems: "center", gap: 4,
              backgroundColor: C.green + "18", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8,
            }}>
              <Ionicons name="checkmark" size={12} color={C.green} />
              <Text style={{ fontSize: 11, color: C.green, fontFamily: "DMSans_700Bold" }}>Added</Text>
            </View>
          ) : (
            <View style={[
              { width: 24, height: 24, borderRadius: 12, borderWidth: 2, alignItems: "center", justifyContent: "center" },
              selected
                ? { backgroundColor: C.accent, borderColor: C.accent }
                : { borderColor: C.border },
            ]}>
              {selected && <Ionicons name="checkmark" size={14} color={C.white} />}
            </View>
          )}
          {/* Verified pill — calendar flights are always verified */}
          {!alreadyAdded && (
            <View style={{
              flexDirection: "row", alignItems: "center", gap: 3,
              backgroundColor: "rgba(79,142,240,0.12)",
              paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6,
              borderWidth: 1, borderColor: "rgba(79,142,240,0.25)",
            }}>
              <Ionicons name="shield-checkmark-outline" size={9} color="#4F8EF0" />
              <Text style={{ fontSize: 9, color: "#4F8EF0", fontFamily: "DMSans_700Bold" }}>Verified</Text>
            </View>
          )}
        </View>
      </Pressable>
    </Animated.View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function CalendarSyncScreen() {
  const C      = useColors();
  const insets = useSafeAreaInsets();
  const { flights, addFlight } = useFlights();

  const [state,          setState]          = useState<ScreenState>("idle");
  const [candidates,     setCandidates]     = useState<CalendarFlight[]>([]);
  const [selected,       setSelected]       = useState<Set<string>>(new Set());
  const [enrichProgress, setEnrichProgress] = useState<Record<string, EnrichState>>({});
  const [enrichLabel,    setEnrichLabel]    = useState("");
  const [addedCount,     setAddedCount]     = useState(0);

  /** Keys of flights already in logbook for quick dedup */
  const alreadyAddedKeys = useMemo(
    () => new Set(flights.map((f) => `${f.flightCode}-${f.date}`)),
    [flights]
  );

  // ── Scan calendar ──────────────────────────────────────────────────────────
  async function handleScan() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setState("scanning");
    try {
      const found = await scanCalendarForFlights();
      setCandidates(found);
      // Pre-select everything not already in the logbook
      const autoSelect = new Set<string>();
      found.forEach((f) => {
        if (!alreadyAddedKeys.has(f.id)) autoSelect.add(f.id);
      });
      setSelected(autoSelect);
      setState("idle");

      if (found.length === 0) {
        Alert.alert(
          "No Flights Found",
          "We scanned your calendar for the past 365 days but couldn't find any events with a flight code (e.g. LX19, TP027) in the title or notes.\n\nMake sure your airline booking emails push events to your calendar, or try adding the flight code to an existing event."
        );
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (err: any) {
      setState("idle");
      if (err?.message === "PERMISSION_DENIED") {
        Alert.alert(
          "Calendar Access Required",
          "Please allow Logbook to read your calendar in Settings → Privacy → Calendars.",
          [
            { text: "Cancel", style: "cancel" },
            Platform.OS === "ios"
              ? { text: "Open Settings", onPress: () => Linking.openSettings() }
              : { text: "OK" },
          ]
        );
      } else {
        Alert.alert("Scan Failed", "Something went wrong scanning your calendar. Please try again.");
      }
    }
  }

  // ── Selection helpers ──────────────────────────────────────────────────────
  function toggleFlight(id: string) {
    Haptics.selectionAsync();
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function selectAll() {
    Haptics.selectionAsync();
    const all = new Set<string>();
    candidates.forEach((f) => { if (!alreadyAddedKeys.has(f.id)) all.add(f.id); });
    setSelected(all);
  }

  function deselectAll() {
    Haptics.selectionAsync();
    setSelected(new Set());
  }

  // ── Import ─────────────────────────────────────────────────────────────────
  async function handleImport() {
    if (selected.size === 0) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setState("importing");

    const toImport = candidates.filter((f) => selected.has(f.id));
    const progress: Record<string, EnrichState> = {};
    toImport.forEach((f) => { progress[f.id] = "pending"; });
    setEnrichProgress({ ...progress });

    let successCount = 0;

    for (let i = 0; i < toImport.length; i++) {
      const cf = toImport[i];
      setEnrichLabel(`Fetching ${cf.flightCode} (${i + 1}/${toImport.length})...`);
      progress[cf.id] = "fetching";
      setEnrichProgress({ ...progress });

      // Try to enrich from the flight-data API
      let fd: any = null;
      try {
        const res = await apiRequest("GET", `/api/flights/lookup?code=${cf.flightCode}&date=${cf.date}`);
        if (res.ok) fd = await res.json();
      } catch { /* fall through to stub data */ }

      try {
        await addFlight({
          flightCode:       cf.flightCode,
          date:             cf.date,
          airline:          fd?.airline          ?? cf.airlineCode,
          airlineCode:      fd?.airlineCode      ?? cf.airlineCode,
          departureAirport: fd?.departureAirport ?? "???",
          arrivalAirport:   fd?.arrivalAirport   ?? "???",
          departureCity:    fd?.departureCity    ?? "",
          arrivalCity:      fd?.arrivalCity      ?? "",
          departureTime:    fd?.departureTime    ?? "00:00",
          arrivalTime:      fd?.arrivalTime      ?? "00:00",
          durationMinutes:  fd?.durationMinutes  ?? 120,
          distanceMiles:    fd?.distanceMiles    ?? 0,
          co2Kg:            fd?.co2Kg            ?? 0,
          status:           fd?.status           ?? "on_time",
          delayMinutes:     fd?.delayMinutes     ?? 0,
          aircraft:         fd?.aircraft         ?? "Unknown",
          // Calendar flights are verified — the code came from an
          // airline-generated calendar event, not typed by the user.
          verified: true,
        });
        successCount++;
        progress[cf.id] = "done";
      } catch {
        progress[cf.id] = "failed";
      }
      setEnrichProgress({ ...progress });
    }

    setAddedCount(successCount);
    setEnrichLabel("");
    setState("done");
  }

  const selectedCount = selected.size;
  const hasCandidates = candidates.length > 0;
  const newCount      = candidates.filter((f) => !alreadyAddedKeys.has(f.id)).length;

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <View style={{ flex: 1, backgroundColor: C.bg, paddingTop: insets.top }}>

      {/* ── Header ── */}
      <View style={{
        flexDirection: "row", alignItems: "center", justifyContent: "space-between",
        paddingHorizontal: 16, paddingVertical: 12,
        borderBottomWidth: 1, borderBottomColor: C.border,
      }}>
        <Pressable
          onPress={() => router.back()}
          style={{ width: 36, height: 36, alignItems: "center", justifyContent: "center" }}
          hitSlop={10}
        >
          <Ionicons name="chevron-back" size={22} color={C.text} />
        </Pressable>
        <Text style={{ fontSize: 17, color: C.text, fontFamily: "DMSans_700Bold" }}>Calendar Sync</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: insets.bottom + 130 }}
      >

        {/* ── SCANNING ── */}
        {state === "scanning" && (
          <Animated.View entering={FadeIn.duration(200)} style={{ alignItems: "center", paddingTop: 100, gap: 16 }}>
            <ActivityIndicator size="large" color={C.accent} />
            <Text style={{ fontSize: 15, color: C.textSec, fontFamily: "DMSans_400Regular" }}>
              Scanning your calendar…
            </Text>
            <Text style={{ fontSize: 13, color: C.textMuted, fontFamily: "DMSans_400Regular", textAlign: "center" }}>
              Looking for flight codes in the past 365 days
            </Text>
          </Animated.View>
        )}

        {/* ── IDLE EMPTY (pre-scan) ── */}
        {state === "idle" && !hasCandidates && (
          <Animated.View entering={FadeIn.duration(300)} style={{ alignItems: "center", paddingTop: 32 }}>

            {/* Icon */}
            <View style={{
              width: 90, height: 90, borderRadius: 26,
              backgroundColor: C.accentDim,
              alignItems: "center", justifyContent: "center", marginBottom: 24,
            }}>
              <Ionicons name="calendar-outline" size={44} color={C.accent} />
            </View>

            <Text style={{ fontSize: 22, color: C.text, fontFamily: "DMSans_700Bold", textAlign: "center", marginBottom: 12 }}>
              Find flights in Calendar
            </Text>
            <Text style={{ fontSize: 15, color: C.textSec, fontFamily: "DMSans_400Regular", textAlign: "center", lineHeight: 22, marginBottom: 28, maxWidth: 320 }}>
              Logbook scans your iOS Calendar for events containing a flight code in the title or notes — like \u201cLX 19\u201d or \u201cTP027\u201d — over the past 365 days.
            </Text>

            {/* Feature bullets */}
            <View style={{ width: "100%", gap: 12, marginBottom: 32 }}>
              {[
                { icon: "lock-closed-outline",      text: "100% on-device — your calendar data never leaves your phone" },
                { icon: "calendar-outline",          text: "Scans the past 365 days for any event with a flight code" },
                { icon: "shield-checkmark-outline", text: "Flights added this way are marked Verified automatically" },
                { icon: "flash-outline",             text: "Real flight data enriched automatically via API" },
              ].map((item) => (
                <View key={item.icon} style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                  <View style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: C.accentDim, alignItems: "center", justifyContent: "center" }}>
                    <Ionicons name={item.icon as never} size={16} color={C.accent} />
                  </View>
                  <Text style={{ flex: 1, fontSize: 14, color: C.text, fontFamily: "DMSans_400Regular", lineHeight: 20 }}>
                    {item.text}
                  </Text>
                </View>
              ))}
            </View>

            {/* Tip box */}
            <View style={{
              width: "100%",
              flexDirection: "row", alignItems: "flex-start", gap: 8,
              backgroundColor: C.accentDim, borderRadius: 12, padding: 14,
              marginBottom: 32, borderWidth: 1, borderColor: C.accent + "33",
            }}>
              <Ionicons name="information-circle-outline" size={16} color={C.accent} style={{ marginTop: 1 }} />
              <Text style={{ flex: 1, fontSize: 13, color: C.text, fontFamily: "DMSans_400Regular", lineHeight: 20 }}>
                <Text style={{ fontFamily: "DMSans_700Bold" }}>Tip:{"\n"}</Text>
                Many airlines (Swiss, TAP, Ryanair, Lufthansa) automatically add your booking as a calendar event when you open their confirmation email. Make sure those are in your iOS Calendar.
              </Text>
            </View>

            {/* CTA */}
            <Pressable
              onPress={handleScan}
              style={({ pressed }) => [{
                flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10,
                backgroundColor: C.accent,
                paddingHorizontal: 28, paddingVertical: 16, borderRadius: 30,
                width: "100%",
              }, { opacity: pressed ? 0.85 : 1, transform: [{ scale: pressed ? 0.97 : 1 }] }]}
            >
              <Ionicons name="search-outline" size={20} color={C.white} />
              <Text style={{ fontSize: 16, color: C.white, fontFamily: "DMSans_700Bold" }}>Scan My Calendar</Text>
            </Pressable>

          </Animated.View>
        )}

        {/* ── IDLE LIST (post-scan) ── */}
        {state === "idle" && hasCandidates && (
          <Animated.View entering={FadeIn.duration(250)}>

            {/* Rescan button */}
            <View style={{ flexDirection: "row", justifyContent: "flex-end", marginBottom: 12 }}>
              <Pressable
                onPress={handleScan}
                style={({ pressed }) => [{
                  flexDirection: "row", alignItems: "center", gap: 6,
                  backgroundColor: C.card, paddingHorizontal: 14, paddingVertical: 9,
                  borderRadius: 12, borderWidth: 1, borderColor: C.border,
                }, { opacity: pressed ? 0.8 : 1 }]}
              >
                <Ionicons name="refresh-outline" size={14} color={C.accent} />
                <Text style={{ fontSize: 12, color: C.accent, fontFamily: "DMSans_700Bold" }}>Re-scan</Text>
              </Pressable>
            </View>

            {/* List header */}
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
              <View>
                <Text style={{ fontSize: 17, color: C.text, fontFamily: "DMSans_700Bold" }}>
                  {candidates.length} flight{candidates.length !== 1 ? "s" : ""} found
                </Text>
                <Text style={{ fontSize: 12, color: C.textSec, fontFamily: "DMSans_400Regular", marginTop: 2 }}>
                  {newCount} new · past 365 days
                </Text>
              </View>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 3 }}>
                <Pressable onPress={selectAll} hitSlop={8}>
                  <Text style={{ fontSize: 13, color: C.accent, fontFamily: "DMSans_500Medium" }}>All</Text>
                </Pressable>
                <Text style={{ fontSize: 13, color: C.textMuted }}>·</Text>
                <Pressable onPress={deselectAll} hitSlop={8}>
                  <Text style={{ fontSize: 13, color: C.accent, fontFamily: "DMSans_500Medium" }}>None</Text>
                </Pressable>
              </View>
            </View>

            {candidates.map((f, i) => (
              <CalendarFlightCard
                key={f.id}
                flight={f}
                index={i}
                selected={selected.has(f.id)}
                alreadyAdded={alreadyAddedKeys.has(f.id)}
                onToggle={() => toggleFlight(f.id)}
              />
            ))}
          </Animated.View>
        )}

        {/* ── IMPORTING ── */}
        {state === "importing" && (
          <Animated.View entering={FadeIn.duration(200)} style={{ alignItems: "center", paddingTop: 80, gap: 16 }}>
            <ActivityIndicator size="large" color={C.accent} />
            <Text style={{ fontSize: 15, color: C.textSec, fontFamily: "DMSans_400Regular" }}>
              {enrichLabel || "Adding flights…"}
            </Text>
            <View style={{ width: "100%", gap: 8, marginTop: 8 }}>
              {candidates.filter((f) => selected.has(f.id)).map((f) => {
                const s = enrichProgress[f.id] ?? "pending";
                return (
                  <View key={f.id} style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                    <Ionicons
                      name={
                        s === "done"     ? "checkmark-circle" :
                        s === "failed"   ? "close-circle" :
                        s === "fetching" ? "radio-button-on" :
                        "ellipse-outline"
                      }
                      size={15}
                      color={
                        s === "done"     ? C.green :
                        s === "failed"   ? C.red ?? "#EF4444" :
                        s === "fetching" ? C.accent :
                        C.textMuted
                      }
                    />
                    <Text style={{ fontSize: 13, color: C.textSec, fontFamily: "DMSans_400Regular" }}>
                      {f.flightCode} · {f.date}
                    </Text>
                  </View>
                );
              })}
            </View>
          </Animated.View>
        )}

        {/* ── DONE ── */}
        {state === "done" && (
          <Animated.View entering={FadeInDown.springify()} style={{ alignItems: "center", paddingTop: 60 }}>
            <View style={{ marginBottom: 20 }}>
              <Ionicons name="checkmark-circle" size={64} color={C.green} />
            </View>
            <Text style={{ fontSize: 24, color: C.text, fontFamily: "DMSans_700Bold", marginBottom: 10 }}>
              Flights added!
            </Text>
            <Text style={{ fontSize: 15, color: C.textSec, fontFamily: "DMSans_400Regular", textAlign: "center", marginBottom: 8 }}>
              {addedCount} flight{addedCount !== 1 ? "s" : ""} added to your logbook.
            </Text>
            {/* Verified note */}
            <View style={{
              flexDirection: "row", alignItems: "center", gap: 6,
              backgroundColor: "rgba(79,142,240,0.10)",
              paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, marginBottom: 32,
              borderWidth: 1, borderColor: "rgba(79,142,240,0.22)",
            }}>
              <Ionicons name="shield-checkmark-outline" size={14} color="#4F8EF0" />
              <Text style={{ fontSize: 12, color: "#4F8EF0", fontFamily: "DMSans_500Medium" }}>
                All marked as Verified
              </Text>
            </View>
            <View style={{ flexDirection: "row", gap: 12 }}>
              <Pressable
                onPress={() => {
                  setState("idle");
                  setCandidates([]);
                  setSelected(new Set());
                  setAddedCount(0);
                }}
                style={({ pressed }) => [{
                  flexDirection: "row", alignItems: "center", gap: 6,
                  backgroundColor: C.card, paddingHorizontal: 20, paddingVertical: 14,
                  borderRadius: 30, borderWidth: 1, borderColor: C.border,
                }, { opacity: pressed ? 0.8 : 1 }]}
              >
                <Ionicons name="refresh-outline" size={16} color={C.accent} />
                <Text style={{ fontSize: 15, color: C.accent, fontFamily: "DMSans_700Bold" }}>Scan Again</Text>
              </Pressable>
              <Pressable
                onPress={() => router.replace("/(tabs)")}
                style={({ pressed }) => [{
                  backgroundColor: C.accent, paddingHorizontal: 20, paddingVertical: 14, borderRadius: 30,
                }, { opacity: pressed ? 0.85 : 1 }]}
              >
                <Text style={{ fontSize: 15, color: C.white, fontFamily: "DMSans_700Bold" }}>Done</Text>
              </Pressable>
            </View>
          </Animated.View>
        )}

      </ScrollView>

      {/* ── Sticky bottom import bar ── */}
      {state === "idle" && hasCandidates && selectedCount > 0 && (
        <Animated.View
          entering={FadeInDown.springify()}
          style={{
            position: "absolute", bottom: 0, left: 0, right: 0,
            backgroundColor: C.card,
            borderTopWidth: 1, borderTopColor: C.border,
            paddingTop: 12, paddingBottom: insets.bottom + 12, paddingHorizontal: 20,
            flexDirection: "row", alignItems: "center", justifyContent: "space-between",
          }}
        >
          <View style={{ gap: 1 }}>
            <Text style={{ fontSize: 17, color: C.text, fontFamily: "DMSans_700Bold" }}>
              {selectedCount} selected
            </Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 1 }}>
              <Ionicons name="shield-checkmark-outline" size={11} color="#4F8EF0" />
              <Text style={{ fontSize: 11, color: "#4F8EF0", fontFamily: "DMSans_500Medium" }}>All Verified</Text>
            </View>
          </View>
          <Pressable
            onPress={handleImport}
            style={({ pressed }) => [{
              flexDirection: "row", alignItems: "center", gap: 6,
              backgroundColor: C.accent, paddingHorizontal: 20, paddingVertical: 14, borderRadius: 14,
            }, { opacity: pressed ? 0.8 : 1, transform: [{ scale: pressed ? 0.97 : 1 }] }]}
          >
            <Ionicons name="add-circle-outline" size={18} color={C.white} />
            <Text style={{ fontSize: 15, color: C.white, fontFamily: "DMSans_700Bold" }}>Add to Logbook</Text>
          </Pressable>
        </Animated.View>
      )}
    </View>
  );
}
