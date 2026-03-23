/**
 * auth.tsx — Sign Up / Log In modal
 *
 * Social logins:
 *  - Apple Sign In  : uses expo-apple-authentication (native, iOS only)
 *  - Google Sign In : uses @react-native-google-signin/google-signin
 *                     ⚠️  This is a NATIVE module — it will NOT work in Expo Go.
 *                         It is lazy-loaded and guarded so the app still runs in
 *                         Expo Go (the button shows an info alert instead of crashing).
 *
 * Before building for a real device you must:
 *  1. Apple  : enable "Sign In with Apple" capability in your Apple Developer portal
 *              for bundle ID com.logbookapp — no extra config needed after that.
 *  2. Google : replace REPLACE_WITH_YOUR_WEB_CLIENT_ID below with the OAuth 2.0
 *              Web Client ID from Google Cloud Console (APIs & Services › Credentials).
 *              Also replace the iosUrlScheme in app.json with your reversed iOS Client ID.
 *              Download google-services.json from Firebase/Google Cloud and place it
 *              at the root of the project (next to app.json) for Android.
 */

import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  Alert,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Animated, { FadeInDown, FadeIn } from "react-native-reanimated";
import { Colors } from "@/constants/colors";
import { useUser } from "@/context/user";

// ─── Apple ───────────────────────────────────────────────────────────────────
import * as AppleAuthentication from "expo-apple-authentication";

// ─── Google (lazy — native module not available in Expo Go) ──────────────────
// We require() at runtime inside the handler so Metro bundles the module but the
// TurboModule registry is only accessed when the user actually taps the button,
// giving us a chance to show a friendly message instead of a hard crash.
type GoogleSigninType = typeof import("@react-native-google-signin/google-signin");
let _googleModule: GoogleSigninType | null = null;
function getGoogleSignin(): GoogleSigninType | null {
  if (_googleModule) return _googleModule;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    _googleModule = require("@react-native-google-signin/google-signin");
    return _googleModule;
  } catch {
    return null;
  }
}

/**
 * Detect Expo Go at runtime — it does NOT include the RNGoogleSignin native module.
 * We use this flag to show a helpful message rather than letting the app crash.
 */
function isExpoGo(): boolean {
  try {
    // expo-constants is always available
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const Constants = require("expo-constants").default;
    return Constants.executionEnvironment === "storeClient";
  } catch {
    return false;
  }
}

/**
 * REPLACE THIS with your OAuth 2.0 Web Client ID from Google Cloud Console.
 * Project › APIs & Services › Credentials › Web client (auto created by Google Service)
 */
const GOOGLE_WEB_CLIENT_ID = "REPLACE_WITH_YOUR_WEB_CLIENT_ID";

type Tab = "login" | "signup";

