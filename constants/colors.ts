import { useTheme } from "@/context/theme";

const accent = "#4F8EF0";

export const LightColors = {
  bg: "#FFFFFF",
  surface: "#F7F9FC",
  card: "#FFFFFF",
  cardElevated: "#F0F4FF",
  border: "#E8EDF5",
  borderSubtle: "#F0F4FF",
  accent,
  accentDim: "rgba(79,142,240,0.12)",
  accentGlow: "rgba(79,142,240,0.20)",
  gradient: ["#4F8EF0", "#7AB4FF"] as const,
  text: "#0F172A",
  textSec: "#64748B",
  textMuted: "#94A3B8",
  green: "#10B981",
  greenDim: "rgba(16,185,129,0.12)",
  amber: "#F59E0B",
  amberDim: "rgba(245,158,11,0.12)",
  red: "#EF4444",
  redDim: "rgba(239,68,68,0.12)",
  white: "#FFFFFF",
  shadow: "rgba(15,23,42,0.08)",
};

export const DarkColors = {
  bg: "#0A0A0F",
  surface: "#13131A",
  card: "#16161F",
  cardElevated: "#1C1C28",
  border: "#2A2A3A",
  borderSubtle: "#1E1E2C",
  accent,
  accentDim: "rgba(79,142,240,0.15)",
  accentGlow: "rgba(79,142,240,0.25)",
  gradient: ["#4F8EF0", "#7AB4FF"] as const,
  text: "#F0F0FA",
  textSec: "#8A8AA8",
  textMuted: "#55556A",
  green: "#10B981",
  greenDim: "rgba(16,185,129,0.15)",
  amber: "#F59E0B",
  amberDim: "rgba(245,158,11,0.15)",
  red: "#EF4444",
  redDim: "rgba(239,68,68,0.15)",
  white: "#FFFFFF",
  shadow: "rgba(0,0,0,0.35)",
};

// Legacy static export — used in files that haven't migrated to useColors() yet.
// Defaults to light. Migrate screens to useColors() for live theme switching.
export const Colors = LightColors;

// Hook — use this in all components for live dark/light switching.
export function useColors() {
  const { isDark } = useTheme();
  return isDark ? DarkColors : LightColors;
}

export default {
  light: {
    text: LightColors.text,
    background: LightColors.bg,
    tint: accent,
    tabIconDefault: LightColors.textMuted,
    tabIconSelected: accent,
  },
  dark: {
    text: DarkColors.text,
    background: DarkColors.bg,
    tint: accent,
    tabIconDefault: DarkColors.textMuted,
    tabIconSelected: accent,
  },
};
