/**
 * wallet-import.tsx
 * Boarding pass import screen.
 *
 * Import methods:
 *  1. Scan Boarding Pass  → camera (boarding-pass-scan.tsx) → BCBP barcode
 *  2. Pick from Gallery   → image picker → scanFromURLAsync → BCBP barcode
 *  3. Import from Wallet  → document picker → .pkpass file → pkpassParser
 *
 * All three paths converge at mergePasses() → flight enrichment → addFlight()
 */
import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  Pressable,
  ScrollView,
  Platform,
  ActivityIndicator,
  Alert,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import Animated, { FadeInDown, FadeIn } from "react-native-reanimated";
import { useColors } from "@/constants/colors";
import { useFlights } from "@/context/flights";
import { apiRequest } from "@/lib/query-client";
import { parseBCBP } from "@/utils/bcbpParser";
import { parsePkpassFile } from "@/utils/pkpassParser";
import type { BCBPFlight } from "@/utils/bcbpParser";

// Lazy-load expo-camera for scanFromURLAsync (native module)
let scanFromURLAsync: ((url: string, types?: string[]) => Promise<{ data: string }[]>) | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  scanFromURLAsync = require("expo-camera").scanFromURLAsync;
} catch { /* not available in this build */ }

// ─── Types ────────────────────────────────────────────────────────────────────

type ImportState = "idle" | "scanning" | "importing" | "done";
type EnrichState = "pending" | "fetching" | "done" | "failed";

interface ScannedPass extends BCBPFlight {
  id: string;
  airline: string;
  departureCity: string;
  arrivalCity: string;
  departureTime: string;
  arrivalTime: string;
  aircraft: string;
  /** source lets us show a subtle badge on the card */
  source?: "camera" | "gallery" | "pkpass";
}

// ─── PassCard ─────────────────────────────────────────────────────────────────