export default function AuthScreen() {
  const insets = useSafeAreaInsets();
  const { login } = useUser();

  const [tab, setTab] = useState<Tab>("signup");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [appleAvailable, setAppleAvailable] = useState(false);

  // Configure Google Sign-In (only in a real native build, not Expo Go)
  useEffect(() => {
    if (!isExpoGo()) {
      const g = getGoogleSignin();
      if (g) {
        g.GoogleSignin.configure({
          webClientId: GOOGLE_WEB_CLIENT_ID,
          offlineAccess: true,
        });
      }
    }

    if (Platform.OS === "ios") {
      AppleAuthentication.isAvailableAsync().then(setAppleAvailable);
    }
  }, []);

  // ─── Validation ────────────────────────────────────────────────────────────
  function validateEmail(e: string) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.trim());
  }

  // ─── Email / password submit ────────────────────────────────────────────────
  async function handleSubmit() {
    if (!validateEmail(email)) {
      Alert.alert("Invalid email", "Please enter a valid email address.");
      return;
    }
    if (password.length < 6) {
      Alert.alert("Weak password", "Password must be at least 6 characters.");
      return;
    }
    if (tab === "signup" && !name.trim()) {
      Alert.alert("Name required", "Please enter your name.");
      return;
    }
    setLoading(true);
    // TODO: replace with your real auth backend call (e.g. Supabase, Firebase Auth)
    await new Promise((r) => setTimeout(r, 600));
    await login(tab === "signup" ? name : email.split("@")[0], email);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setLoading(false);
    router.back();
  }

  // ─── Apple Sign In ──────────────────────────────────────────────────────────
  async function handleAppleSignIn() {
    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });

      const fullName = [
        credential.fullName?.givenName ?? "",
        credential.fullName?.familyName ?? "",
      ]
        .filter(Boolean)
        .join(" ")
        .trim();

      const userEmail = credential.email ?? email ?? "apple-user@privaterelay.appleid.com";
      const displayName = fullName || userEmail.split("@")[0];

      await login(displayName, userEmail);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
    } catch (e: any) {
      if (e.code === "ERR_REQUEST_CANCELED") {
        // User dismissed — do nothing
      } else {
        Alert.alert("Apple Sign In failed", e.message ?? "An error occurred.");
      }
    }
  }

  // ─── Google Sign In ─────────────────────────────────────────────────────────
  async function handleGoogleSignIn() {
    // Show friendly message in Expo Go instead of crashing
    if (isExpoGo()) {
      Alert.alert(
        "Not available in Expo Go",
        "Google Sign In requires a custom development build. Use email sign-in for now, or run `eas build --profile development` to test Google Sign In on a real device."
      );
      return;
    }

    if (GOOGLE_WEB_CLIENT_ID === "REPLACE_WITH_YOUR_WEB_CLIENT_ID") {
      Alert.alert(
        "Setup required",
        "Add your Google Web Client ID to app/auth.tsx (GOOGLE_WEB_CLIENT_ID) and the reversed iOS Client ID to app.json to enable Google Sign In."
      );
      return;
    }

    const g = getGoogleSignin();
    if (!g) {
      Alert.alert("Error", "Google Sign In module could not be loaded.");
      return;
    }

    const { GoogleSignin, statusCodes } = g;

    try {
      await GoogleSignin.hasPlayServices();
      const userInfo = await GoogleSignin.signIn();
      const googleUser = (userInfo as any).data?.user ?? (userInfo as any).user;

      if (!googleUser) throw new Error("No user data returned from Google.");

      const displayName = googleUser.name ?? googleUser.email.split("@")[0];
      await login(displayName, googleUser.email);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
    } catch (e: any) {
      if (e.code === statusCodes.SIGN_IN_CANCELLED) {
        // User dismissed — do nothing
      } else if (e.code === statusCodes.IN_PROGRESS) {
        // Sign-in already in progress
      } else if (e.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
        Alert.alert("Google Sign In", "Google Play Services are not available on this device.");
      } else {
        Alert.alert("Google Sign In failed", e.message ?? "An error occurred.");
      }
    }
  }

  function handleGuest() {
    Haptics.selectionAsync();
    router.back();
  }

  function switchTab(t: Tab) {
    Haptics.selectionAsync();
    setTab(t);
  }

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 32 },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Close */}
        <Pressable onPress={() => router.back()} style={styles.closeBtn} hitSlop={10}>
          <Ionicons name="close" size={22} color={Colors.textSec} />
        </Pressable>

        {/* Hero */}
        <Animated.View entering={FadeInDown.delay(0).springify()} style={styles.heroSection}>
          <View style={styles.logoCircle}>
            <Ionicons name="airplane" size={32} color={Colors.white} />
          </View>
          <Text style={styles.headline}>
            {tab === "signup" ? "Create your account" : "Welcome back"}
          </Text>
          <Text style={styles.subline}>
            {tab === "signup"
              ? "Back up your flights and access them anywhere."
              : "Sign in to continue tracking your journeys."}
          </Text>
        </Animated.View>

        {/* ─── Social buttons ─────────────────────────────────────────── */}
        <Animated.View entering={FadeInDown.delay(50).springify()} style={styles.socialBlock}>
          {/* Apple Sign In — native button on iOS, custom on Android */}
          {Platform.OS === "ios" && appleAvailable ? (
            <AppleAuthentication.AppleAuthenticationButton
              buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
              buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
              cornerRadius={14}
              style={styles.appleNativeBtn}
              onPress={handleAppleSignIn}
            />
          ) : (
            <Pressable
              style={({ pressed }) => [styles.appleBtn, { opacity: pressed ? 0.85 : 1 }]}
              onPress={handleAppleSignIn}
            >
              <Ionicons name="logo-apple" size={20} color={Colors.white} />
              <Text style={styles.appleBtnText}>Continue with Apple</Text>
            </Pressable>
          )}

          {/* Google Sign In */}
          <Pressable
            style={({ pressed }) => [styles.googleBtn, { opacity: pressed ? 0.85 : 1 }]}
            onPress={handleGoogleSignIn}
          >
            <View style={styles.googleIconWrap}>
              <Text style={styles.googleG}>G</Text>
            </View>
            <Text style={styles.googleBtnText}>Continue with Google</Text>
          </Pressable>
        </Animated.View>

        {/* Divider */}
        <Animated.View entering={FadeInDown.delay(90).springify()} style={styles.dividerRow}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>or continue with email</Text>
          <View style={styles.dividerLine} />
        </Animated.View>

        {/* Tab toggle */}
        <Animated.View entering={FadeInDown.delay(110).springify()} style={styles.tabRow}>
          <Pressable
            onPress={() => switchTab("signup")}
            style={[styles.tabBtn, tab === "signup" && styles.tabBtnActive]}
          >
            <Text style={[styles.tabText, tab === "signup" && styles.tabTextActive]}>Sign Up</Text>
          </Pressable>
          <Pressable
            onPress={() => switchTab("login")}
            style={[styles.tabBtn, tab === "login" && styles.tabBtnActive]}
          >
            <Text style={[styles.tabText, tab === "login" && styles.tabTextActive]}>Log In</Text>
          </Pressable>
        </Animated.View>

        {/* Form */}
        <Animated.View entering={FadeInDown.delay(140).springify()} style={styles.form}>
          {tab === "signup" && (
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Full Name</Text>
              <View style={styles.inputWrap}>
                <Ionicons name="person-outline" size={16} color={Colors.textMuted} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="e.g. Diogo Marques"
                  placeholderTextColor={Colors.textMuted}
                  value={name}
                  onChangeText={setName}
                  autoCapitalize="words"
                  returnKeyType="next"
                />
              </View>
            </View>
          )}

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Email</Text>
            <View style={styles.inputWrap}>
              <Ionicons name="mail-outline" size={16} color={Colors.textMuted} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="your@email.com"
                placeholderTextColor={Colors.textMuted}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="next"
              />
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Password</Text>
            <View style={styles.inputWrap}>
              <Ionicons name="lock-closed-outline" size={16} color={Colors.textMuted} style={styles.inputIcon} />
              <TextInput
                style={[styles.input, { flex: 1 }]}
                placeholder="At least 6 characters"
                placeholderTextColor={Colors.textMuted}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                returnKeyType="done"
                onSubmitEditing={handleSubmit}
              />
              <Pressable onPress={() => setShowPassword((v) => !v)} hitSlop={8}>
                <Ionicons
                  name={showPassword ? "eye-off-outline" : "eye-outline"}
                  size={18}
                  color={Colors.textMuted}
                  style={{ marginRight: 14 }}
                />
              </Pressable>
            </View>
          </View>

          <Pressable
            onPress={handleSubmit}
            disabled={loading}
            style={({ pressed }) => [
              styles.submitBtn,
              { opacity: pressed || loading ? 0.85 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] },
            ]}
          >
            {loading ? (
              <ActivityIndicator color={Colors.white} />
            ) : (
              <Text style={styles.submitText}>
                {tab === "signup" ? "Create Account" : "Log In"}
              </Text>
            )}
          </Pressable>
        </Animated.View>

        {/* Guest option */}
        <Animated.View entering={FadeIn.delay(300)} style={styles.guestRow}>
          <Pressable onPress={handleGuest} hitSlop={10}>
            <Text style={styles.guestText}>Continue as guest  →</Text>
          </Pressable>
        </Animated.View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bg },
  scroll: { paddingHorizontal: 24 },

  closeBtn: {
    alignSelf: "flex-end",
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: Colors.surface,
    borderWidth: 1, borderColor: Colors.border,
    alignItems: "center", justifyContent: "center",
    marginBottom: 8,
  },

  heroSection: { alignItems: "center", marginBottom: 24 },
  logoCircle: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: Colors.accent,
    alignItems: "center", justifyContent: "center",
    marginBottom: 18,
    shadowColor: Colors.accent,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.28, shadowRadius: 14, elevation: 6,
  },
  headline: { fontSize: 26, color: Colors.text, fontFamily: "DMSans_700Bold", textAlign: "center", marginBottom: 8 },
  subline:  { fontSize: 14, color: Colors.textSec, fontFamily: "DMSans_400Regular", textAlign: "center", lineHeight: 20 },

  socialBlock: { gap: 12, marginBottom: 20 },

  appleNativeBtn: { width: "100%", height: 52 },

  appleBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10,
    backgroundColor: "#1A1A1A",
    borderRadius: 14, height: 52,
  },
  appleBtnText: { fontSize: 15, color: Colors.white, fontFamily: "DMSans_700Bold" },

  googleBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10,
    backgroundColor: Colors.white,
    borderRadius: 14, height: 52,
    borderWidth: 1.5, borderColor: Colors.border,
    shadowColor: Colors.shadow, shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 6, elevation: 2,
  },
  googleIconWrap: {
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: "#fff",
    alignItems: "center", justifyContent: "center",
  },
  googleG: { fontSize: 15, fontFamily: "DMSans_700Bold", color: "#4285F4" },
  googleBtnText: { fontSize: 15, color: Colors.text, fontFamily: "DMSans_700Bold" },

  dividerRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 16 },
  dividerLine: { flex: 1, height: 1, backgroundColor: Colors.border },
  dividerText: { fontSize: 12, color: Colors.textMuted, fontFamily: "DMSans_400Regular" },

  tabRow: {
    flexDirection: "row",
    backgroundColor: Colors.surface,
    borderRadius: 14, borderWidth: 1, borderColor: Colors.border,
    padding: 4, marginBottom: 20,
  },
  tabBtn:       { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: "center" },
  tabBtnActive: { backgroundColor: Colors.accent },
  tabText:       { fontSize: 14, color: Colors.textSec, fontFamily: "DMSans_500Medium" },
  tabTextActive: { color: Colors.white, fontFamily: "DMSans_700Bold" },

  form: { gap: 0 },
  inputGroup: { marginBottom: 16 },
  inputLabel: {
    fontSize: 11, color: Colors.textSec, fontFamily: "DMSans_500Medium",
    textTransform: "uppercase", letterSpacing: 0.7, marginBottom: 6,
  },
  inputWrap: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: Colors.surface,
    borderRadius: 12, borderWidth: 1.5, borderColor: Colors.border,
  },
  inputIcon: { marginLeft: 14 },
  input: {
    flex: 1, paddingHorizontal: 10, paddingVertical: 14,
    fontSize: 15, color: Colors.text, fontFamily: "DMSans_400Regular",
  },

  submitBtn: {
    backgroundColor: Colors.accent,
    borderRadius: 14, paddingVertical: 16,
    alignItems: "center", marginTop: 8, marginBottom: 20,
    shadowColor: Colors.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.22, shadowRadius: 10, elevation: 4,
  },
  submitText: { fontSize: 16, color: Colors.white, fontFamily: "DMSans_700Bold" },

  guestRow: { alignItems: "center", marginTop: 8 },
  guestText: { fontSize: 14, color: Colors.accent, fontFamily: "DMSans_500Medium" },
});
