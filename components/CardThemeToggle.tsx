/**
 * CardThemeToggle
 * A polished pill toggle letting users switch between dark and light
 * share card themes. Designed to sit above the card preview.
 */
import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { CardTheme } from "@/constants/cardThemes";

interface Props {
  value: CardTheme;
  onChange: (theme: CardTheme) => void;
}

export default function CardThemeToggle({ value, onChange }: Props) {
  return (
    <View style={s.wrap}>
      <Text style={s.label}>Card style</Text>
      <View style={s.pill}>
        <Pressable
          onPress={() => onChange("dark")}
          style={[s.option, value === "dark" && s.optionActive]}
        >
          <Ionicons
            name="moon"
            size={13}
            color={value === "dark" ? "#F0F6FF" : "rgba(240,246,255,0.4)"}
          />
          <Text style={[s.optionText, value === "dark" && s.optionTextActive]}>
            Dark
          </Text>
        </Pressable>
        <Pressable
          onPress={() => onChange("light")}
          style={[s.option, value === "light" && s.optionActiveLight]}
        >
          <Ionicons
            name="sunny"
            size={13}
            color={value === "light" ? "#1D4ED8" : "rgba(240,246,255,0.4)"}
          />
          <Text
            style={[
              s.optionText,
              value === "light" && s.optionTextActiveLight,
            ]}
          >
            Light
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  wrap:  { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 12, marginBottom: 14 },
  label: { fontSize: 12, color: "rgba(240,246,255,0.45)", fontFamily: "DMSans_400Regular", letterSpacing: 0.3 },

  pill: {
    flexDirection: "row",
    backgroundColor: "rgba(255,255,255,0.07)",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    padding: 3,
    gap: 2,
  },
  option: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 16,
  },
  optionActive: {
    backgroundColor: "#1E2A45",
    shadowColor: "#4F8EF0",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 4,
  },
  optionActiveLight: {
    backgroundColor: "#FFFFFF",
    shadowColor: "#2563EB",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.20,
    shadowRadius: 8,
    elevation: 4,
  },
  optionText: {
    fontSize: 13,
    color: "rgba(240,246,255,0.4)",
    fontFamily: "DMSans_600SemiBold",
    letterSpacing: 0.2,
  },
  optionTextActive: {
    color: "#F0F6FF",
  },
  optionTextActiveLight: {
    color: "#1D4ED8",
  },
});
