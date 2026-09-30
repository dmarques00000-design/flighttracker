/**
 * auth.tsx — Sign Up / Log In screen
 * Full-bleed aviation gradient background with expo-blur glass cards.
 */
import React, { useEffect, useState } from "react";
import {
  View, Text,
  Pressable,
  KeyboardAvoidingView, Platform, ScrollView,
  ActivityIndicator, Alert, Image, StyleSheet, Dimensions, Linking,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Animated, { FadeInDown, FadeIn } from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import Svg, { Path, Circle, Defs, RadialGradient, Stop, Rect } from "react-native-svg";
import Constants from "expo-constants";
import { useUser } from "@/context/user";
import * as AppleAuthentication from "expo-apple-authentication";

// ─── Legal URLs ───────────────────────────────────────────────────────────────
// Both must be publicly accessible before account creation (App Store Review §5.1.1).
const PRIVACY_POLICY_URL = "https://dmarques00000-design.github.io/flighttracker/privacy.html";
// Fixed: was /terms.html (404) — the published file is terms-of-use.html
const TERMS_URL          = "https://dmarques00000-design.github.io/flighttracker/terms-of-use.html";

// ─── Test account gate ───────────────────────────────────────────────────────
// Only visible in development and preview EAS builds.
// Set SHOW_TEST_ACCOUNT=true in eas.json dev/preview env; absent in production.
const SHOW_TEST_ACCOUNT: boolean =
  Constants.expoConfig?.extra?.showTestAccount === true;

const TEST_USER = { id: "test-user-001", name: "Diogo Marques", email: "diogo.test@logbook.app" };

const { width: SW, height: SH } = Dimensions.get("window");

// ─── Background scene ─────────────────────────────────────────────────────────
const STARS = [
  [8,  6,  1.8, 0.9], [18, 11, 1.2, 0.7], [32,  4, 2.2, 0.8], [47,  9, 1.5, 0.6],
  [61,  3, 1.8, 0.9], [75,  8, 1.2, 0.7], [88,  5, 2.0, 0.8], [94, 14, 1.5, 0.6],
  [5,  18, 1.0, 0.5], [22, 22, 2.0, 0.8], [38, 16, 1.5, 0.7], [54, 20, 1.0, 0.5],
  [70, 17, 1.8, 0.8], [83, 23, 1.2, 0.6], [12, 30, 2.2, 0.7], [28, 35, 1.5, 0.5],
  [64, 28, 2.0, 0.8], [90, 32, 1.2, 0.6], [45, 38, 1.8, 0.7], [78, 40, 1.5, 0.5],
];

function AviationBackground() {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <LinearGradient
        colors={["#04061A", "#080C2E", "#0D1545", "#111D5E", "#0A1535"]}
        locations={[0, 0.25, 0.5, 0.72, 1]}
        style={StyleSheet.absoluteFill}
        start={{ x: 0.3, y: 0 }}
        end={{ x: 0.7, y: 1 }}
      />
      <LinearGradient
        colors={["transparent", "transparent", "#1A2860", "#243070", "#1C264A"]}
        locations={[0, 0.55, 0.72, 0.85, 1]}
        style={StyleSheet.absoluteFill}
      />
      <LinearGradient
        colors={["#1A3A8A44", "transparent"]}
        locations={[0, 1]}
        start={{ x: 1, y: 0 }}
        end={{ x: 0.2, y: 0.4 }}
        style={StyleSheet.absoluteFill}
      />
      <Svg width={SW} height={SH} style={StyleSheet.absoluteFill}>
        <Defs>
          <RadialGradient id="moonGlow" cx="80%" cy="12%" r="18%">
            <Stop offset="0%"  stopColor="#C8D8FF" stopOpacity="0.18" />
            <Stop offset="60%" stopColor="#4F7FFF" stopOpacity="0.06" />
            <Stop offset="100%" stopColor="transparent" stopOpacity="0" />
          </RadialGradient>
        </Defs>
        <Rect x={0} y={0} width={SW} height={SH} fill="url(#moonGlow)" />
        {STARS.map(([xp, yp, r, o], i) => (
          <Circle
            key={i}
            cx={(xp / 100) * SW}
            cy={(yp / 100) * SH * 0.55}
            r={r as number}
            fill="#FFFFFF"
            opacity={o as number}
          />
        ))}
        <Path
          d={`M ${SW * 0.05},${SH * 0.82} Q ${SW * 0.42},${SH * 0.28} ${SW * 0.92},${SW * 0.08}`}
          fill="none"
          stroke="#4F8EF7"
          strokeWidth={1.2}
          strokeDasharray="6 8"
          opacity={0.25}
        />
        <Circle cx={SW * 0.58} cy={SH * 0.31} r={3.5} fill="#4F8EF7" opacity={0.55} />
        <Circle cx={SW * 0.58} cy={SH * 0.31} r={7}   fill="#4F8EF7" opacity={0.12} />
        <Path
          d={`M 0,${SH * 0.68} Q ${SW * 0.5},${SH * 0.65} ${SW},${SH * 0.68}`}
          fill="none"
          stroke="#5080FF"
          strokeWidth={0.8}
          opacity={0.18}
        />
      </Svg>
    </View>
  );
}

