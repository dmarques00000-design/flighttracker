/**
 * cardThemes.ts
 * Token set for share card dark / light themes.
 * Both themes are tuned for Instagram Stories (9:16, vibrant but legible).
 */

export type CardTheme = "dark" | "light";

export interface CardThemeTokens {
  // backgrounds
  cardBg: string;
  gradientColors: readonly [string, string, string];
  gradientLocations: readonly [number, number, number];
  glow1Color: string;
  glow2Color: string;
  glow3Color: string;
  starColor: string;
  gridLineColor: string;

  // surface / panel
  statBg: string;
  statBorder: string;
  factBg: string;
  factBorder: string;
  pillBg: string;
  pillBorder: string;
  badgeBg1: string;
  badgeBg2: string;
  badgeBorder: string;
  dividerColor: string;

  // text
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  textAccent: string;
  textAccentStrong: string;
  textHero: string;
  heroShadow: string;

  // decorative
  tearBg: string;
  tearBorder: string;
  notchBg: string;
}

export const DARK_THEME: CardThemeTokens = {
  cardBg: "#040C1E",
  gradientColors: ["#040C1E", "#081630", "#040C1E"],
  gradientLocations: [0, 0.5, 1],
  glow1Color: "rgba(79,142,240,0.10)",
  glow2Color: "rgba(79,142,240,0.06)",
  glow3Color: "rgba(245,158,11,0.04)",
  starColor: "#FFFFFF",
  gridLineColor: "rgba(79,142,240,0.05)",

  statBg: "rgba(255,255,255,0.04)",
  statBorder: "rgba(79,142,240,0.12)",
  factBg: "rgba(255,255,255,0.03)",
  factBorder: "rgba(255,255,255,0.06)",
  pillBg: "rgba(79,142,240,0.13)",
  pillBorder: "rgba(79,142,240,0.35)",
  badgeBg1: "#1C1C1E",
  badgeBg2: "#0A0A0C",
  badgeBorder: "rgba(255,255,255,0.22)",
  dividerColor: "rgba(79,142,240,0.15)",

  textPrimary: "#F0F6FF",
  textSecondary: "rgba(240,246,255,0.55)",
  textMuted: "rgba(240,246,255,0.35)",
  textAccent: "rgba(79,142,240,0.7)",
  textAccentStrong: "rgba(79,142,240,0.85)",
  textHero: "#F0F6FF",
  heroShadow: "rgba(79,142,240,0.4)",

  tearBg: "#050B18",
  tearBorder: "rgba(79,142,240,0.2)",
  notchBg: "#050B18",
};

export const LIGHT_THEME: CardThemeTokens = {
  cardBg: "#F5F7FF",
  gradientColors: ["#EEF2FF", "#FAFBFF", "#EEF2FF"],
  gradientLocations: [0, 0.5, 1],
  glow1Color: "rgba(79,142,240,0.12)",
  glow2Color: "rgba(79,142,240,0.07)",
  glow3Color: "rgba(245,158,11,0.06)",
  starColor: "rgba(79,142,240,0.25)",
  gridLineColor: "rgba(79,142,240,0.07)",

  statBg: "rgba(255,255,255,0.80)",
  statBorder: "rgba(79,142,240,0.18)",
  factBg: "rgba(255,255,255,0.75)",
  factBorder: "rgba(79,142,240,0.12)",
  pillBg: "rgba(79,142,240,0.10)",
  pillBorder: "rgba(79,142,240,0.30)",
  badgeBg1: "#1A1A2E",
  badgeBg2: "#0D0D1A",
  badgeBorder: "rgba(0,0,0,0.15)",
  dividerColor: "rgba(79,142,240,0.18)",

  textPrimary: "#0E1525",
  textSecondary: "rgba(14,21,37,0.55)",
  textMuted: "rgba(14,21,37,0.38)",
  textAccent: "#2563EB",
  textAccentStrong: "#1D4ED8",
  textHero: "#0E1525",
  heroShadow: "rgba(79,142,240,0.15)",

  tearBg: "#EEF2FF",
  tearBorder: "rgba(79,142,240,0.2)",
  notchBg: "#EEF2FF",
};

export const THEMES: Record<CardTheme, CardThemeTokens> = {
  dark: DARK_THEME,
  light: LIGHT_THEME,
};
