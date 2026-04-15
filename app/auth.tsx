/**
 * auth.tsx — Sign Up / Log In screen
 * Full-bleed aviation gradient background with expo-blur glass cards.
 */
import React, { useEffect, useState } from "react";
import {
  View, Text, TextInput, Pressable,
  KeyboardAvoidingView, Platform, ScrollView,
  ActivityIndicator, Alert, Image, StyleSheet, Dimensions,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Animated, { FadeInDown, FadeIn, FadeInUp } from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import Svg, { Path, Circle, Defs, RadialGradient, Stop, Rect } from "react-native-svg";
import { useColors } from "@/constants/colors";
import { useUser } from "@/context/user";
import type { LoginParams } from "@/context/user";
import * as AppleAuthentication from "expo-apple-authentication";

// ─── Google Sign-In lazy loader ─────────────────────────────────────────────────────
type GoogleSigninType = typeof import("@react-native-google-signin/google-signin");
let _googleModule: GoogleSigninType | null = null;
function getGoogleSignin(): GoogleSigninType | null {
  if (_googleModule) return _googleModule;
  try { _googleModule = require("@react-native-google-signin/google-signin"); return _googleModule; } catch { return null; }
}
function isExpoGo(): boolean {
  try { const C = require("expo-constants").default; return C.executionEnvironment === "storeClient"; } catch { return false; }
}

const GOOGLE_WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? "";
const GOOGLE_IOS_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID ?? "";

const TEST_USER = { id: "test-user-001", name: "Diogo Marques", email: "diogo.test@logbook.app", password: "test1234" };
type Tab = "login" | "signup";

const { width: SW, height: SH } = Dimensions.get("window");

// ─── Background scene ─────────────────────────────────────────────────────────────────
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
          d={`M ${SW * 0.05},${SH * 0.82} Q ${SW * 0.42},${SH * 0.28} ${SW * 0.92},${SH * 0.08}`}
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

function GlassInput({
  label, icon, value, onChangeText, placeholder, secureTextEntry,
  keyboardType, autoCapitalize, autoCorrect, returnKeyType, onSubmitEditing, rightElement,
}: {
  label: string; icon: string; value: string;
  onChangeText: (v: string) => void; placeholder: string;
  secureTextEntry?: boolean; keyboardType?: any; autoCapitalize?: any;
  autoCorrect?: boolean; returnKeyType?: any; onSubmitEditing?: () => void;
  rightElement?: React.ReactNode;
}) {
  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={s.inputLabel}>{label}</Text>
      <BlurView intensity={20} tint="dark" style={s.inputBlur}>
        <View style={[StyleSheet.absoluteFill, s.inputTint]} />
        <Ionicons name={icon as never} size={16} color="rgba(255,255,255,0.45)" style={{ marginLeft: 14 }} />
        <TextInput
          style={s.textInput}
          placeholder={placeholder}
          placeholderTextColor="rgba(255,255,255,0.28)"
          value={value}
          onChangeText={onChangeText}
          secureTextEntry={secureTextEntry}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          autoCorrect={autoCorrect}
          returnKeyType={returnKeyType}
          onSubmitEditing={onSubmitEditing}
        />
        {rightElement}
      </BlurView>
    </View>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────────
export default function AuthScreen() {
  const insets  = useSafeAreaInsets();
  const C       = useColors();
  const { login } = useUser();

  const [tab, setTab]              = useState<Tab>("signup");
  const [name, setName]            = useState("");
  const [email, setEmail]          = useState("");
  const [password, setPassword]    = useState("");
  const [showPassword, setShow]    = useState(false);
  const [loading, setLoading]      = useState(false);
  const [appleAvailable, setApple] = useState(false);

  useEffect(() => {
    if (!isExpoGo()) {
      const g = getGoogleSignin();
      if (g) {
        // Only pass offlineAccess when the web client ID is available —
        // passing it without a webClientId throws a native crash.
        const config: Record<string, unknown> = {
          iosClientId: GOOGLE_IOS_CLIENT_ID,
        };
        if (GOOGLE_WEB_CLIENT_ID) {
          config.webClientId = GOOGLE_WEB_CLIENT_ID;
          config.offlineAccess = true;
        }
        g.GoogleSignin.configure(config as any);
      }
    }
    if (Platform.OS === "ios") AppleAuthentication.isAvailableAsync().then(setApple);
  }, []);

  function validateEmail(e: string) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.trim()); }

  async function handleSubmit() {
    if (!validateEmail(email))             { Alert.alert("Invalid email",  "Please enter a valid email address."); return; }
    if (password.length < 6)              { Alert.alert("Weak password",  "Password must be at least 6 characters."); return; }
    if (tab === "signup" && !name.trim()) { Alert.alert("Name required",  "Please enter your name."); return; }
    setLoading(true);
    await new Promise((r) => setTimeout(r, 600));
    await login({
      id: email.trim().toLowerCase(),
      name: tab === "signup" ? name : email.split("@")[0],
      email: email.trim(),
      provider: "email",
    });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setLoading(false);
    router.back();
  }

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
      const fullName  = [cred.fullName?.givenName ?? "", cred.fullName?.familyName ?? ""].filter(Boolean).join(" ").trim();
      const userEmail = cred.email ?? "apple-user@privaterelay.appleid.com";
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

  async function handleGoogleSignIn() {
    if (isExpoGo()) {
      Alert.alert("Not available in Expo Go", "Use email sign-in or the Test Account for now.");
      return;
    }
    if (!GOOGLE_WEB_CLIENT_ID) {
      Alert.alert("Setup required", "Add EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID to your .env file.");
      return;
    }
    const g = getGoogleSignin();
    if (!g) { Alert.alert("Error", "Google Sign In module could not be loaded."); return; }
    const { GoogleSignin, statusCodes } = g;
    try {
      await GoogleSignin.hasPlayServices();
      const userInfo   = await GoogleSignin.signIn();
      const googleUser = (userInfo as any).data?.user ?? (userInfo as any).user;
      if (!googleUser) throw new Error("No user data returned from Google.");
      await login({
        id: googleUser.id,
        name: googleUser.name ?? googleUser.email.split("@")[0],
        email: googleUser.email,
        provider: "google",
        avatarUrl: googleUser.photo ?? "",
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
    } catch (e: any) {
      if (e.code === statusCodes.SIGN_IN_CANCELLED || e.code === statusCodes.IN_PROGRESS) return;
      if (e.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) Alert.alert("Google Sign In", "Google Play Services not available.");
      else Alert.alert("Google Sign In failed", e.message ?? "An error occurred.");
    }
  }

  function handleGuest() { Haptics.selectionAsync(); router.back(); }
  function switchTab(t: Tab) { Haptics.selectionAsync(); setTab(t); }

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
            <Text style={s.heroTitle}>
              {tab === "signup" ? "Start your journey" : "Welcome back"}
            </Text>
            <Text style={s.heroSub}>
              {tab === "signup"
                ? "Back up your flights and access them everywhere."
                : "Sign in to continue tracking your journeys."}
            </Text>
          </Animated.View>

          {/* ── TEST ACCOUNT BANNER ── */}
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
                  <Ionicons name="chevron-forward" size={15} color="#F59E0B" />
                </View>
              </BlurView>
            </Pressable>
          </Animated.View>

          {/* ── SOCIAL BUTTONS ── */}
          <Animated.View entering={FadeInDown.delay(70).springify()} style={{ gap: 10, marginBottom: 16 }}>
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

            <Pressable onPress={handleGoogleSignIn} style={({ pressed }) => [s.socialBtn, { opacity: pressed ? 0.85 : 1 }]}>
              <BlurView intensity={22} tint="dark" style={s.socialBlur}>
                <View style={[StyleSheet.absoluteFill, s.socialTintLight]} />
                <View style={s.googleG}><Text style={s.googleGText}>G</Text></View>
                <Text style={[s.socialLabel, { color: "#fff" }]}>Continue with Google</Text>
              </BlurView>
            </Pressable>
          </Animated.View>

          {/* ── DIVIDER ── */}
          <Animated.View entering={FadeInDown.delay(100).springify()} style={s.divider}>
            <View style={s.dividerLine} />
            <Text style={s.dividerText}>or continue with email</Text>
            <View style={s.dividerLine} />
          </Animated.View>

          {/* ── FORM GLASS CARD ── */}
          <Animated.View entering={FadeInUp.delay(120).springify()}>
            <GlassCard style={{ marginBottom: 16 }}>
              <View style={{ padding: 18, gap: 0 }}>
                <View style={s.tabRow}>
                  <Pressable onPress={() => switchTab("signup")} style={[s.tabBtn, tab === "signup" && s.tabBtnActive]}>
                    <Text style={[s.tabLabel, tab === "signup" && s.tabLabelActive]}>Sign Up</Text>
                  </Pressable>
                  <Pressable onPress={() => switchTab("login")} style={[s.tabBtn, tab === "login" && s.tabBtnActive]}>
                    <Text style={[s.tabLabel, tab === "login" && s.tabLabelActive]}>Log In</Text>
                  </Pressable>
                </View>

                {tab === "signup" && (
                  <GlassInput label="FULL NAME" icon="person-outline" value={name} onChangeText={setName}
                    placeholder="e.g. Diogo Marques" autoCapitalize="words" returnKeyType="next" />
                )}

                <GlassInput label="EMAIL" icon="mail-outline" value={email} onChangeText={setEmail}
                  placeholder="your@email.com" keyboardType="email-address" autoCapitalize="none"
                  autoCorrect={false} returnKeyType="next" />

                <GlassInput label="PASSWORD" icon="lock-closed-outline" value={password} onChangeText={setPassword}
                  placeholder="At least 6 characters" secureTextEntry={!showPassword} autoCapitalize="none"
                  returnKeyType="done" onSubmitEditing={handleSubmit}
                  rightElement={
                    <Pressable onPress={() => setShow((v) => !v)} hitSlop={8}>
                      <Ionicons name={showPassword ? "eye-off-outline" : "eye-outline"} size={18}
                        color="rgba(255,255,255,0.45)" style={{ marginRight: 14 }} />
                    </Pressable>
                  }
                />

                <Pressable
                  onPress={handleSubmit}
                  disabled={loading}
                  style={({ pressed }) => [
                    s.submitBtn,
                    { opacity: pressed || loading ? 0.85 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] },
                  ]}
                >
                  {loading
                    ? <ActivityIndicator color="#fff" />
                    : <Text style={s.submitLabel}>{tab === "signup" ? "Create Account" : "Log In"}</Text>}
                </Pressable>
              </View>
            </GlassCard>
          </Animated.View>

          {/* ── GUEST LINK ── */}
          <Animated.View entering={FadeIn.delay(300)} style={{ alignItems: "center", marginTop: 4 }}>
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
  hero: { alignItems: "center", paddingTop: 12, paddingBottom: 28, gap: 0 },
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
  googleG:     { width: 24, height: 24, borderRadius: 12, backgroundColor: "#fff", alignItems: "center", justifyContent: "center" },
  googleGText: { fontSize: 14, fontFamily: "DMSans_700Bold", color: "#4285F4" },
  divider:     { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 14 },
  dividerLine: { flex: 1, height: 1, backgroundColor: "rgba(255,255,255,0.12)" },
  dividerText: { fontSize: 12, color: "rgba(255,255,255,0.38)", fontFamily: "DMSans_400Regular" },
  tabRow:      { flexDirection: "row", backgroundColor: "rgba(255,255,255,0.06)", borderRadius: 10, padding: 3, marginBottom: 18 },
  tabBtn:      { flex: 1, paddingVertical: 8, alignItems: "center", borderRadius: 8 },
  tabBtnActive:{ backgroundColor: "rgba(255,255,255,0.12)" },
  tabLabel:    { fontSize: 13, color: "rgba(255,255,255,0.45)", fontFamily: "DMSans_600SemiBold" },
  tabLabelActive: { color: "#FFFFFF" },
  inputLabel:  { fontSize: 10, color: "rgba(255,255,255,0.40)", fontFamily: "DMSans_700Bold", letterSpacing: 0.8, marginBottom: 6 },
  inputBlur:   { flexDirection: "row", alignItems: "center", borderRadius: 12, overflow: "hidden", borderWidth: 1, borderColor: "rgba(255,255,255,0.10)", minHeight: 48 },
  inputTint:   { backgroundColor: "rgba(255,255,255,0.04)", borderRadius: 12 },
  textInput:   { flex: 1, color: "#FFFFFF", fontFamily: "DMSans_400Regular", fontSize: 15, paddingHorizontal: 12, paddingVertical: 12 },
  submitBtn:   { backgroundColor: "#3B6FE8", borderRadius: 12, paddingVertical: 14, alignItems: "center", marginTop: 4 },
  submitLabel: { fontSize: 15, color: "#FFFFFF", fontFamily: "DMSans_700Bold" },
  guestLink:   { fontSize: 13, color: "rgba(255,255,255,0.38)", fontFamily: "DMSans_400Regular" },
});
