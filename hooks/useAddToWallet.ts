/**
 * useAddToWallet.ts
 * Generates a .pkpass on-device for a logged flight and triggers the
 * native iOS Share sheet, which surfaces "Add to Apple Wallet" as a
 * first-class option whenever the .pkpass MIME type is recognised.
 *
 * No extra npm package or EAS rebuild required — uses only
 * expo-file-system (already a transitive dep) and expo-sharing.
 */

import { useState } from "react";
import { Alert, Platform } from "react-native";
import * as Sharing from "expo-sharing";
import * as Haptics from "expo-haptics";
import { generatePkpass, PassFlightData } from "@/utils/pkpassGenerator";

export type WalletState = "idle" | "generating" | "sharing";

export function useAddToWallet() {
  const [state, setState] = useState<WalletState>("idle");

  async function addToWallet(flight: PassFlightData) {
    if (Platform.OS !== "ios") {
      Alert.alert(
        "iOS Only",
        "Apple Wallet is only available on iPhone. You can export the flight as a calendar event instead."
      );
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setState("generating");

    const result = await generatePkpass(flight);

    if (!result.ok) {
      setState("idle");
      Alert.alert("Pass Error", `Could not generate the boarding pass.\n\n${result.error}`);
      return;
    }

    setState("sharing");

    try {
      const available = await Sharing.isAvailableAsync();
      if (!available) {
        setState("idle");
        Alert.alert(
          "Sharing Unavailable",
          "Your device doesn't support file sharing. Please update iOS and try again."
        );
        return;
      }

      await Sharing.shareAsync(result.uri, {
        mimeType: "application/vnd.apple.pkpass",
        dialogTitle: `Add ${flight.flightCode} to Apple Wallet`,
        UTI: "com.apple.pkpass",
      });

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e: any) {
      // User dismissed the sheet — not an error
      if (!e?.message?.includes("cancelled") && !e?.message?.includes("dismissed")) {
        Alert.alert("Error", "Could not open the Wallet sheet. Please try again.");
      }
    } finally {
      setState("idle");
    }
  }

  return { addToWallet, walletState: state, isLoading: state !== "idle" };
}
