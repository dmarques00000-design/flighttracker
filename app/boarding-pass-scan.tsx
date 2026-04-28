/**
 * boarding-pass-scan.tsx
 * Full-screen camera scanner for boarding pass barcodes.
 * expo-camera is loaded lazily so the app doesn't crash when the native
 * module isn't available (Expo Go / old dev builds).
 * Also supports picking an image from gallery via expo-image-picker.
 */
import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Vibration,
  ActivityIndicator,
  Alert,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import * as Haptics from "expo-haptics";
import Animated, {
  FadeIn,
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
} from "react-native-reanimated";
import { useColors } from "@/constants/colors";
import { parseBCBP } from "@/utils/bcbpParser";

// ── Lazy-load expo-camera ─────────────────────────────────────────────────────
let CameraView: any = null;
let useCameraPermissions: (() => any) | null = null;
let scanFromURLAsync: ((url: string, types?: string[]) => Promise<{ data: string }[]>) | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const cam = require("expo-camera");
  CameraView = cam.CameraView;
  useCameraPermissions = cam.useCameraPermissions;
  scanFromURLAsync = cam.scanFromURLAsync;
} catch { /* native module not available in this build */ }

// ─── Animated scanning line ───────────────────────────────────────────────────
function ScanLine() {
  const C = useColors();
  const translateY = useSharedValue(0);
  useEffect(() => {
    translateY.value = withRepeat(
      withTiming(220, { duration: 1800, easing: Easing.inOut(Easing.ease) }),
      -1,
      true
    );
  }, []);
  const style = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));
  return (
    <Animated.View
      style={[
        { height: 2, width: "100%", borderRadius: 1, backgroundColor: C.accent + "CC" },
        style,
      ]}
    />
  );
}

// ─── Corner bracket decorations ───────────────────────────────────────────────
function FrameCorners({ color }: { color: string }) {
  const size = 24;
  const thickness = 3;
  const corners = [
    { top: 0, left: 0, borderTopWidth: thickness, borderLeftWidth: thickness },
    { top: 0, right: 0, borderTopWidth: thickness, borderRightWidth: thickness },
    { bottom: 0, left: 0, borderBottomWidth: thickness, borderLeftWidth: thickness },
    { bottom: 0, right: 0, borderBottomWidth: thickness, borderRightWidth: thickness },
  ];
  return (
    <>
      {corners.map((s, i) => (
        <View key={i} style={[{ position: "absolute", width: size, height: size, borderColor: color }, s]} />
      ))}
    </>
  );
}

// ─── "Needs new build" fallback ───────────────────────────────────────────────
function NativeBuildRequired({ onGallery }: { onGallery: () => void }) {
  const C = useColors();
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flex: 1, backgroundColor: C.bg, paddingTop: insets.top, alignItems: "center", justifyContent: "center", paddingHorizontal: 32 }}>
      <View style={{ width: 80, height: 80, borderRadius: 24, backgroundColor: C.accentDim, alignItems: "center", justifyContent: "center", marginBottom: 24 }}>
        <Ionicons name="camera-outline" size={40} color={C.accent} />
      </View>
      <Text style={{ fontSize: 20, color: C.text, fontFamily: "DMSans_700Bold", textAlign: "center", marginBottom: 12 }}>
        Development Build Required
      </Text>
      <Text style={{ fontSize: 14, color: C.textSec, fontFamily: "DMSans_400Regular", textAlign: "center", lineHeight: 22, marginBottom: 24 }}>
        Live camera scanning requires a custom development build. You can still pick a boarding pass photo from your gallery.
      </Text>
      <Pressable
        onPress={onGallery}
        style={({ pressed }) => [{
          flexDirection: "row", alignItems: "center", justifyContent: "center",
          backgroundColor: C.accent, paddingHorizontal: 24, paddingVertical: 14,
          borderRadius: 14, width: "100%", marginBottom: 12,
        }, { opacity: pressed ? 0.8 : 1 }]}
      >
        <Ionicons name="images-outline" size={20} color={C.white} style={{ marginRight: 8 }} />
        <Text style={{ color: C.white, fontFamily: "DMSans_700Bold", fontSize: 15 }}>Pick from Gallery</Text>
      </Pressable>
      <View style={{ backgroundColor: C.card, borderRadius: 12, padding: 14, width: "100%", marginBottom: 20, borderWidth: 1, borderColor: C.border }}>
        <Text style={{ fontSize: 12, color: C.textMuted, fontFamily: "DMSans_400Regular", marginBottom: 4 }}>For live camera scanning, run:</Text>
        <Text style={{ fontSize: 13, color: C.accent, fontFamily: "DMSans_500Medium", letterSpacing: 0.2 }} selectable>
          eas build --profile development --platform ios
        </Text>
      </View>
      <Pressable onPress={() => router.back()} hitSlop={12}>
        <Text style={{ color: C.textSec, fontFamily: "DMSans_400Regular", fontSize: 14 }}>Go Back</Text>
      </Pressable>
    </View>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────
