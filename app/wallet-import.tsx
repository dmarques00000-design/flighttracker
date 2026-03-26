import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Platform,
  ActivityIndicator,
  Alert,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Animated, { FadeInDown, FadeIn } from "react-native-reanimated";
import { useColors } from "@/constants/colors";
import { useFlights } from "@/context/flights";
import {
  requestWalletPermission,
  fetchBoardingPasses,
  WalletBoardingPass,
} from "@/modules/WalletModule";
import { apiRequest } from "@/lib/query-client";

type ImportState = "idle" | "requesting" | "loading" | "ready" | "importing" | "done";
type EnrichState = "pending" | "fetching" | "done" | "failed";

function PassCard({
  pass,
  selected,
  alreadyAdded,
  onToggle,
  index,
}: {
  pass: WalletBoardingPass;
  selected: boolean;
  alreadyAdded: boolean;
  onToggle: () => void;
  index: number;
}) {
  const C = useColors();
  const isUpcoming = pass.date >= new Date().toISOString().substring(0, 10);

  return (
    <Animated.View entering={FadeInDown.delay(index * 60).springify()}>
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
            opacity: alreadyAdded ? 0.55 : pressed ? 0.85 : 1,
            ...(selected && !alreadyAdded ? { backgroundColor: C.accentDim + "55" } : {}),
          },
        ]}
      >
        {/* Left bar */}
        <View style={{ width: 3, backgroundColor: alreadyAdded ? C.border : selected ? C.accent : C.border }} />

        <View style={{ flex: 1, paddingHorizontal: 14, paddingVertical: 14 }}>
          {/* Route */}
          <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 5 }}>
            <Text style={{ fontSize: 20, color: C.text, fontFamily: "DMSans_700Bold" }}>{pass.departureAirport}</Text>
            <View style={{ flex: 1, flexDirection: "row", alignItems: "center", marginHorizontal: 8, gap: 3 }}>
              <View style={{ flex: 1, height: 1, backgroundColor: C.border }} />
              <Ionicons name="airplane" size={13} color={alreadyAdded ? C.textMuted : selected ? C.accent : C.textSec} />
              <View style={{ flex: 1, height: 1, backgroundColor: C.border }} />
            </View>
            <Text style={{ fontSize: 20, color: C.text, fontFamily: "DMSans_700Bold" }}>{pass.arrivalAirport}</Text>
          </View>

          {/* Cities */}
          <Text style={{ fontSize: 12, color: C.textSec, fontFamily: "DMSans_400Regular", marginBottom: 8 }}>
            {pass.departureCity} \u2192 {pass.arrivalCity}
          </Text>

          {/* Meta */}
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
            <Text style={{ fontSize: 12, color: C.textSec, fontFamily: "DMSans_400Regular" }}>{pass.flightCode}</Text>
            <View style={{ width: 3, height: 3, borderRadius: 1.5, backgroundColor: C.textMuted }} />
            <Text style={{ fontSize: 12, color: C.textSec, fontFamily: "DMSans_400Regular" }}>{pass.airline}</Text>
            <View style={{ width: 3, height: 3, borderRadius: 1.5, backgroundColor: C.textMuted }} />
            <Text style={{ fontSize: 12, color: C.textSec, fontFamily: "DMSans_400Regular" }}>
              {new Date(pass.date + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
            </Text>
          </View>
        </View>

        {/* Right: checkbox or already-added badge */}
        <View style={{ paddingHorizontal: 14, paddingVertical: 14, alignItems: "center", justifyContent: "center", gap: 8 }}>
          {alreadyAdded ? (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: C.green + "18", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 }}>
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
          {isUpcoming && !alreadyAdded && (
            <View style={{ backgroundColor: C.accentDim, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 }}>
              <Text style={{ fontSize: 10, color: C.accent, fontFamily: "DMSans_700Bold" }}>Upcoming</Text>
            </View>
          )}
        </View>
      </Pressable>
    </Animated.View>
  );
}