function PassCard({
  pass,
  selected,
  alreadyAdded,
  onToggle,
  index,
}: {
  pass: ScannedPass;
  selected: boolean;
  alreadyAdded: boolean;
  onToggle: () => void;
  index: number;
}) {
  const C = useColors();
  const isUpcoming = pass.date >= new Date().toISOString().substring(0, 10);

  const sourceBadge: Record<string, { icon: string; label: string }> = {
    pkpass:  { icon: "wallet-outline",  label: "Wallet" },
    gallery: { icon: "images-outline",  label: "Gallery" },
    camera:  { icon: "scan-outline",    label: "Scan" },
  };
  const badge = pass.source ? sourceBadge[pass.source] : null;

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
        <View style={{ width: 3, backgroundColor: alreadyAdded ? C.border : selected ? C.accent : C.border }} />

        <View style={{ flex: 1, paddingHorizontal: 14, paddingVertical: 14 }}>
          <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 5 }}>
            <Text style={{ fontSize: 20, color: C.text, fontFamily: "DMSans_700Bold" }}>{pass.departureAirport}</Text>
            <View style={{ flex: 1, flexDirection: "row", alignItems: "center", marginHorizontal: 8, gap: 3 }}>
              <View style={{ flex: 1, height: 1, backgroundColor: C.border }} />
              <Ionicons name="airplane" size={13} color={alreadyAdded ? C.textMuted : selected ? C.accent : C.textSec} />
              <View style={{ flex: 1, height: 1, backgroundColor: C.border }} />
            </View>
            <Text style={{ fontSize: 20, color: C.text, fontFamily: "DMSans_700Bold" }}>{pass.arrivalAirport}</Text>
          </View>

          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
            <Text style={{ fontSize: 12, color: C.textSec, fontFamily: "DMSans_500Medium" }}>{pass.flightCode}</Text>
            {pass.airline ? (
              <>
                <View style={{ width: 3, height: 3, borderRadius: 1.5, backgroundColor: C.textMuted }} />
                <Text style={{ fontSize: 12, color: C.textSec, fontFamily: "DMSans_400Regular" }}>{pass.airline}</Text>
              </>
            ) : null}
            <View style={{ width: 3, height: 3, borderRadius: 1.5, backgroundColor: C.textMuted }} />
            <Text style={{ fontSize: 12, color: C.textSec, fontFamily: "DMSans_400Regular" }}>
              {new Date(pass.date + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
            </Text>
            {pass.seat ? (
              <>
                <View style={{ width: 3, height: 3, borderRadius: 1.5, backgroundColor: C.textMuted }} />
                <Text style={{ fontSize: 12, color: C.textSec, fontFamily: "DMSans_400Regular" }}>Seat {pass.seat}</Text>
              </>
            ) : null}
          </View>
        </View>

        <View style={{ paddingHorizontal: 14, paddingVertical: 14, alignItems: "center", justifyContent: "center", gap: 8 }}>
          {alreadyAdded ? (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: C.green + "18", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 }}>
              <Ionicons name="checkmark" size={12} color={C.green} />
              <Text style={{ fontSize: 11, color: C.green, fontFamily: "DMSans_700Bold" }}>Added</Text>
            </View>
          ) : (
            <View style={[
              { width: 24, height: 24, borderRadius: 12, borderWidth: 2, alignItems: "center", justifyContent: "center" },
              selected ? { backgroundColor: C.accent, borderColor: C.accent } : { borderColor: C.border },
            ]}>
              {selected && <Ionicons name="checkmark" size={14} color={C.white} />}
            </View>
          )}
          {isUpcoming && !alreadyAdded && (
            <View style={{ backgroundColor: C.accentDim, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 }}>
              <Text style={{ fontSize: 10, color: C.accent, fontFamily: "DMSans_700Bold" }}>Upcoming</Text>
            </View>
          )}
          {badge && (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 3, backgroundColor: C.surface, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, borderWidth: 1, borderColor: C.border }}>
              <Ionicons name={badge.icon as never} size={10} color={C.textMuted} />
              <Text style={{ fontSize: 9, color: C.textMuted, fontFamily: "DMSans_500Medium" }}>{badge.label}</Text>
            </View>
          )}
        </View>
      </Pressable>
    </Animated.View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function WalletImportScreen() {
  const C = useColors();
  const insets = useSafeAreaInsets();
  const { flights, addFlight } = useFlights();
  const params = useLocalSearchParams<{ scanned?: string }>();

  const [passes, setPasses] = useState<ScannedPass[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [importState, setImportState] = useState<ImportState>("idle");
  const [enrichProgress, setEnrichProgress] = useState<Record<string, EnrichState>>({});
  const [enrichLabel, setEnrichLabel] = useState("");

  const alreadyAddedKeys = new Set(flights.map((f) => `${f.flightCode}-${f.date}`));

  // ── Receive decoded passes from camera scanner ────────────────────────────
  useEffect(() => {
    if (!params.scanned) return;
    try {
      const decoded: BCBPFlight[] = JSON.parse(decodeURIComponent(params.scanned));
      mergePasses(decoded, "camera");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      Alert.alert("Scan Error", "Could not read the boarding pass barcode. Try scanning again.");
    }
  }, [params.scanned]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Shared helper: merge new BCBPFlights into state ───────────────────────
  function mergePasses(decoded: BCBPFlight[], source?: ScannedPass["source"]) {
    const newPasses: ScannedPass[] = decoded.map((f, i) => ({
      ...f,
      id: `${f.flightCode}-${f.date}-${i}`,
      airline: f.airlineCode,
      departureCity: f.departureAirport,
      arrivalCity: f.arrivalAirport,
      departureTime: "00:00",
      arrivalTime: "00:00",
      aircraft: "Unknown",
      source,
    }));

    setPasses((prev) => {
      const existingIds = new Set(prev.map((p) => p.id));
      const merged = [...prev, ...newPasses.filter((p) => !existingIds.has(p.id))];
      return merged.sort((a, b) => b.date.localeCompare(a.date));
    });

    setSelected((prev) => {
      const next = new Set(prev);
      newPasses.forEach((p) => {
        if (!alreadyAddedKeys.has(`${p.flightCode}-${p.date}`)) next.add(p.id);
      });
      return next;
    });
  }

  // ── .pkpass file picker ───────────────────────────────────────────────────
  async function handlePickPkpass() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    let result;
    try {
      result = await DocumentPicker.getDocumentAsync({
        // Accept .pkpass files; also allow * as fallback since some Android
        // file managers don't know the MIME type.
        type: Platform.OS === "ios"
          ? ["com.apple.pkpass", "public.data"]
          : ["application/octet-stream", "*/*"],
        copyToCacheDirectory: true,
        multiple: false,
      });
    } catch {
      Alert.alert("Error", "Could not open file picker. Please try again.");
      return;
    }

    if (result.canceled || !result.assets?.[0]) return;

    const asset = result.assets[0];

    // Validate extension
    const name = asset.name ?? asset.uri ?? "";
    if (!name.toLowerCase().endsWith(".pkpass") && !name.toLowerCase().endsWith(".pkpass)")) {
      // On iOS the system will only show .pkpass files; on Android warn if wrong type selected
      Alert.alert(
        "Wrong File Type",
        "Please select a .pkpass boarding pass file. You can export it by tapping Share on a pass in Apple Wallet."
      );
      return;
    }

    setImportState("scanning");

    const parseResult = await parsePkpassFile(asset.uri);

    setImportState("idle");

    if (!parseResult.ok) {
      Alert.alert(
        "Could Not Read Pass",
        parseResult.error + "\n\nMake sure you're selecting a boarding pass .pkpass file exported from Apple Wallet."
      );
      return;
    }

    // Convert PkpassFlight → BCBPFlight shape so mergePasses() can handle it
    const bcbpFlights: BCBPFlight[] = parseResult.flights.map((f) => ({
      flightCode:       f.flightCode,
      airlineCode:      f.airlineCode,
      flightNumber:     f.flightNumber,
      departureAirport: f.departureAirport,
      arrivalAirport:   f.arrivalAirport,
      date:             f.date,
      seat:             f.seat,
      boardingGroup:    f.boardingGroup,
      passengerName:    f.passengerName,
      bookingRef:       f.bookingRef,
    }));

    mergePasses(bcbpFlights, "pkpass");
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }

  // ── Gallery picker ───────────────────────────────────────────────────────
  async function handlePickFromGallery() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert(
        "Photos Access Needed",
        "Please allow access to your photo library so Logbook can read the barcode from your boarding pass image.",
        [
          { text: "Cancel", style: "cancel" },
          { text: "Open Settings", onPress: () => ImagePicker.requestMediaLibraryPermissionsAsync() },
        ]
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsMultipleSelection: false,
      quality: 1,
    });

    if (result.canceled || !result.assets[0]) return;

    const imageUri = result.assets[0].uri;
    setImportState("scanning");

    try {
      if (!scanFromURLAsync) {
        throw new Error("native_unavailable");
      }

      const barcodes = await scanFromURLAsync(imageUri, [
        "aztec", "pdf417", "qr", "code128", "code39", "datamatrix",
      ]);

      if (!barcodes || barcodes.length === 0) {
        setImportState("idle");
        Alert.alert(
          "No Barcode Found",
          "Logbook couldn't find a boarding pass barcode in this image. Make sure the barcode is clearly visible and not blurry."
        );
        return;
      }

      let parsed: ReturnType<typeof parseBCBP> | null = null;
      for (const bc of barcodes) {
        const attempt = parseBCBP(bc.data);
        if (attempt.ok && attempt.flights.length > 0) {
          parsed = attempt;
          break;
        }
      }

      if (!parsed || !parsed.ok || parsed.flights.length === 0) {
        setImportState("idle");
        Alert.alert(
          "Not a Boarding Pass",
          "A barcode was found but it doesn't appear to be a boarding pass. Make sure you're selecting a boarding pass image."
        );
        return;
      }

      setImportState("idle");
      mergePasses(parsed.flights, "gallery");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e: any) {
      setImportState("idle");
      if (e?.message === "native_unavailable") {
        Alert.alert(
          "Development Build Required",
          "Gallery barcode scanning requires a custom development build. Run:\n\neas build --profile development --platform ios"
        );
      } else {
        Alert.alert("Error", "Failed to scan the image. Please try again.");
      }
    }
  }

  // ── Selection helpers ────────────────────────────────────────────────────
  function togglePass(id: string) {
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
    passes.forEach((p) => { if (!alreadyAddedKeys.has(`${p.flightCode}-${p.date}`)) all.add(p.id); });
    setSelected(all);
  }

  function deselectAll() {
    Haptics.selectionAsync();
    setSelected(new Set());
  }

  // ── Import ───────────────────────────────────────────────────────────────
  async function handleImport() {
    if (selected.size === 0) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setImportState("importing");

    const toImport = passes.filter((p) => selected.has(p.id));
    const progress: Record<string, EnrichState> = {};
    toImport.forEach((p) => { progress[p.id] = "pending"; });
    setEnrichProgress({ ...progress });

    for (let i = 0; i < toImport.length; i++) {
      const pass = toImport[i];
      setEnrichLabel(`Fetching ${pass.flightCode} (${i + 1}/${toImport.length})...`);
      progress[pass.id] = "fetching";
      setEnrichProgress({ ...progress });

      let fd: any = null;
      try {
        const res = await apiRequest("GET", `/api/flights/lookup?code=${pass.flightCode}&date=${pass.date}`);
        fd = await res.json();
      } catch { /* fall back to pass data */ }

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

      progress[pass.id] = "done";
      setEnrichProgress({ ...progress });
    }

    setEnrichLabel("");
    setImportState("done");
  }

  const selectedCount = selected.size;
  const hasPasses = passes.length > 0;

  // ── Render ────────────────────────────────────────────────────────────────
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
        <Text style={{ fontSize: 17, color: C.text, fontFamily: "DMSans_700Bold" }}>Link Apple Wallet</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: insets.bottom + 120 }}
      >

        {/* ── SCANNING / READING ── */}
        {importState === "scanning" && (
          <Animated.View entering={FadeIn.duration(200)} style={{ alignItems: "center", paddingTop: 100, gap: 16 }}>
            <ActivityIndicator size="large" color={C.accent} />
            <Text style={{ fontSize: 15, color: C.textSec, fontFamily: "DMSans_400Regular" }}>
              Reading pass…
            </Text>
          </Animated.View>
        )}

        {/* ── IDLE / EMPTY STATE ── */}
        {importState === "idle" && !hasPasses && (
          <Animated.View entering={FadeIn.duration(300)} style={{ alignItems: "center", paddingTop: 40 }}>
            {/* Icon */}
            <View style={{ width: 90, height: 90, borderRadius: 26, backgroundColor: C.accentDim, alignItems: "center", justifyContent: "center", marginBottom: 24 }}>
              <Ionicons name="wallet-outline" size={44} color={C.accent} />
            </View>

            <Text style={{ fontSize: 22, color: C.text, fontFamily: "DMSans_700Bold", textAlign: "center", marginBottom: 12 }}>
              Import from Apple Wallet
            </Text>
            <Text style={{ fontSize: 15, color: C.textSec, fontFamily: "DMSans_400Regular", textAlign: "center", lineHeight: 22, marginBottom: 28 }}>
              Pick a boarding pass file from your device, scan the barcode directly, or choose a boarding pass photo from your library.
            </Text>

            {/* Feature list */}
            <View style={{ width: "100%", gap: 12, marginBottom: 32 }}>
              {[
                { icon: "wallet-outline",        text: "Export a pass from Wallet → Share → Logbook (.pkpass file)" },
                { icon: "shield-checkmark-outline", text: "100% private — decoded on-device, nothing uploaded" },
                { icon: "time-outline",           text: "Works with old passes too — build your full flight history" },
                { icon: "flash-outline",          text: "Real flight data enriched automatically via API" },
              ].map((item) => (
                <View key={item.icon} style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                  <View style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: C.accentDim, alignItems: "center", justifyContent: "center" }}>
                    <Ionicons name={item.icon as never} size={16} color={C.accent} />
                  </View>
                  <Text style={{ flex: 1, fontSize: 14, color: C.text, fontFamily: "DMSans_400Regular" }}>{item.text}</Text>
                </View>
              ))}
            </View>

            {/* How-to hint */}
            <View style={{ width: "100%", flexDirection: "row", alignItems: "flex-start", gap: 8, backgroundColor: C.accentDim, borderRadius: 12, padding: 14, marginBottom: 28, borderWidth: 1, borderColor: C.accent + "33" }}>
              <Ionicons name="information-circle-outline" size={16} color={C.accent} style={{ marginTop: 1 }} />
              <Text style={{ flex: 1, fontSize: 13, color: C.text, fontFamily: "DMSans_400Regular", lineHeight: 20 }}>
                <Text style={{ fontFamily: "DMSans_700Bold" }}>How to export from Wallet:{"\n"}</Text>
                Open Wallet → tap a boarding pass → tap ··· (top-right) → Share → select Logbook or Save to Files, then import below.
              </Text>
            </View>

            {/* Primary: .pkpass file */}
            <Pressable
              onPress={handlePickPkpass}
              style={({ pressed }) => [{
                flexDirection: "row", alignItems: "center",
                backgroundColor: C.accent, paddingHorizontal: 28, paddingVertical: 16, borderRadius: 30,
                width: "100%", justifyContent: "center", marginBottom: 12,
              }, { opacity: pressed ? 0.85 : 1, transform: [{ scale: pressed ? 0.97 : 1 }] }]}
            >
              <Ionicons name="wallet-outline" size={20} color={C.white} style={{ marginRight: 10 }} />
              <Text style={{ fontSize: 16, color: C.white, fontFamily: "DMSans_700Bold" }}>Import .pkpass File</Text>
            </Pressable>

            {/* Secondary: Camera scan */}
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                router.push("/boarding-pass-scan");
              }}
              style={({ pressed }) => [{
                flexDirection: "row", alignItems: "center", justifyContent: "center",
                backgroundColor: C.card, paddingHorizontal: 28, paddingVertical: 16, borderRadius: 30,
                width: "100%", borderWidth: 1, borderColor: C.border, marginBottom: 12,
              }, { opacity: pressed ? 0.8 : 1, transform: [{ scale: pressed ? 0.97 : 1 }] }]}
            >
              <Ionicons name="scan-outline" size={20} color={C.accent} style={{ marginRight: 10 }} />
              <Text style={{ fontSize: 16, color: C.accent, fontFamily: "DMSans_700Bold" }}>Scan Barcode</Text>
            </Pressable>

            {/* Tertiary: Gallery */}
            <Pressable
              onPress={handlePickFromGallery}
              style={({ pressed }) => [{
                flexDirection: "row", alignItems: "center", justifyContent: "center",
                backgroundColor: C.card, paddingHorizontal: 28, paddingVertical: 16, borderRadius: 30,
                width: "100%", borderWidth: 1, borderColor: C.border,
              }, { opacity: pressed ? 0.8 : 1, transform: [{ scale: pressed ? 0.97 : 1 }] }]}
            >
              <Ionicons name="images-outline" size={20} color={C.accent} style={{ marginRight: 10 }} />
              <Text style={{ fontSize: 16, color: C.accent, fontFamily: "DMSans_700Bold" }}>Pick from Gallery</Text>
            </Pressable>
          </Animated.View>
        )}

        {/* ── PASSES LIST ── */}
        {importState === "idle" && hasPasses && (
          <Animated.View entering={FadeIn.duration(250)}>
            {/* Add more buttons */}
            <View style={{ flexDirection: "row", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
              <Pressable
                onPress={handlePickPkpass}
                style={({ pressed }) => [{
                  flex: 1, minWidth: 90, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
                  paddingVertical: 11, borderRadius: 12,
                  backgroundColor: C.card, borderWidth: 1, borderColor: C.border,
                }, { opacity: pressed ? 0.8 : 1 }]}
              >
                <Ionicons name="wallet-outline" size={15} color={C.accent} />
                <Text style={{ fontSize: 12, color: C.accent, fontFamily: "DMSans_700Bold" }}>.pkpass</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  router.push("/boarding-pass-scan");
                }}
                style={({ pressed }) => [{
                  flex: 1, minWidth: 90, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
                  paddingVertical: 11, borderRadius: 12,
                  backgroundColor: C.card, borderWidth: 1, borderColor: C.border,
                }, { opacity: pressed ? 0.8 : 1 }]}
              >
                <Ionicons name="scan-outline" size={15} color={C.accent} />
                <Text style={{ fontSize: 12, color: C.accent, fontFamily: "DMSans_700Bold" }}>Scan More</Text>
              </Pressable>
              <Pressable
                onPress={handlePickFromGallery}
                style={({ pressed }) => [{
                  flex: 1, minWidth: 90, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
                  paddingVertical: 11, borderRadius: 12,
                  backgroundColor: C.card, borderWidth: 1, borderColor: C.border,
                }, { opacity: pressed ? 0.8 : 1 }]}
              >
                <Ionicons name="images-outline" size={15} color={C.accent} />
                <Text style={{ fontSize: 12, color: C.accent, fontFamily: "DMSans_700Bold" }}>Gallery</Text>
              </Pressable>
            </View>

            {/* List header */}
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
              <View>
                <Text style={{ fontSize: 17, color: C.text, fontFamily: "DMSans_700Bold" }}>
                  {passes.length} pass{passes.length !== 1 ? "es" : ""} found
                </Text>
                {selectedCount > 0 && (
                  <Text style={{ fontSize: 12, color: C.textSec, fontFamily: "DMSans_400Regular", marginTop: 2 }}>
                    {selectedCount} selected to import
                  </Text>
                )}
              </View>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 2 }}>
                <Pressable onPress={selectAll} hitSlop={8}>
                  <Text style={{ fontSize: 13, color: C.accent, fontFamily: "DMSans_500Medium" }}>All</Text>
                </Pressable>
                <Text style={{ fontSize: 13, color: C.textMuted }}>·</Text>
                <Pressable onPress={deselectAll} hitSlop={8}>
                  <Text style={{ fontSize: 13, color: C.accent, fontFamily: "DMSans_500Medium" }}>None</Text>
                </Pressable>
              </View>
            </View>

            {passes.map((pass, i) => (
              <PassCard
                key={pass.id}
                pass={pass}
                index={i}
                selected={selected.has(pass.id)}
                alreadyAdded={alreadyAddedKeys.has(`${pass.flightCode}-${pass.date}`)}
                onToggle={() => togglePass(pass.id)}
              />
            ))}
          </Animated.View>
        )}

        {/* ── IMPORTING ── */}
        {importState === "importing" && (
          <Animated.View entering={FadeIn.duration(200)} style={{ alignItems: "center", paddingTop: 80, gap: 16 }}>
            <ActivityIndicator size="large" color={C.accent} />
            <Text style={{ fontSize: 15, color: C.textSec, fontFamily: "DMSans_400Regular" }}>
              {enrichLabel || "Importing flights..."}
            </Text>
            <View style={{ width: "100%", gap: 8, marginTop: 8 }}>
              {passes.filter((p) => selected.has(p.id)).map((p) => {
                const s = enrichProgress[p.id] ?? "pending";
                return (
                  <View key={p.id} style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                    <Ionicons
                      name={s === "done" ? "checkmark-circle" : s === "fetching" ? "radio-button-on" : "ellipse-outline"}
                      size={15}
                      color={s === "done" ? C.green : s === "fetching" ? C.accent : C.textMuted}
                    />
                    <Text style={{ fontSize: 13, color: C.textSec, fontFamily: "DMSans_400Regular" }}>
                      {p.flightCode} · {p.departureAirport} → {p.arrivalAirport} · {p.date}
                    </Text>
                  </View>
                );
              })}
            </View>
          </Animated.View>
        )}

        {/* ── DONE ── */}
        {importState === "done" && (
          <Animated.View entering={FadeInDown.springify()} style={{ alignItems: "center", paddingTop: 60 }}>
            <View style={{ marginBottom: 20 }}>
              <Ionicons name="checkmark-circle" size={64} color={C.green} />
            </View>
            <Text style={{ fontSize: 24, color: C.text, fontFamily: "DMSans_700Bold", marginBottom: 10 }}>Flights added!</Text>
            <Text style={{ fontSize: 15, color: C.textSec, fontFamily: "DMSans_400Regular", textAlign: "center", marginBottom: 32 }}>
              {selectedCount} flight{selectedCount !== 1 ? "s" : ""} {selectedCount === 1 ? "has" : "have"} been added to your logbook.
            </Text>
            <View style={{ flexDirection: "row", gap: 12 }}>
              <Pressable
                onPress={() => {
                  setImportState("idle");
                  setPasses([]);
                  setSelected(new Set());
                }}
                style={({ pressed }) => [{
                  flexDirection: "row", alignItems: "center", gap: 6,
                  backgroundColor: C.card, paddingHorizontal: 20, paddingVertical: 14, borderRadius: 30,
                  borderWidth: 1, borderColor: C.border,
                }, { opacity: pressed ? 0.8 : 1 }]}
              >
                <Ionicons name="wallet-outline" size={16} color={C.accent} />
                <Text style={{ fontSize: 15, color: C.accent, fontFamily: "DMSans_700Bold" }}>Import More</Text>
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

      {/* Fixed import bar */}
      {importState === "idle" && hasPasses && selectedCount > 0 && (
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
            style={({ pressed }) => [{
              flexDirection: "row", alignItems: "center",
              backgroundColor: C.accent, paddingHorizontal: 20, paddingVertical: 14, borderRadius: 14,
            }, { opacity: pressed ? 0.8 : 1, transform: [{ scale: pressed ? 0.97 : 1 }] }]}
          >
            <Ionicons name="add-circle-outline" size={18} color={C.white} style={{ marginRight: 6 }} />
            <Text style={{ fontSize: 15, color: C.white, fontFamily: "DMSans_700Bold" }}>Add to Logbook</Text>
          </Pressable>
        </Animated.View>
      )}
    </View>
  );
}