export default function BoardingPassScanScreen() {
  const C = useColors();
  const insets = useSafeAreaInsets();

  async function handleGalleryPick() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Photos Access Needed", "Please allow access to your photo library to read a boarding pass image.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsMultipleSelection: false,
      quality: 1,
    });
    if (result.canceled || !result.assets[0]) return;

    const imageUri = result.assets[0].uri;

    if (!scanFromURLAsync) {
      Alert.alert("Development Build Required", "Gallery barcode scanning requires a custom development build.\n\nRun: eas build --profile development --platform ios");
      return;
    }

    try {
      const barcodes = await scanFromURLAsync(imageUri, ["aztec", "pdf417", "qr", "code128", "code39", "datamatrix"]);
      if (!barcodes || barcodes.length === 0) {
        Alert.alert("No Barcode Found", "Logbook couldn't find a barcode in this image. Make sure the barcode is clearly visible.");
        return;
      }

      let parsed: ReturnType<typeof parseBCBP> | null = null;
      for (const bc of barcodes) {
        const attempt = parseBCBP(bc.data);
        if (attempt.ok && attempt.flights.length > 0) { parsed = attempt; break; }
      }

      if (!parsed?.ok || parsed.flights.length === 0) {
        Alert.alert("Not a Boarding Pass", "A barcode was found but it doesn't look like a boarding pass.");
        return;
      }

      Vibration.vibrate(100);
      const encoded = encodeURIComponent(JSON.stringify(parsed.flights));
      router.replace(`/wallet-import?scanned=${encoded}`);
    } catch {
      Alert.alert("Error", "Failed to scan the image. Please try again.");
    }
  }

  if (!CameraView || !useCameraPermissions) {
    return <NativeBuildRequired onGallery={handleGalleryPick} />;
  }

  return <CameraScanner C={C} insets={insets} onGallery={handleGalleryPick} />;
}

