const accent = "#4F8EF0";

export const Colors = {
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

export default {
  light: {
    text: Colors.text,
    background: Colors.bg,
    tint: accent,
    tabIconDefault: Colors.textMuted,
    tabIconSelected: accent,
  },
};
