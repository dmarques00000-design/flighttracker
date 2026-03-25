/**
 * auth.tsx — Sign Up / Log In modal
 */

import React, { useEffect, useState } from "react";
import {
  View, Text, StyleSheet, TextInput, Pressable,
  KeyboardAvoidingView, Platform, ScrollView,
  ActivityIndicator, Alert, Image,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Animated, { FadeInDown, FadeIn } from "react-native-reanimated";
import { useColors } from "@/constants/colors";
import { useUser } from "@/context/user";
import * as AppleAuthentication from "expo-apple-authentication";

type GoogleSigninType = typeof import("@react-native-google-signin/google-signin");
let _googleModule: GoogleSigninType | null = null;
function getGoogleSignin(): GoogleSigninType | null {
  if (_googleModule) return _googleModule;
  try { _googleModule = require("@react-native-google-signin/google-signin"); return _googleModule; } catch { return null; }
}
function isExpoGo(): boolean {
  try { const C = require("expo-constants").default; return C.executionEnvironment === "storeClient"; } catch { return false; }
}

const GOOGLE_WEB_CLIENT_ID = "REPLACE_WITH_YOUR_WEB_CLIENT_ID";
const TEST_USER = { name: "Diogo Marques", email: "diogo.test@logbook.app", password: "test1234" };
type Tab = "login" | "signup";

export default function AuthScreen() {
  const insets = useSafeAreaInsets();
  const C = useColors();
  const { login } = useUser();

  const [tab, setTab]               = useState<Tab>("signup");
  const [name, setName]             = useState("");
  const [email, setEmail]           = useState("");
  const [password, setPassword]     = useState("");
  const [showPassword, setShow]     = useState(false);
  const [loading, setLoading]       = useState(false);
  const [appleAvailable, setApple]  = useState(false);

  useEffect(() => {
    if (!isExpoGo()) { const g = getGoogleSignin(); if (g) g.GoogleSignin.configure({ webClientId: GOOGLE_WEB_CLIENT_ID, offlineAccess: true }); }
    if (Platform.OS === "ios") AppleAuthentication.isAvailableAsync().then(setApple);
  }, []);

  function validateEmail(e: string) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.trim()); }

  async function handleSubmit() {
    if (!validateEmail(email))              { Alert.alert("Invalid email",  "Please enter a valid email address."); return; }
    if (password.length < 6)               { Alert.alert("Weak password",  "Password must be at least 6 characters."); return; }
    if (tab === "signup" && !name.trim())   { Alert.alert("Name required",  "Please enter your name."); return; }
    setLoading(true);
    await new Promise((r) => setTimeout(r, 600));
    await login(tab === "signup" ? name : email.split("@")[0], email);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setLoading(false); router.back();
  }

  async function handleTestLogin() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setLoading(true);
    await new Promise((r) => setTimeout(r, 400));
    await login(TEST_USER.name, TEST_USER.email);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setLoading(false); router.back();
  }

  async function handleAppleSignIn() {
    try {
      const cred = await AppleAuthentication.signInAsync({ requestedScopes: [AppleAuthentication.AppleAuthenticationScope.FULL_NAME, AppleAuthentication.AppleAuthenticationScope.EMAIL] });
      const fullName  = [cred.fullName?.givenName ?? "", cred.fullName?.familyName ?? ""].filter(Boolean).join(" ").trim();
      const userEmail = cred.email ?? "apple-user@privaterelay.appleid.com";
      await login(fullName || userEmail.split("@")[0], userEmail);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); router.back();
    } catch (e: any) { if (e.code !== "ERR_REQUEST_CANCELED") Alert.alert("Apple Sign In failed", e.message ?? "An error occurred."); }
  }

  async function handleGoogleSignIn() {
    if (isExpoGo()) { Alert.alert("Not available in Expo Go", "Use email sign-in or the Test Account for now."); return; }
    if (GOOGLE_WEB_CLIENT_ID === "REPLACE_WITH_YOUR_WEB_CLIENT_ID") { Alert.alert("Setup required", "Add your Google Web Client ID to auth.tsx."); return; }
    const g = getGoogleSignin(); if (!g) { Alert.alert("Error", "Google Sign In module could not be loaded."); return; }
    const { GoogleSignin, statusCodes } = g;
    try {
      await GoogleSignin.hasPlayServices();
      const userInfo   = await GoogleSignin.signIn();
      const googleUser = (userInfo as any).data?.user ?? (userInfo as any).user;
      if (!googleUser) throw new Error("No user data returned from Google.");
      await login(googleUser.name ?? googleUser.email.split("@")[0], googleUser.email);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); router.back();
    } catch (e: any) {
      if (e.code === statusCodes.SIGN_IN_CANCELLED || e.code === statusCodes.IN_PROGRESS) return;
      if (e.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) Alert.alert("Google Sign In", "Google Play Services not available.");
      else Alert.alert("Google Sign In failed", e.message ?? "An error occurred.");
    }
  }

  function handleGuest() { Haptics.selectionAsync(); router.back(); }
  function switchTab(t: Tab) { Haptics.selectionAsync(); setTab(t); }

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: C.bg }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 24, paddingTop: insets.top + 16, paddingBottom: insets.bottom + 32 }}
        keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

        {/* Close */}
        <Pressable onPress={() => router.back()} hitSlop={10}
          style={{ alignSelf: "flex-end", width: 34, height: 34, borderRadius: 17, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, alignItems: "center", justifyContent: "center", marginBottom: 8 }}>
          <Ionicons name="close" size={22} color={C.textSec} />
        </Pressable>

        {/* Hero */}
        <Animated.View entering={FadeInDown.delay(0).springify()} style={{ alignItems: "center", marginBottom: 24 }}>
          <Image source={require("@/assets/images/icon.png")} style={{ width: 80, height: 80, borderRadius: 20, marginBottom: 18 }} resizeMode="cover" />
          <Text style={{ fontSize: 26, color: C.text,    fontFamily: "DMSans_700Bold",    textAlign: "center", marginBottom: 8 }}>{tab === "signup" ? "Create your account" : "Welcome back"}</Text>
          <Text style={{ fontSize: 14, color: C.textSec, fontFamily: "DMSans_400Regular", textAlign: "center", lineHeight: 20 }}>{tab === "signup" ? "Back up your flights and access them anywhere." : "Sign in to continue tracking your journeys."}</Text>
        </Animated.View>

        {/* Test Account */}
        <Animated.View entering={FadeInDown.delay(30).springify()}>
          <Pressable onPress={handleTestLogin} disabled={loading}
            style={({ pressed }) => [{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: "rgba(245,158,11,0.08)", borderRadius: 14, borderWidth: 1.5, borderColor: "rgba(245,158,11,0.30)", paddingHorizontal: 16, paddingVertical: 12, marginBottom: 20, opacity: pressed ? 0.8 : 1 }]}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
              <Ionicons name="flask-outline" size={18} color="#F59E0B" />
              <View>
                <Text style={{ fontSize: 14, color: "#F59E0B", fontFamily: "DMSans_700Bold" }}>Use Test Account</Text>
                <Text style={{ fontSize: 11, color: "#B07800", fontFamily: "DMSans_400Regular", marginTop: 1 }}>{TEST_USER.email}</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={16} color="#F59E0B" />
          </Pressable>
        </Animated.View>

        {/* Social */}
        <Animated.View entering={FadeInDown.delay(50).springify()} style={{ gap: 12, marginBottom: 20 }}>
          {Platform.OS === "ios" && appleAvailable ? (
            <AppleAuthentication.AppleAuthenticationButton buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN} buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK} cornerRadius={14} style={{ width: "100%", height: 52 }} onPress={handleAppleSignIn} />
          ) : (
            <Pressable style={({ pressed }) => [{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, backgroundColor: "#1A1A1A", borderRadius: 14, height: 52, opacity: pressed ? 0.85 : 1 }]} onPress={handleAppleSignIn}>
              <Ionicons name="logo-apple" size={20} color="#fff" />
              <Text style={{ fontSize: 15, color: "#fff", fontFamily: "DMSans_700Bold" }}>Continue with Apple</Text>
            </Pressable>
          )}
          <Pressable style={({ pressed }) => [{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, backgroundColor: C.white, borderRadius: 14, height: 52, borderWidth: 1.5, borderColor: C.border, opacity: pressed ? 0.85 : 1 }]} onPress={handleGoogleSignIn}>
            <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: "#fff", alignItems: "center", justifyContent: "center" }}><Text style={{ fontSize: 15, fontFamily: "DMSans_700Bold", color: "#4285F4" }}>G</Text></View>
            <Text style={{ fontSize: 15, color: C.text, fontFamily: "DMSans_700Bold" }}>Continue with Google</Text>
          </Pressable>
        </Animated.View>

        {/* Divider */}
        <Animated.View entering={FadeInDown.delay(90).springify()} style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 16 }}>
          <View style={{ flex: 1, height: 1, backgroundColor: C.border }} />
          <Text style={{ fontSize: 12, color: C.textMuted, fontFamily: "DMSans_400Regular" }}>or continue with email</Text>
          <View style={{ flex: 1, height: 1, backgroundColor: C.border }} />
        </Animated.View>

        {/* Tabs */}
        <Animated.View entering={FadeInDown.delay(110).springify()} style={{ flexDirection: "row", backgroundColor: C.surface, borderRadius: 14, borderWidth: 1, borderColor: C.border, padding: 4, marginBottom: 20 }}>
          <Pressable onPress={() => switchTab("signup")} style={{ flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: "center", backgroundColor: tab === "signup" ? C.accent : "transparent" }}>
            <Text style={{ fontSize: 14, fontFamily: tab === "signup" ? "DMSans_700Bold" : "DMSans_500Medium", color: tab === "signup" ? C.white : C.textSec }}>Sign Up</Text>
          </Pressable>
          <Pressable onPress={() => switchTab("login")} style={{ flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: "center", backgroundColor: tab === "login" ? C.accent : "transparent" }}>
            <Text style={{ fontSize: 14, fontFamily: tab === "login" ? "DMSans_700Bold" : "DMSans_500Medium", color: tab === "login" ? C.white : C.textSec }}>Log In</Text>
          </Pressable>
        </Animated.View>

        {/* Form */}
        <Animated.View entering={FadeInDown.delay(140).springify()} style={{ gap: 0 }}>
          {tab === "signup" && (
            <View style={{ marginBottom: 16 }}>
              <Text style={{ fontSize: 11, color: C.textSec, fontFamily: "DMSans_500Medium", textTransform: "uppercase", letterSpacing: 0.7, marginBottom: 6 }}>Full Name</Text>
              <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: C.surface, borderRadius: 12, borderWidth: 1.5, borderColor: C.border }}>
                <Ionicons name="person-outline" size={16} color={C.textMuted} style={{ marginLeft: 14 }} />
                <TextInput style={{ flex: 1, paddingHorizontal: 10, paddingVertical: 14, fontSize: 15, color: C.text, fontFamily: "DMSans_400Regular" }}
                  placeholder="e.g. Diogo Marques" placeholderTextColor={C.textMuted} value={name} onChangeText={setName} autoCapitalize="words" returnKeyType="next" />
              </View>
            </View>
          )}
          <View style={{ marginBottom: 16 }}>
            <Text style={{ fontSize: 11, color: C.textSec, fontFamily: "DMSans_500Medium", textTransform: "uppercase", letterSpacing: 0.7, marginBottom: 6 }}>Email</Text>
            <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: C.surface, borderRadius: 12, borderWidth: 1.5, borderColor: C.border }}>
              <Ionicons name="mail-outline" size={16} color={C.textMuted} style={{ marginLeft: 14 }} />
              <TextInput style={{ flex: 1, paddingHorizontal: 10, paddingVertical: 14, fontSize: 15, color: C.text, fontFamily: "DMSans_400Regular" }}
                placeholder="your@email.com" placeholderTextColor={C.textMuted} value={email} onChangeText={setEmail}
                keyboardType="email-address" autoCapitalize="none" autoCorrect={false} returnKeyType="next" />
            </View>
          </View>
          <View style={{ marginBottom: 16 }}>
            <Text style={{ fontSize: 11, color: C.textSec, fontFamily: "DMSans_500Medium", textTransform: "uppercase", letterSpacing: 0.7, marginBottom: 6 }}>Password</Text>
            <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: C.surface, borderRadius: 12, borderWidth: 1.5, borderColor: C.border }}>
              <Ionicons name="lock-closed-outline" size={16} color={C.textMuted} style={{ marginLeft: 14 }} />
              <TextInput style={{ flex: 1, paddingHorizontal: 10, paddingVertical: 14, fontSize: 15, color: C.text, fontFamily: "DMSans_400Regular" }}
                placeholder="At least 6 characters" placeholderTextColor={C.textMuted} value={password} onChangeText={setPassword}
                secureTextEntry={!showPassword} autoCapitalize="none" returnKeyType="done" onSubmitEditing={handleSubmit} />
              <Pressable onPress={() => setShow((v) => !v)} hitSlop={8}>
                <Ionicons name={showPassword ? "eye-off-outline" : "eye-outline"} size={18} color={C.textMuted} style={{ marginRight: 14 }} />
              </Pressable>
            </View>
          </View>
          <Pressable onPress={handleSubmit} disabled={loading}
            style={({ pressed }) => [{ backgroundColor: C.accent, borderRadius: 14, paddingVertical: 16, alignItems: "center", marginTop: 8, marginBottom: 20, shadowColor: C.accent, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.22, shadowRadius: 10, elevation: 4, opacity: pressed || loading ? 0.85 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] }]}>
            {loading ? <ActivityIndicator color={C.white} /> : <Text style={{ fontSize: 16, color: C.white, fontFamily: "DMSans_700Bold" }}>{tab === "signup" ? "Create Account" : "Log In"}</Text>}
          </Pressable>
        </Animated.View>

        <Animated.View entering={FadeIn.delay(300)} style={{ alignItems: "center", marginTop: 8 }}>
          <Pressable onPress={handleGuest} hitSlop={10}>
            <Text style={{ fontSize: 14, color: C.accent, fontFamily: "DMSans_500Medium" }}>Continue as guest  →</Text>
          </Pressable>
        </Animated.View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