// ─── Camera scanner (only rendered when native module is available) ────────────
function CameraScanner({ C, insets, onGallery }: { C: any; insets: any; onGallery: () => void }) {
  const [permission, requestPermission] = (useCameraPermissions as () => any)();
  const [scanned, setScanned] = useState(false);
  const [torch, setTorch] = useState(false);
  const [galleryLoading, setGalleryLoading] = useState(false);
  const debounceRef = useRef(false);

  if (!permission) {
    return <View style={{ flex: 1, backgroundColor: C.bg }} />;
  }

  if (!permission.granted) {
    return (
      <View style={{ flex: 1, backgroundColor: C.bg, paddingTop: insets.top, alignItems: "center", justifyContent: "center", paddingHorizontal: 32 }}>
        <Ionicons name="camera-outline" size={56} color={C.textSec} style={{ marginBottom: 20 }} />
        <Text style={{ fontSize: 20, color: C.text, fontFamily: "DMSans_700Bold", textAlign: "center", marginBottom: 12 }}>
          Camera Access Needed
        </Text>
        <Text style={{ fontSize: 14, color: C.textSec, fontFamily: "DMSans_400Regular", textAlign: "center", lineHeight: 21, marginBottom: 28 }}>
          Logbook needs camera access to scan boarding pass barcodes. Your camera is never used for anything else.
        </Text>
        <Pressable
          onPress={requestPermission}
          style={({ pressed }) => [{ backgroundColor: C.accent, paddingHorizontal: 24, paddingVertical: 14, borderRadius: 14, marginBottom: 12 }, { opacity: pressed ? 0.8 : 1 }]}
        >
          <Text style={{ color: C.white, fontFamily: "DMSans_700Bold", fontSize: 15 }}>Allow Camera Access</Text>
        </Pressable>
        <Pressable
          onPress={onGallery}
          style={({ pressed }) => [{ flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 14, backgroundColor: C.card, borderWidth: 1, borderColor: C.border, marginBottom: 12 }, { opacity: pressed ? 0.8 : 1 }]}
        >
          <Ionicons name="images-outline" size={16} color={C.accent} />
          <Text style={{ color: C.accent, fontFamily: "DMSans_700Bold", fontSize: 14 }}>Pick from Gallery Instead</Text>
        </Pressable>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Text style={{ color: C.textSec, fontFamily: "DMSans_400Regular", fontSize: 14 }}>Cancel</Text>
        </Pressable>
      </View>
    );
  }

  function handleBarcode({ data }: { data: string }) {
    if (scanned || debounceRef.current) return;
    debounceRef.current = true;

    const result = parseBCBP(data);
    if (!result.ok || result.flights.length === 0) {
      setTimeout(() => { debounceRef.current = false; }, 1500);
      return;
    }

    setScanned(true);
    Vibration.vibrate(100);
    const encoded = encodeURIComponent(JSON.stringify(result.flights));
    router.replace(`/wallet-import?scanned=${encoded}`);
  }

  async function handleGalleryFromCamera() {
    setGalleryLoading(true);
    await onGallery();
    setGalleryLoading(false);
  }

  return (
    <View style={{ flex: 1, backgroundColor: "#000" }}>
      <CameraView
        style={StyleSheet.absoluteFillObject}
        facing="back"
        enableTorch={torch}
        barcodeScannerSettings={{
          barcodeTypes: ["aztec", "pdf417", "qr", "code128", "code39", "datamatrix"],
        }}
        onBarcodeScanned={scanned ? undefined : handleBarcode}
      />

      {/* Dark overlay with transparent scan window */}
      <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
        <View style={{ flex: 1.2, backgroundColor: "rgba(0,0,0,0.55)" }} />
        <View style={{ flexDirection: "row", height: 240 }}>
          <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.55)" }} />
          <View style={{ width: 280, position: "relative" }}>
            <FrameCorners color="#FFFFFF" />
            <ScanLine />
          </View>
          <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.55)" }} />
        </View>
        <View style={{ flex: 1.8, backgroundColor: "rgba(0,0,0,0.55)" }} />
      </View>

      {/* Top bar: close + title + torch */}
      <Animated.View
        entering={FadeIn.duration(300)}
        style={{ position: "absolute", top: insets.top + 8, left: 16, right: 16, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}
      >
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [{ width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(0,0,0,0.5)", alignItems: "center", justifyContent: "center" }, { opacity: pressed ? 0.7 : 1 }]}
          hitSlop={8}
        >
          <Ionicons name="close" size={22} color="#FFF" />
        </Pressable>

        <Text style={{ fontSize: 16, color: "#FFF", fontFamily: "DMSans_700Bold", textShadowColor: "rgba(0,0,0,0.5)", textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3 }}>
          Scan Boarding Pass
        </Text>

        <Pressable
          onPress={() => setTorch((t) => !t)}
          style={({ pressed }) => [{ width: 40, height: 40, borderRadius: 20, backgroundColor: torch ? "rgba(255,200,0,0.3)" : "rgba(0,0,0,0.5)", alignItems: "center", justifyContent: "center" }, { opacity: pressed ? 0.7 : 1 }]}
          hitSlop={8}
        >
          <Ionicons name={torch ? "flashlight" : "flashlight-outline"} size={20} color="#FFF" />
        </Pressable>
      </Animated.View>

      {/* Bottom: instruction + gallery button */}
      <Animated.View
        entering={FadeIn.delay(300).duration(400)}
        style={{ position: "absolute", bottom: insets.bottom + 28, left: 24, right: 24, alignItems: "center", gap: 12 }}
      >
        <View style={{ backgroundColor: "rgba(0,0,0,0.6)", borderRadius: 14, paddingHorizontal: 20, paddingVertical: 12 }}>
          <Text style={{ color: "#FFF", fontFamily: "DMSans_500Medium", fontSize: 14, textAlign: "center", lineHeight: 20 }}>
            Point the camera at the{"\n"}barcode on your boarding pass
          </Text>
          <Text style={{ color: "rgba(255,255,255,0.55)", fontFamily: "DMSans_400Regular", fontSize: 12, textAlign: "center", marginTop: 4 }}>
            Works with physical passes and screen photos
          </Text>
        </View>

        {/* Gallery picker button */}
        <Pressable
          onPress={handleGalleryFromCamera}
          style={({ pressed }) => [{
            flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
            backgroundColor: "rgba(255,255,255,0.15)",
            borderWidth: 1, borderColor: "rgba(255,255,255,0.3)",
            paddingHorizontal: 20, paddingVertical: 11, borderRadius: 30,
          }, { opacity: pressed ? 0.7 : 1 }]}
        >
          {galleryLoading ? (
            <ActivityIndicator size="small" color="#FFF" />
          ) : (
            <Ionicons name="images-outline" size={18} color="#FFF" />
          )}
          <Text style={{ color: "#FFF", fontFamily: "DMSans_600SemiBold", fontSize: 14 }}>
            Pick from Gallery
          </Text>
        </Pressable>
      </Animated.View>
    </View>
  );
}
