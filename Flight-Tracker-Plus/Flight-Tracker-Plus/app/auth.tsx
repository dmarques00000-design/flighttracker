import React, { useState } from "react";
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

  function validateEmail(e: string) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.trim());
  }

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
    await new Promise((r) => setTimeout(r, 600)); // simulated async
    await login(tab === "signup" ? name : email.split("@")[0], email);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setLoading(false);
    router.back();
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
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 32 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Close button */}
        <Pressable onPress={() => router.back()} style={styles.closeBtn} hitSlop={10}>
          <Ionicons name="close" size={22} color={Colors.textSec} />
        </Pressable>

        {/* Logo + headline */}
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

        {/* Tab toggle */}
        <Animated.View entering={FadeInDown.delay(60).springify()} style={styles.tabRow}>
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
        <Animated.View entering={FadeInDown.delay(100).springify()} style={styles.form}>
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

          {/* Submit */}
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

          {/* Divider */}
          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>or</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* Apple Sign In placeholder */}
          <Pressable
            style={({ pressed }) => [styles.appleBtn, { opacity: pressed ? 0.85 : 1 }]}
            onPress={() => {
              Haptics.selectionAsync();
              Alert.alert("Coming Soon", "Apple Sign In will be available at launch.");
            }}
          >
            <Ionicons name="logo-apple" size={20} color={Colors.white} />
            <Text style={styles.appleBtnText}>Continue with Apple</Text>
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

  heroSection: { alignItems: "center", marginBottom: 28 },
  logoCircle: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: Colors.accent,
    alignItems: "center", justifyContent: "center",
    marginBottom: 18,
    shadowColor: Colors.accent,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.28,
    shadowRadius: 14,
    elevation: 6,
  },
  headline: { fontSize: 26, color: Colors.text, fontFamily: "DMSans_700Bold", textAlign: "center", marginBottom: 8 },
  subline: { fontSize: 14, color: Colors.textSec, fontFamily: "DMSans_400Regular", textAlign: "center", lineHeight: 20 },

  tabRow: {
    flexDirection: "row",
    backgroundColor: Colors.surface,
    borderRadius: 14,
    borderWidth: 1, borderColor: Colors.border,
    padding: 4,
    marginBottom: 24,
  },
  tabBtn: { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: "center" },
  tabBtnActive: { backgroundColor: Colors.accent },
  tabText: { fontSize: 14, color: Colors.textSec, fontFamily: "DMSans_600SemiBold" },
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

  dividerRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 16 },
  dividerLine: { flex: 1, height: 1, backgroundColor: Colors.border },
  dividerText: { fontSize: 13, color: Colors.textMuted, fontFamily: "DMSans_400Regular" },

  appleBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10,
    backgroundColor: "#1A1A1A",
    borderRadius: 14, paddingVertical: 15,
    marginBottom: 8,
  },
  appleBtnText: { fontSize: 15, color: Colors.white, fontFamily: "DMSans_700Bold" },

  guestRow: { alignItems: "center", marginTop: 20 },
  guestText: { fontSize: 14, color: Colors.accent, fontFamily: "DMSans_500Medium" },
});