function GlassCard({ children, style }: { children: React.ReactNode; style?: object }) {
  return (
    <BlurView
      intensity={28}
      tint="dark"
      style={[
        { borderRadius: 20, overflow: "hidden", borderWidth: 1, borderColor: "rgba(255,255,255,0.10)" },
        style,
      ]}
    >
      <View style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(10,18,60,0.45)", borderRadius: 20 }]} />
      <View style={{ position: "relative" }}>{children}</View>
    </BlurView>
  );
}

// ─── Legal consent line ───────────────────────────────────────────────────────
// Rendered directly below the sign-in buttons and above the guest link so it
// is visible to the user before they tap any auth action or dismiss the screen.
// Contrast: legalText is rgba(255,255,255,0.55) ≈ 4.1:1 on the dark bg.
// §5.1.1(g): affirmative disclosure must appear before account creation.
function LegalConsent() {
  return (
    <View style={s.legalFooter}>
      <Text style={s.legalText}>
        {"By continuing you agree to our "}
        <Text
          style={s.legalLink}
          onPress={() => Linking.openURL(TERMS_URL)}
          accessibilityRole="link"
          accessibilityLabel="Terms of Service"
        >
          Terms of Service
        </Text>
        {" and "}
        <Text
          style={s.legalLink}
          onPress={() => Linking.openURL(PRIVACY_POLICY_URL)}
          accessibilityRole="link"
          accessibilityLabel="Privacy Policy"
        >
          Privacy Policy
        </Text>
        .
      </Text>
    </View>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────
export default function AuthScreen() {
  const insets  = useSafeAreaInsets();
  const { login, profile } = useUser();

  const [loading, setLoading]      = useState(false);
  const [appleAvailable, setApple] = useState(false);

  useEffect(() => {
    if (Platform.OS === "ios") {
      AppleAuthentication.isAvailableAsync().then(setApple);
    }
  }, []);

  async function handleTestLogin() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setLoading(true);
    await new Promise((r) => setTimeout(r, 400));
    await login({
      id: TEST_USER.id,
      name: TEST_USER.name,
      email: TEST_USER.email,
      provider: "email",
    });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setLoading(false);
    router.back();
  }

  async function handleAppleSignIn() {
    try {
      const cred = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });

      const fullName = [
        cred.fullName?.givenName ?? "",
        cred.fullName?.familyName ?? "",
      ].filter(Boolean).join(" ").trim();

      /**
       * Apple only provides cred.email on the very first sign-in.
       * On every subsequent login it is null.
       *
       * Resolution order:
       *   1. cred.email          — real address or private relay, present on first sign-in only.
       *   2. profile.email       — cached from the previous session if this is a returning Apple user.
       *   3. synthetic fallback  — "<cred.user>@privaterelay.appleid.com"
       *                           cred.user is Apple's stable opaque sub — always present and
       *                           unique per user per app, so this is both deterministic and
       *                           collision-free across all users.
       *
       * We must NEVER fall back to a single shared hardcoded address —
       * that causes a UNIQUE constraint collision on the second Apple user
       * who hides their email.
       */
      const userEmail =
        cred.email ??
        (profile.provider === "apple" && profile.email ? profile.email : null) ??
        `${cred.user}@privaterelay.appleid.com`;

      await login({
        id: cred.user,
        name: fullName || userEmail.split("@")[0],
        email: userEmail,
        provider: "apple",
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
    } catch (e: any) {
      if (e.code !== "ERR_REQUEST_CANCELED") Alert.alert("Apple Sign In failed", e.message ?? "An error occurred.");
    }
  }



  function handleGuest() { Haptics.selectionAsync(); router.back(); }

  return (
    <View style={{ flex: 1 }}>
      <AviationBackground />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: 20, paddingTop: insets.top + 12, paddingBottom: insets.bottom + 36 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* ── TOP BAR: Close button ── */}
          <View style={{ flexDirection: "row", justifyContent: "flex-end", marginBottom: 4 }}>
            <Pressable
              onPress={() => router.back()}
              hitSlop={10}
              style={({ pressed }) => [s.closeBtn, { opacity: pressed ? 0.7 : 1 }]}
            >
              <Ionicons name="close" size={20} color="rgba(255,255,255,0.75)" />
            </Pressable>
          </View>

          {/* ── HERO ── */}
          <Animated.View entering={FadeInDown.delay(0).springify()} style={s.hero}>
            <Image source={require("@/assets/images/icon.png")} style={s.logo} resizeMode="cover" />
            <Text style={s.heroTitle}>Start your journey</Text>
            <Text style={s.heroSub}>
              Back up your flights and access them everywhere.
            </Text>
          </Animated.View>

          {/* ── TEST ACCOUNT BANNER (dev / preview builds only) ── */}
          {SHOW_TEST_ACCOUNT && (
            <Animated.View entering={FadeInDown.delay(40).springify()} style={{ marginBottom: 14 }}>
              <Pressable onPress={handleTestLogin} disabled={loading} style={({ pressed }) => [{ opacity: pressed ? 0.85 : 1 }]}>
                <BlurView intensity={22} tint="dark" style={s.testBanner}>
                  <View style={[StyleSheet.absoluteFill, s.testBannerTint]} />
                  <View style={s.testBannerInner}>
                    <View style={s.testIconWrap}>
                      <Ionicons name="flask-outline" size={18} color="#F59E0B" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={s.testTitle}>Use Test Account</Text>
                      <Text style={s.testEmail}>{TEST_USER.email}</Text>
                    </View>
                    {loading
                      ? <ActivityIndicator size="small" color="#F59E0B" />
                      : <Ionicons name="chevron-forward" size={15} color="#F59E0B" />}
                  </View>
                </BlurView>
              </Pressable>
            </Animated.View>
          )}

          {/* ── SIGN-IN BUTTONS ── */}
          <Animated.View entering={FadeInDown.delay(70).springify()} style={{ gap: 10, marginBottom: 0 }}>
            {Platform.OS === "ios" && appleAvailable ? (
              <AppleAuthentication.AppleAuthenticationButton
                buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
                buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
                cornerRadius={14}
                style={{ width: "100%", height: 52 }}
                onPress={handleAppleSignIn}
              />
            ) : (
              <Pressable onPress={handleAppleSignIn} style={({ pressed }) => [s.socialBtn, { opacity: pressed ? 0.85 : 1 }]}>
                <BlurView intensity={22} tint="dark" style={s.socialBlur}>
                  <View style={[StyleSheet.absoluteFill, s.socialTint]} />
                  <Ionicons name="logo-apple" size={20} color="#fff" />
                  <Text style={s.socialLabel}>Continue with Apple</Text>
                </BlurView>
              </Pressable>
            )}

          </Animated.View>

          {/*
           * ── LEGAL CONSENT (§5.1.1) ──────────────────────────────────────────
           * Positioned BETWEEN the sign-in buttons and the guest/skip link so
           * users see it before completing any auth action or dismissing.
           * Must be legible: opacity ≥ 0.55 on this dark background (~4:1).
           */}
          <Animated.View entering={FadeIn.delay(160)}>
            <LegalConsent />
          </Animated.View>

          {/* ── GUEST LINK ── */}
          <Animated.View entering={FadeIn.delay(220)} style={{ alignItems: "center", marginTop: 4 }}>
            <Pressable onPress={handleGuest} hitSlop={10}>
              <Text style={s.guestLink}>Continue as guest  →</Text>
            </Pressable>
          </Animated.View>

        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const s = StyleSheet.create({
  closeBtn: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: "rgba(255,255,255,0.10)",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.15)",
    alignItems: "center", justifyContent: "center",
  },
  hero: { alignItems: "center", paddingTop: 12, paddingBottom: 36, gap: 0 },
  logo: {
    width: 76, height: 76, borderRadius: 20, marginBottom: 16,
    shadowColor: "#4F8EF7", shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.45, shadowRadius: 20, elevation: 12,
  },
  heroTitle: {
    fontSize: 28, color: "#FFFFFF", fontFamily: "DMSans_700Bold",
    textAlign: "center", letterSpacing: -0.5, marginBottom: 8,
    textShadowColor: "rgba(0,0,0,0.6)", textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 8,
  },
  heroSub: {
    fontSize: 14, color: "rgba(255,255,255,0.62)", fontFamily: "DMSans_400Regular",
    textAlign: "center", lineHeight: 20, paddingHorizontal: 12,
  },
  testBanner:   { borderRadius: 14, overflow: "hidden", borderWidth: 1, borderColor: "rgba(245,158,11,0.30)" },
  testBannerTint: { backgroundColor: "rgba(245,158,11,0.08)", borderRadius: 14 },
  testBannerInner: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 14, paddingVertical: 13 },
  testIconWrap: { width: 34, height: 34, borderRadius: 10, backgroundColor: "rgba(245,158,11,0.15)", alignItems: "center", justifyContent: "center" },
  testTitle: { fontSize: 14, color: "#F59E0B", fontFamily: "DMSans_700Bold" },
  testEmail: { fontSize: 11, color: "rgba(245,158,11,0.70)", fontFamily: "DMSans_400Regular", marginTop: 1 },
  socialBtn:   { borderRadius: 14, overflow: "hidden" },
  socialBlur:  { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, height: 52, borderRadius: 14, borderWidth: 1, borderColor: "rgba(255,255,255,0.12)" },
  socialTint:  { backgroundColor: "rgba(10,18,60,0.55)", borderRadius: 14 },
  socialTintLight: { backgroundColor: "rgba(20,30,80,0.50)", borderRadius: 14 },
  socialLabel: { fontSize: 15, color: "#FFFFFF", fontFamily: "DMSans_700Bold" },
  guestLink:   { fontSize: 13, color: "rgba(255,255,255,0.38)", fontFamily: "DMSans_400Regular" },

  // ── Legal consent — App Store §5.1.1(g) ──────────────────────────────────
  // Opacity 0.55 ≈ 4.1:1 contrast ratio against the dark aviation background.
  // Must not be lower — Apple will reject disclosure text that is not legible.
  legalFooter: {
    alignItems: "center",
    marginTop: 18,
    marginBottom: 14,
    paddingHorizontal: 16,
  },
  legalText: {
    fontSize: 12,
    color: "rgba(255,255,255,0.55)",
    fontFamily: "DMSans_400Regular",
    textAlign: "center",
    lineHeight: 18,
  },
  legalLink: {
    color: "rgba(255,255,255,0.72)",
    fontFamily: "DMSans_500Medium",
    textDecorationLine: "underline",
  },
});
