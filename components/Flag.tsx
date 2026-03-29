/**
 * Flag — renders a real country flag using react-native-country-flag.
 *
 * Usage:
 *   <Flag iata="LIS" size={20} />          // resolves from IATA code
 *   <Flag iso="PT"  size={20} />           // pass ISO directly
 *   <Flag iata="ZZZ" size={20} />          // unknown → neutral placeholder
 *
 * Props:
 *   iata?    — IATA airport code (auto-resolved to ISO)
 *   iso?     — ISO 3166-1 alpha-2 code (takes priority if both given)
 *   size     — rendered height in dp (width is 1.5× for 3:2 ratio)
 *   style?   — extra ViewStyle overrides
 *   rounded? — whether to clip to a rounded rectangle (default true)
 */
import React from "react";
import { View, ViewStyle } from "react-native";
import CountryFlag from "react-native-country-flag";
import { iataToCountry } from "@/utils/iataToCountry";
import { useColors } from "@/constants/colors";

interface FlagProps {
  iata?: string;
  iso?: string;
  size?: number;
  style?: ViewStyle;
  rounded?: boolean;
}

export function Flag({ iata, iso, size = 20, style, rounded = true }: FlagProps) {
  const C = useColors();

  const isoCode = iso ?? (iata ? iataToCountry(iata) : undefined);

  const width  = Math.round(size * 1.5);
  const height = size;
  const radius = rounded ? Math.round(size * 0.18) : 0;

  if (!isoCode) {
    // Neutral placeholder — thin bordered rectangle matching the flag dimensions
    return (
      <View
        style={[
          {
            width,
            height,
            borderRadius: radius,
            backgroundColor: C.card,
            borderWidth: 1,
            borderColor: C.border,
          },
          style,
        ]}
      />
    );
  }

  return (
    <View
      style={[
        {
          width,
          height,
          borderRadius: radius,
          overflow: "hidden",
          // Subtle border so flags with white edges don't bleed into the surface
          borderWidth: 0.5,
          borderColor: "rgba(0,0,0,0.08)",
        },
        style,
      ]}
    >
      <CountryFlag isoCode={isoCode} size={size} />
    </View>
  );
}

export default Flag;
