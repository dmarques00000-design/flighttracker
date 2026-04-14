import { QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { StatusBar } from "expo-status-bar";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { queryClient } from "@/lib/query-client";
import { FlightsProvider } from "@/context/flights";
import { UserProvider } from "@/context/user";
import { ThemeProvider, useTheme } from "@/context/theme";
import { useColors } from "@/constants/colors";
import {
  useFonts,
  DMSans_400Regular,
  DMSans_500Medium,
  DMSans_600SemiBold,
  DMSans_700Bold,
} from "@expo-google-fonts/dm-sans";

SplashScreen.preventAutoHideAsync();

function RootLayoutNav() {
  const { isDark } = useTheme();
  const C = useColors();
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
              // Always open at full height so the result card + Add button are reachable
              sheetAllowedDetents: [1],
              sheetInitialDetentIndex: 0,
              sheetGrabberVisible: true,
              headerShown: false,
              contentStyle: { backgroundColor: C.surface },
            }}
          />
          <Stack.Screen
            name="flight/[id]"
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="share"
            options={{
              presentation: "modal",
              headerShown: false,
              contentStyle: { backgroundColor: "transparent" },
            }}
          />
          <Stack.Screen
            name="auth"
            options={{
              presentation: "modal",
              headerShown: false,
              contentStyle: { backgroundColor: "transparent" },
            }}
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
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <ErrorBoundary>
      <ThemeProvider>
        <QueryClientProvider client={queryClient}>
          <FlightsProvider>
            <UserProvider>
              <RootLayoutNav />
            </UserProvider>
          </FlightsProvider>
        </QueryClientProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
