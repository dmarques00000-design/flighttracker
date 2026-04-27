/**
 * boarding-pass-scan.tsx
 * Full-screen camera scanner for boarding pass barcodes.
 * Decodes IATA BCBP format (Aztec / PDF417 / QR) on-device.
 * Returns decoded flight data to wallet-import screen via router params.
 */
import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Platform,
  Vibration,
  Alert,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeIn, useSharedValue, useAnimatedStyle, withRepeat, withTiming, Easing } from "react-native-reanimated";
import { useColors } from "@/constants/colors";
import { parseBCBP } from "@/utils/bcbpParser";

// Lazy-load expo-camera — may not be installed yet; show a graceful error if so
let CameraView: any = null;
let useCameraPermissions: any = null;
try {
  const cam = require("expo-camera");
  CameraView = cam.CameraView;
  useCameraPermissions = cam.useCameraPermissions;
} catch {
  // expo-camera not installed
}

/** Animated scanning line */
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
  const style = useAnimatedStyle(() => ({ transform: [{ translateY: translateY.value }] }));
  return (
    <Animated.View style={[{ height: 2, width: "100%", borderRadius: 1, backgroundColor: C.accent + "CC" }, style]} />
  );
}

/** Corner bracket decorations for the scan frame */
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
      {corners.map((style, i) => (
        <View key={i} style={[{ position: "absolute", width: size, height: size, borderColor: color }, style]} />
      ))}
    </>
  );
}

export default function BoardingPassScanScreen() {
  const C = useColors();
  const insets = useSafeAreaInsets();
  const [scanned, setScanned] = useState(false);
  const [torch, setTorch] = useState(false);
  const debounceRef = useRef(false);

  // Handle case where expo-camera is not installed
  if (!CameraView || !useCameraPermissions) {
    return (
      <View style={{ flex: 1, backgroundColor: C.bg, paddingTop: insets.top, alignItems: "center", justifyContent: "center", paddingHorizontal: 32 }}>
        <Ionicons name="camera-outline" size={56} color={C.textSec} style={{ marginBottom: 20 }} />
        <Text style={{ fontSize: 20, color: C.text, fontFamily: "DMSans_700Bold", textAlign: "center", marginBottom: 12 }}>Camera not available</Text>
        <Text style={{ fontSize: 14, color: C.textSec, fontFamily: "DMSans_400Regular", textAlign: "center", lineHeight: 21, marginBottom: 28 }}>
          Install expo-camera to enable boarding pass scanning:{"\n"}npx expo install expo-camera
        </Text>
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [{ backgroundColor: C.accent, paddingHorizontal: 24, paddingVertical: 14, borderRadius: 14 }, { opacity: pressed ? 0.8 : 1 }]}
        >
          <Text style={{ color: C.white, fontFamily: "DMSans_700Bold", fontSize: 15 }}>Go Back</Text>
        </Pressable>
      </View>
    );
  }

  // eslint-disable-next-line react-hooks/rules-of-hooks
  const [permission, requestPermission] = useCameraPermissions();

  if (!permission) {
    return <View style={{ flex: 1, backgroundColor: C.bg }} />;
  }

  if (!permission.granted) {
    return (
      <View style={{ flex: 1, backgroundColor: C.bg, paddingTop: insets.top, alignItems: "center", justifyContent: "center", paddingHorizontal: 32 }}>
        <Ionicons name="camera-outline" size={56} color={C.textSec} style={{ marginBottom: 20 }} />
        <Text style={{ fontSize: 20, color: C.text, fontFamily: "DMSans_700Bold", textAlign: "center", marginBottom: 12 }}>Camera Access Needed</Text>
        <Text style={{ fontSize: 14, color: C.textSec, fontFamily: "DMSans_400Regular", textAlign: "center", lineHeight: 21, marginBottom: 28 }}>
          Logbook needs camera access to scan boarding pass barcodes. Your camera is never used for anything else.
        </Text>
        <Pressable
          onPress={requestPermission}
          style={({ pressed }) => [{ backgroundColor: C.accent, paddingHorizontal: 24, paddingVertical: 14, borderRadius: 14, marginBottom: 12 }, { opacity: pressed ? 0.8 : 1 }]}
        >
          <Text style={{ color: C.white, fontFamily: "DMSans_700Bold", fontSize: 15 }}>Allow Camera Access</Text>
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
      // Not a valid boarding pass — keep scanning
      setTimeout(() => { debounceRef.current = false; }, 1500);
      return;
    }

    setScanned(true);
    Vibration.vibrate(100);

    // Pass decoded flights back to wallet-import via router params
    const encoded = encodeURIComponent(JSON.stringify(result.flights));
    router.replace(`/wallet-import?scanned=${encoded}`);
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

      {/* Dark overlay with cut-out */}
      <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
        {/* Top overlay */}
        <View style={{ flex: 1.2, backgroundColor: "rgba(0,0,0,0.55)" }} />
        {/* Middle row: side overlays + scan window */}
        <View style={{ flexDirection: "row", height: 240 }}>
          <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.55)" }} />
          <View style={{ width: 280, position: "relative" }}>
            <FrameCorners color="#FFFFFF" />
            <ScanLine />
          </View>
          <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.55)" }} />
        </View>
        {/* Bottom overlay */}
        <View style={{ flex: 1.8, backgroundColor: "rgba(0,0,0,0.55)" }} />
      </View>

      {/* Top bar */}
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

      {/* Instruction label */}
      <Animated.View
        entering={FadeIn.delay(300).duration(400)}
        style={{ position: "absolute", bottom: insets.bottom + 60, left: 24, right: 24, alignItems: "center" }}
      >
        <View style={{ backgroundColor: "rgba(0,0,0,0.6)", borderRadius: 14, paddingHorizontal: 20, paddingVertical: 12 }}>
          <Text style={{ color: "#FFF", fontFamily: "DMSans_500Medium", fontSize: 14, textAlign: "center", lineHeight: 20 }}>
            Point the camera at the{"\n"}barcode on your boarding pass
          </Text>
          <Text style={{ color: "rgba(255,255,255,0.55)", fontFamily: "DMSans_400Regular", fontSize: 12, textAlign: "center", marginTop: 4 }}>
            Works with physical passes and screen photos
          </Text>
        </View>
      </Animated.View>
    </View>
  );
}
