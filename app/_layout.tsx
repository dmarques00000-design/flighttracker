import { QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import * as Linking from "expo-linking";
import { router } from "expo-router";
import React, { useEffect, useRef } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { StatusBar } from "expo-status-bar";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { queryClient } from "@/lib/query-client";
import { FlightsProvider } from "@/context/flights";
import { TripsProvider } from "@/context/trips";
import { UserProvider } from "@/context/user";
import { ThemeProvider, useTheme } from "@/context/theme";
import { useUser } from "@/context/user";
import { useColors } from "@/constants/colors";
import {
  useFonts,
  DMSans_400Regular,
  DMSans_500Medium,
  DMSans_600SemiBold,
  DMSans_700Bold,
} from "@expo-google-fonts/dm-sans";

SplashScreen.preventAutoHideAsync();

/**
 * Route an incoming URL to the wallet-import screen if it looks like a pkpass.
 * Called both on cold-start (after hydration) and warm (Linking event).
 */
function handleIncomingUrl(url: string | null) {
  if (!url) return;
  const lower = url.toLowerCase();
  if (lower.includes(".pkpass") || lower.includes("pkpass")) {
    router.push({ pathname: "/wallet-import", params: { fileUri: url } });
  }
}

function RootLayoutNav() {
  const { isDark } = useTheme();
  const C = useColors();
  const { isHydrated } = useUser();

  /**
   * Cold-start deep-link gate.
   *
   * The race we're preventing:
   *   1. App launches via a tapped .pkpass share.
   *   2. Linking.getInitialURL() resolves immediately (or on next tick).
   *   3. router.push('/wallet-import') fires while UserProvider is still
   *      reading AsyncStorage — isLoggedIn is a stale `false`.
   *   4. wallet-import's auth guard sees an unauthenticated user and
   *      redirects to /auth, silently swallowing the deep-link.
   *
   * Fix: buffer the initial URL in a ref and only flush it once
   * `isHydrated` flips to true (UserProvider has finished its AsyncStorage
   * read and isLoggedIn is now reliable).
   *
   * The warm/foreground listener is unaffected — by the time the app is
   * warm, hydration has long since completed.
   */
  const pendingUrl = useRef<string | null>(null);

  useEffect(() => {
    // Capture the cold-start URL but do NOT navigate yet.
    Linking.getInitialURL().then((url) => {
      if (url) pendingUrl.current = url;
    });

    // Warm path: app already running — no race, navigate immediately.
    const sub = Linking.addEventListener("url", ({ url }) => handleIncomingUrl(url));
    return () => sub.remove();
  }, []);

  // Flush the pending cold-start URL once auth state has settled.
  useEffect(() => {
    if (!isHydrated) return;
    if (pendingUrl.current) {
      handleIncomingUrl(pendingUrl.current);
      pendingUrl.current = null;
    }
  }, [isHydrated]);

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: C.bg }}>
      <KeyboardProvider>
        <StatusBar style={isDark ? "light" : "dark"} />
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: C.bg } }}>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen
            name="add-flight"
            options={{
              presentation: "formSheet",
              sheetAllowedDetents: [1],
              sheetInitialDetentIndex: 0,
              sheetGrabberVisible: true,
              headerShown: false,
              contentStyle: { backgroundColor: C.surface },
            }}
          />
          <Stack.Screen name="flight/[id]" options={{ headerShown: false }} />
          <Stack.Screen name="trip/[id]"   options={{ headerShown: false }} />
          <Stack.Screen
            name="calendar-sync"
            options={{ headerShown: false, contentStyle: { backgroundColor: C.bg } }}
          />
          <Stack.Screen
            name="share"
            options={{ presentation: "modal", headerShown: false, contentStyle: { backgroundColor: "transparent" } }}
          />
          <Stack.Screen
            name="auth"
            options={{ presentation: "modal", headerShown: false, contentStyle: { backgroundColor: "transparent" } }}
          />
        </Stack>
      </KeyboardProvider>
    </GestureHandlerRootView>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    DMSans_400Regular,
    DMSans_500Medium,
    DMSans_600SemiBold,
    DMSans_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) SplashScreen.hideAsync();
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <ErrorBoundary>
      <ThemeProvider>
        <QueryClientProvider client={queryClient}>
          <UserProvider>
            <FlightsProvider>
              <TripsProvider>
                <RootLayoutNav />
              </TripsProvider>
            </FlightsProvider>
          </UserProvider>
        </QueryClientProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