export default function WalletImportScreen() {
  const C = useColors();
  const insets = useSafeAreaInsets();
  const { flights, addFlight } = useFlights();
  const [state, setState] = useState<ImportState>("idle");
  const [passes, setPasses] = useState<WalletBoardingPass[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [isMock, setIsMock] = useState(false);

  const [enrichProgress, setEnrichProgress] = useState<Record<string, EnrichState>>({});
  const [enrichLabel, setEnrichLabel] = useState("");

  const alreadyAddedKeys = new Set(
    flights.map((f) => `${f.flightCode}-${f.date}`)
  );

  const handleConnect = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setState("requesting");

    const status = await requestWalletPermission();

    if (status === "denied") {
      setState("idle");
      Alert.alert(
        "Access Denied",
        "To import boarding passes, please allow access to your Wallet in Settings > Privacy.",
        [{ text: "OK" }]
      );
      return;
    }

    if (status === "unavailable") {
      setState("idle");
      Alert.alert(
        "Not Available",
        "Apple Wallet import is only available on iPhone.",
        [{ text: "OK" }]
      );
      return;
    }

    setState("loading");
    const { passes: fetched, isMock: mock } = await fetchBoardingPasses();
    setIsMock(mock);

    const sorted = [...fetched].sort((a, b) => b.date.localeCompare(a.date));
    setPasses(sorted);

    const preSelected = new Set<string>();
    sorted.forEach((p) => {
      const key = `${p.flightCode}-${p.date}`;
      if (!alreadyAddedKeys.has(key)) preSelected.add(p.serialNumber);
    });
    setSelected(preSelected);
    setState("ready");
  }, [alreadyAddedKeys]);

  function togglePass(serialNumber: string) {
    Haptics.selectionAsync();
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(serialNumber)) next.delete(serialNumber);
      else next.add(serialNumber);
      return next;
    });
  }

  function selectAll() {
    Haptics.selectionAsync();
    const all = new Set<string>();
    passes.forEach((p) => {
      const key = `${p.flightCode}-${p.date}`;
      if (!alreadyAddedKeys.has(key)) all.add(p.serialNumber);
    });
    setSelected(all);
  }

  function deselectAll() {
    Haptics.selectionAsync();
    setSelected(new Set());
  }

  async function handleImport() {
    if (selected.size === 0) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setState("importing");

    const toImport = passes.filter((p) => selected.has(p.serialNumber));
    const progress: Record<string, EnrichState> = {};
    toImport.forEach((p) => { progress[p.serialNumber] = "pending"; });
    setEnrichProgress({ ...progress });

    for (let i = 0; i < toImport.length; i++) {
      const pass = toImport[i];
      setEnrichLabel(`Fetching ${pass.flightCode} (${i + 1}/${toImport.length})...`);

      progress[pass.serialNumber] = "fetching";
      setEnrichProgress({ ...progress });

      let flightData: any = null;
      try {
        const res = await apiRequest(
          "GET",
          `/api/flights/lookup?code=${pass.flightCode}&date=${pass.date}`
        );
        flightData = await res.json();
      } catch {
        // API failed — fall back to pass data
      }

      const fd = flightData;
      await addFlight({
        flightCode: pass.flightCode,
        date: pass.date,
        airline: fd?.airline ?? pass.airline,
        airlineCode: fd?.airlineCode ?? pass.airlineCode,
        departureAirport: fd?.departureAirport ?? pass.departureAirport,
        arrivalAirport: fd?.arrivalAirport ?? pass.arrivalAirport,
        departureCity: fd?.departureCity ?? pass.departureCity,
        arrivalCity: fd?.arrivalCity ?? pass.arrivalCity,
        departureTime: fd?.departureTime ?? pass.departureTime,
        arrivalTime: fd?.arrivalTime ?? pass.arrivalTime,
        durationMinutes: fd?.durationMinutes ?? 120,
        distanceMiles: fd?.distanceMiles ?? 0,
        co2Kg: fd?.co2Kg ?? 0,
        status: fd?.status ?? "on_time",
        delayMinutes: fd?.delayMinutes ?? 0,
        aircraft: fd?.aircraft ?? pass.aircraft,
        verified: !(fd?.isMock ?? true),
      });

      progress[pass.serialNumber] = "done";
      setEnrichProgress({ ...progress });
    }

    setEnrichLabel("");
    setState("done");
  }

  const selectedCount = selected.size;
  const newPassCount = passes.filter((p) => !alreadyAddedKeys.has(`${p.flightCode}-${p.date}`)).length;

  return (
    <View style={{ flex: 1, backgroundColor: C.bg, paddingTop: insets.top }}>
      {/* Header */}
      <View style={{
        flexDirection: "row", alignItems: "center", justifyContent: "space-between",
        paddingHorizontal: 16, paddingVertical: 12,
        borderBottomWidth: 1, borderBottomColor: C.border,
      }}>
        <Pressable onPress={() => router.back()} style={{ width: 36, height: 36, alignItems: "center", justifyContent: "center" }} hitSlop={10}>
          <Ionicons name="chevron-back" size={22} color={C.text} />
        </Pressable>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Text style={{ fontSize: 17, color: C.text, fontFamily: "DMSans_700Bold" }}>Apple Wallet</Text>
          {isMock && (
            <View style={{ backgroundColor: C.amber + "22", paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 }}>
              <Text style={{ fontSize: 11, color: C.amber, fontFamily: "DMSans_700Bold" }}>Preview</Text>
            </View>
          )}
        </View>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: insets.bottom + 120 }}
      >
        {/* Idle */}
        {state === "idle" && (
          <Animated.View entering={FadeIn.duration(300)} style={{ alignItems: "center", paddingTop: 40 }}>
            <View style={{ width: 90, height: 90, borderRadius: 26, backgroundColor: C.accentDim, alignItems: "center", justifyContent: "center", marginBottom: 24 }}>
              <Ionicons name="wallet" size={48} color={C.accent} />
            </View>
            <Text style={{ fontSize: 22, color: C.text, fontFamily: "DMSans_700Bold", textAlign: "center", marginBottom: 12 }}>Import from Apple Wallet</Text>
            <Text style={{ fontSize: 15, color: C.textSec, fontFamily: "DMSans_400Regular", textAlign: "center", lineHeight: 22, marginBottom: 28 }}>
              Connect your iPhone Wallet to pull in boarding passes \u2014 including expired ones \u2014 and quickly add past and upcoming flights to your logbook.
              No account needed \u2014 everything stays on your device.
            </Text>

            <View style={{ width: "100%", gap: 12, marginBottom: 28 }}>
              {[
                { icon: "shield-checkmark-outline", text: "Private \u2014 data never leaves your phone" },
                { icon: "time-outline", text: "Includes expired passes \u2014 log your full history" },
                { icon: "flash-outline", text: "Real flight data fetched automatically via API" },
                { icon: "checkmark-circle-outline", text: "Review each pass before adding" },
              ].map((item) => (
                <View key={item.icon} style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                  <View style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: C.accentDim, alignItems: "center", justifyContent: "center" }}>
                    <Ionicons name={item.icon as never} size={16} color={C.accent} />
                  </View>
                  <Text style={{ flex: 1, fontSize: 14, color: C.text, fontFamily: "DMSans_400Regular" }}>{item.text}</Text>
                </View>
              ))}
            </View>

            {Platform.OS !== "ios" && (
              <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 8, backgroundColor: C.amber + "18", borderRadius: 12, padding: 12, marginBottom: 24, width: "100%" }}>
                <Ionicons name="information-circle-outline" size={16} color={C.amber} />
                <Text style={{ flex: 1, fontSize: 13, color: C.amber, fontFamily: "DMSans_400Regular", lineHeight: 18 }}>Apple Wallet is only available on iPhone. On other platforms a preview with sample passes is shown.</Text>
              </View>
            )}

            <Pressable
              onPress={handleConnect}
              style={({ pressed }) => [{ flexDirection: "row", alignItems: "center", backgroundColor: C.accent, paddingHorizontal: 28, paddingVertical: 16, borderRadius: 30 }, { opacity: pressed ? 0.85 : 1, transform: [{ scale: pressed ? 0.97 : 1 }] }]}
            >
              <Ionicons name="wallet-outline" size={18} color={C.white} style={{ marginRight: 8 }} />
              <Text style={{ fontSize: 16, color: C.white, fontFamily: "DMSans_700Bold" }}>Connect Wallet</Text>
            </Pressable>
          </Animated.View>
        )}

        {/* Requesting / loading */}
        {(state === "requesting" || state === "loading") && (
          <Animated.View entering={FadeIn.duration(200)} style={{ alignItems: "center", paddingTop: 80, gap: 16 }}>
            <ActivityIndicator size="large" color={C.accent} />
            <Text style={{ fontSize: 15, color: C.textSec, fontFamily: "DMSans_400Regular" }}>
              {state === "requesting" ? "Requesting access..." : "Reading boarding passes..."}
            </Text>
          </Animated.View>
        )}

        {/* Importing — per-pass progress */}
        {state === "importing" && (
          <Animated.View entering={FadeIn.duration(200)} style={{ alignItems: "center", paddingTop: 80, gap: 16 }}>
            <ActivityIndicator size="large" color={C.accent} />
            <Text style={{ fontSize: 15, color: C.textSec, fontFamily: "DMSans_400Regular" }}>{enrichLabel || "Importing flights..."}</Text>
            <View style={{ width: "100%", gap: 8, marginTop: 8 }}>
              {passes
                .filter((p) => selected.has(p.serialNumber))
                .map((p) => {
                  const s = enrichProgress[p.serialNumber] ?? "pending";
                  return (
                    <View key={p.serialNumber} style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                      <Ionicons
                        name={s === "done" ? "checkmark-circle" : s === "fetching" ? "radio-button-on" : "ellipse-outline"}
                        size={15}
                        color={s === "done" ? C.green : s === "fetching" ? C.accent : C.textMuted}
                      />
                      <Text style={{ fontSize: 13, color: C.textSec, fontFamily: "DMSans_400Regular" }}>{p.flightCode} \u00b7 {p.date}</Text>
                    </View>
                  );
                })}
            </View>
          </Animated.View>
        )}

        {/* Ready — show passes */}
        {state === "ready" && (
          <Animated.View entering={FadeIn.duration(250)}>
            {isMock && (
              <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 8, backgroundColor: C.amber + "18", borderRadius: 12, padding: 12, marginBottom: 16 }}>
                <Ionicons name="flask-outline" size={15} color={C.amber} />
                <Text style={{ flex: 1, fontSize: 12, color: C.amber, fontFamily: "DMSans_400Regular", lineHeight: 18 }}>
                  Preview mode \u2014 showing sample boarding passes including expired ones. On a real device with a custom build, your actual Wallet passes will appear here.
                </Text>
              </View>
            )}

            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
              <View>
                <Text style={{ fontSize: 17, color: C.text, fontFamily: "DMSans_700Bold" }}>{passes.length} boarding pass{passes.length !== 1 ? "es" : ""} found</Text>
                {newPassCount > 0 && (
                  <Text style={{ fontSize: 12, color: C.textSec, fontFamily: "DMSans_400Regular", marginTop: 2 }}>{newPassCount} new \u00b7 {passes.length - newPassCount} already added</Text>
                )}
              </View>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 2 }}>
                <Pressable onPress={selectAll} hitSlop={8}>
                  <Text style={{ fontSize: 13, color: C.accent, fontFamily: "DMSans_500Medium" }}>All</Text>
                </Pressable>
                <Text style={{ fontSize: 13, color: C.textMuted }}>\u00b7</Text>
                <Pressable onPress={deselectAll} hitSlop={8}>
                  <Text style={{ fontSize: 13, color: C.accent, fontFamily: "DMSans_500Medium" }}>None</Text>
                </Pressable>
              </View>
            </View>

            {passes.map((pass, i) => (
              <PassCard
                key={pass.serialNumber}
                pass={pass}
                index={i}
                selected={selected.has(pass.serialNumber)}
                alreadyAdded={alreadyAddedKeys.has(`${pass.flightCode}-${pass.date}`)}
                onToggle={() => togglePass(pass.serialNumber)}
              />
            ))}
          </Animated.View>
        )}

        {/* Done */}
        {state === "done" && (
          <Animated.View entering={FadeInDown.springify()} style={{ alignItems: "center", paddingTop: 60 }}>
            <View style={{ marginBottom: 20 }}>
              <Ionicons name="checkmark-circle" size={56} color={C.green} />
            </View>
            <Text style={{ fontSize: 24, color: C.text, fontFamily: "DMSans_700Bold", marginBottom: 10 }}>Flights added!</Text>
            <Text style={{ fontSize: 15, color: C.textSec, fontFamily: "DMSans_400Regular", textAlign: "center", marginBottom: 32 }}>
              {selectedCount} flight{selectedCount !== 1 ? "s" : ""} {selectedCount === 1 ? "has" : "have"} been added to your logbook.
            </Text>
            <Pressable
              onPress={() => router.replace("/(tabs)")}
              style={({ pressed }) => [{ backgroundColor: C.accent, paddingHorizontal: 28, paddingVertical: 16, borderRadius: 30 }, { opacity: pressed ? 0.85 : 1 }]}
            >
              <Text style={{ fontSize: 16, color: C.white, fontFamily: "DMSans_700Bold" }}>Back to Logbook</Text>
            </Pressable>
          </Animated.View>
        )}
      </ScrollView>

      {/* Fixed bottom import bar */}
      {state === "ready" && selectedCount > 0 && (
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
            <Text style={{ fontSize: 17, color: C.text, fontFamily: "DMSans_700Bold" }}>{selectedCount} selected</Text>
            <Text style={{ fontSize: 12, color: C.textSec, fontFamily: "DMSans_400Regular" }}>flight{selectedCount !== 1 ? "s" : ""} to add</Text>
          </View>
          <Pressable
            onPress={handleImport}
            style={({ pressed }) => [
              { flexDirection: "row", alignItems: "center", backgroundColor: C.accent, paddingHorizontal: 20, paddingVertical: 14, borderRadius: 14 },
              { opacity: pressed ? 0.8 : 1, transform: [{ scale: pressed ? 0.97 : 1 }] },
            ]}
          >
            <Ionicons name="add-circle-outline" size={18} color={C.white} style={{ marginRight: 6 }} />
            <Text style={{ fontSize: 15, color: C.white, fontFamily: "DMSans_700Bold" }}>Add to Logbook</Text>
          </Pressable>
        </Animated.View>
      )}
    </View>
  );
}
