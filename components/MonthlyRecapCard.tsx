/**
 * MonthlyRecapCard — Monthly Recap shareable card
 * Polished for consistent padding, unified font scale,
 * and a refined multi-stop gradient background.
 */
import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Svg, {
  G, Path, Circle, Rect, Defs,
  LinearGradient as SvgLG, Stop, ClipPath,
} from "react-native-svg";
import { Ionicons } from "@expo/vector-icons";
import { Flight } from "@/context/flights";
import { getCO2FunFact } from "@/utils/co2FunFact";
import { getTimeFunFact } from "@/utils/timeFunFact";
import { CardTheme, CardThemeTokens, THEMES } from "@/constants/cardThemes";

// ─── Card dimensions (9:16 portrait, story-safe) ───────────────────────────────
export const CARD_WIDTH  = 390;
export const CARD_HEIGHT = 693;

// ─── Unified spacing & font scale ───────────────────────────────────────────────
const PAD  = 28;   // uniform horizontal + vertical padding
const GAP  = 10;   // standard inter-section gap
const F = {
  xs:   9,
  sm:  11,
  md:  13,
  base:15,
  lg:  18,
  xl:  22,
  h2:  28,
  h1:  40,
  hero:96,
};

const MONTH_NAMES = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];

// ─── Helpers ─────────────────────────────────────────────────────────────────────────
function fmt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}
function fmtHours(minutes: number): string {
  const h = Math.floor(minutes / 60), m = minutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}
function computeRank(n: number): number {
  if (n === 0) return 0;
  if (n <= 1) return 15; if (n <= 3) return 35;  if (n <= 6)  return 55;
  if (n <= 10) return 70; if (n <= 15) return 82; if (n <= 25) return 91;
  if (n <= 40) return 96; return 99;
}
function getTopRoutes(flights: Flight[]): { dep: string; arr: string; count: number }[] {
  const freq: Record<string, number> = {};
  flights.forEach((f) => { const k = `${f.departureAirport}→${f.arrivalAirport}`; freq[k] = (freq[k] || 0) + 1; });
  return Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 3)
    .map(([k, count]) => { const [dep, arr] = k.split("→"); return { dep, arr, count }; });
}
function getUniqueDestinations(flights: Flight[]): number {
  return new Set(flights.map((f) => f.arrivalCity)).size;
}

// ─── Logo mark ────────────────────────────────────────────────────────────────────────
function LogoMark({ size = 28 }: { size?: number }) {
  const s = size, pad = s * 0.10, bw = s - pad * 2, bh = bw * 0.72, bx = pad, by = (s - bh) / 2, spX = bx + bw / 2;
  const lx1=bx,ly1=by+bh*0.06,lx2=spX-1,ly2=by,lx3=spX-1,ly3=by+bh,lx4=bx,ly4=by+bh*0.94;
  const rx1=spX+1,ry1=by,rx2=bx+bw,ry2=by+bh*0.06,rx3=bx+bw,ry3=by+bh*0.94,rx4=spX+1,ry4=by+bh;
  const arcPad=bw*0.1,arcX0=spX+arcPad+2,arcX3=bx+bw-arcPad,arcCX=(arcX0+arcX3)/2,arcY=by+bh*0.5,arcCY=arcY-bh*0.22;
  return (
    <Svg width={s} height={s} viewBox={`0 0 ${s} ${s}`}>
      <Defs>
        <ClipPath id="mrc_clip"><Rect x="0" y="0" width={s} height={s} rx={s * 0.22} ry={s * 0.22} /></ClipPath>
        <SvgLG id="mrc_bg" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0%" stopColor="#16161E" stopOpacity="1" />
          <Stop offset="100%" stopColor="#0E0E18" stopOpacity="1" />
        </SvgLG>
      </Defs>
      <Rect x="0" y="0" width={s} height={s} rx={s * 0.22} ry={s * 0.22} fill="url(#mrc_bg)" />
      <G clipPath="url(#mrc_clip)">
        <Path d={`M${lx1},${ly1} L${lx2},${ly2} L${lx3},${ly3} L${lx4},${ly4} Z`} fill="#16161E" stroke="#2A2A3A" strokeWidth={s * 0.025} />
        <Path d={`M${rx1},${ry1} L${rx2},${ry2} L${rx3},${ry3} L${rx4},${ry4} Z`} fill="#16161E" stroke="#2A2A3A" strokeWidth={s * 0.025} />
        <Rect x={spX - s * 0.03} y={by} width={s * 0.06} height={bh} fill="#000" opacity={0.4} />
        <Path d={`M${spX},${by+bh*0.04} L${spX},${by+bh*0.96}`} stroke="#4F8EF7" strokeWidth={s*0.022} strokeLinecap="round" opacity={0.8} />
        <Path d={`M${arcX0},${arcY} Q${arcCX},${arcCY} ${arcX3},${arcY}`} fill="none" stroke="#4F8EF7" strokeWidth={s*0.1} strokeLinecap="round" opacity={0.1} />
        <Path d={`M${arcX0},${arcY} Q${arcCX},${arcCY} ${arcX3},${arcY}`} fill="none" stroke="#4F8EF7" strokeWidth={s*0.038} strokeLinecap="round" />
        <Circle cx={arcX0} cy={arcY} r={s*0.042} fill="#4F8EF7" />
        <Circle cx={arcX0} cy={arcY} r={s*0.018} fill="#FFF" opacity={0.9} />
        <Circle cx={arcX3} cy={arcY} r={s*0.042} fill="#4F8EF7" />
        <Circle cx={arcX3} cy={arcY} r={s*0.018} fill="#FFF" opacity={0.9} />
      </G>
      <Rect x={s*0.015} y={s*0.015} width={s*0.97} height={s*0.97} rx={s*0.21} ry={s*0.21} fill="none" stroke="#2A2A3A" strokeWidth={s*0.02} opacity={0.6} />
    </Svg>
  );
}

// ─── App Store badge ─────────────────────────────────────────────────────────────────────
function AppStoreBadge({ width = 118, t }: { width?: number; t: CardThemeTokens }) {
  const h = width * 0.33, r = h * 0.28;
  return (
    <Svg width={width} height={h} viewBox={`0 0 ${width} ${h}`}>
      <Defs>
        <SvgLG id="mbadge_bg2" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0%"   stopColor={t.badgeBg1}   stopOpacity="1" />
          <Stop offset="100%" stopColor={t.badgeBg2}   stopOpacity="1" />
        </SvgLG>
      </Defs>
      <Rect x={0} y={0} width={width} height={h} rx={r} ry={r} fill="url(#mbadge_bg2)" stroke={t.badgeBorder} strokeWidth={0.8} />
      {/* "Available on the" */}
      <Svg x={0} y={0} width={width} height={h}>
        <Path
          d={`M0 0`}
          fill="none"
        />
      </Svg>
      {/* Render badge text as RN Text overlaid via foreignObject isn't possible — use View overlay instead */}
    </Svg>
  );
}

// Native text overlay for badge (rendered on top of SVG)
function AppStoreBadgeNative({ width = 118, t }: { width?: number; t: CardThemeTokens }) {
  const h = width * 0.33;
  return (
    <View style={{ width, height: h, borderRadius: h * 0.28, overflow: "hidden", borderWidth: 0.8, borderColor: t.badgeBorder }}>
      <LinearGradient
        colors={[t.badgeBg1, t.badgeBg2]}
        style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 12 }}
      >
        <Text style={{ fontSize: F.xs - 1, color: "rgba(255,255,255,0.65)", fontFamily: "DMSans_400Regular", letterSpacing: 0.2 }}>
          Download on the
        </Text>
        <Text style={{ fontSize: F.sm, color: "#FFFFFF", fontFamily: "DMSans_700Bold", letterSpacing: 0.1 }}>
          App Store
        </Text>
      </LinearGradient>
    </View>
  );
}

// ─── Stat box ───────────────────────────────────────────────────────────────────────────
function StatBox({ icon, color, value, label, tk }: {
  icon: string; color: string; value: string; label: string; tk: CardThemeTokens;
}) {
  return (
    <View style={s.statBox}>
      <View style={[s.statIcon, { backgroundColor: color + "22" }]}>
        <Ionicons name={icon as never} size={14} color={color} />
      </View>
      <Text style={[s.statValue, { color: tk.textPrimary }]}>{value}</Text>
      <Text style={[s.statLabel, { color: tk.textMuted }]}>{label}</Text>
    </View>
  );
}

// ─── Background decoration (stars + subtle grid lines) ──────────────────────────────
const STARS: { t: number; l: number; r: number; o: number }[] = [
  { t:  22, l:  40, r: 2.0, o: 0.55 }, { t:  55, l: 310, r: 1.5, o: 0.45 },
  { t:  80, l: 170, r: 1.0, o: 0.35 }, { t: 110, l: 340, r: 2.0, o: 0.65 },
  { t: 140, l:  15, r: 1.5, o: 0.45 }, { t: 200, l: 290, r: 1.0, o: 0.35 },
  { t: 240, l:  60, r: 2.0, o: 0.25 }, { t: 300, l: 350, r: 1.5, o: 0.55 },
  { t: 480, l:  25, r: 1.5, o: 0.35 }, { t: 530, l: 340, r: 2.0, o: 0.45 },
  { t: 590, l: 180, r: 1.0, o: 0.25 }, { t: 630, l:  80, r: 2.0, o: 0.35 },
];

// ─── Props ─────────────────────────────────────────────────────────────────────────────
export interface MonthlyRecapCardProps {
  flights: Flight[];
  month:   number;
  year:    number;
  theme?:  CardTheme;
}

// ─── Card ────────────────────────────────────────────────────────────────────────────
export default function MonthlyRecapCard({ flights, month, year, theme = "dark" }: MonthlyRecapCardProps) {
  const tk          = THEMES[theme];
  const count       = flights.length;
  const miles       = flights.reduce((acc, f) => acc + f.distanceMiles,   0);
  const co2         = flights.reduce((acc, f) => acc + f.co2Kg,           0);
  const flightMin   = flights.reduce((acc, f) => acc + f.durationMinutes, 0);
  const rank        = computeRank(count);
  const topRoutes   = getTopRoutes(flights);
  const destinations = getUniqueDestinations(flights);
  const monthName   = MONTH_NAMES[month];
  const co2Fact     = co2 > 0       ? getCO2FunFact(co2)          : null;
  const timeFact    = flightMin > 0 ? getTimeFunFact(flightMin)   : null;
  const headline    = `You've taken ${count} flight${count !== 1 ? "s" : ""} this ${monthName}`;

  return (
    <View style={[s.card, { backgroundColor: tk.cardBg }]}>

      {/* ─ BACKGROUND GRADIENT (multi-stop for depth) ─ */}
      <LinearGradient
        colors={tk.gradientColors}
        locations={tk.gradientLocations}
        style={StyleSheet.absoluteFill}
        start={{ x: 0.18, y: 0 }}
        end={{ x: 0.82, y: 1 }}
      />

      {/* Second diagonal gradient for cross-light effect */}
      <LinearGradient
        colors={[tk.glow1Color, "transparent", tk.glow2Color]}
        locations={[0, 0.45, 1]}
        start={{ x: 1, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={[StyleSheet.absoluteFill, { opacity: 0.38 }]}
      />

      {/* ─ GLOW BLOBS ─ */}
      <View style={[s.glow1, { backgroundColor: tk.glow1Color }]} />
      <View style={[s.glow2, { backgroundColor: tk.glow2Color }]} />
      <View style={[s.glow3, { backgroundColor: tk.glow3Color }]} />

      {/* ─ STARS ─ */}
      {STARS.map((st, i) => (
        <View key={i} style={[
          s.star,
          { top: st.t, left: st.l, width: st.r * 2, height: st.r * 2, borderRadius: st.r, opacity: st.o, backgroundColor: tk.starColor },
        ]} />
      ))}

      {/* ─ SUBTLE GRID LINES ─ */}
      <View style={[s.gridH1, { backgroundColor: tk.gridLineColor }]} />
      <View style={[s.gridH2, { backgroundColor: tk.gridLineColor }]} />

      {/* ─ CONTENT ─ */}
      <View style={s.inner}>

        {/* TOP BRANDING */}
        <View style={s.topRow}>
          <LogoMark size={34} />
          <View style={s.topBrand}>
            <Text style={[s.brandName, { color: tk.textPrimary }]}>Logbook</Text>
            <Text style={[s.brandSub,  { color: tk.textAccent  }]}>Flight Journal</Text>
          </View>
          {rank > 0 && (
            <View style={[s.rankPill, { backgroundColor: tk.pillBg, borderColor: tk.pillBorder }]}>
              <Text style={[s.rankPillText, { color: tk.textAccentStrong }]}>TOP {100 - rank}%</Text>
            </View>
          )}
        </View>

        {/* MONTH + HERO NUMBER */}
        <View style={s.heroBlock}>
          <View style={[s.heroGlow, { backgroundColor: tk.glow1Color }]} />
          <Text style={[s.monthLabel, { color: tk.textMuted }]}>{year}</Text>
          <Text style={[s.monthName,  { color: tk.textPrimary }]}>{monthName.toUpperCase()}</Text>
          <Text style={[s.heroNum,    { color: tk.textHero, textShadowColor: tk.heroShadow }]}>{count}</Text>
          <Text style={[s.heroSub,    { color: tk.textAccent }]}>{count === 1 ? "FLIGHT" : "FLIGHTS"}</Text>
          <Text style={[s.headline,   { color: tk.textSecondary }]}>{headline}</Text>
        </View>

        {/* STAT GRID */}
        <View style={[s.statGrid, { backgroundColor: tk.statBg, borderColor: tk.statBorder }]}>
          <StatBox icon="navigate"  color="#4F8EF0" value={fmt(miles)}        label="MILES"                        tk={tk} />
          <View style={[s.statDivV, { backgroundColor: tk.dividerColor }]} />
          <StatBox icon="time"      color="#F59E0B" value={fmtHours(flightMin)} label="IN AIR"                     tk={tk} />
          <View style={[s.statDivV, { backgroundColor: tk.dividerColor }]} />
          <StatBox icon="leaf"      color="#10B981" value={`${fmt(co2)}kg`}   label="CO\u2082"                     tk={tk} />
          <View style={[s.statDivV, { backgroundColor: tk.dividerColor }]} />
          <StatBox icon="location"  color="#4F8EF0" value={String(destinations)} label={destinations === 1 ? "DEST" : "DESTS"} tk={tk} />
        </View>

        {/* FUN FACTS */}
        <View style={s.factsBlock}>
          {timeFact && (
            <View style={[s.factRow, { backgroundColor: tk.factBg, borderColor: tk.factBorder }]}>
              <Text style={s.factEmoji}>\u23F0</Text>
              <Text style={[s.factText, { color: tk.textSecondary }]}>
                <Text style={[s.factHighlight, { color: tk.textPrimary }]}>{fmtHours(flightMin)} in the air.</Text>
                {" That\u2019s "}{timeFact}
              </Text>
            </View>
          )}
          {co2Fact && (
            <View style={[s.factRow, { backgroundColor: tk.factBg, borderColor: tk.factBorder }]}>
              <Text style={s.factEmoji}>\uD83C\uDF43</Text>
              <Text style={[s.factText, { color: tk.textSecondary }]}>
                <Text style={[s.factHighlight, { color: tk.textPrimary }]}>{fmt(co2)} kg CO\u2082.</Text>
                {" That\u2019s like "}{co2Fact}
              </Text>
            </View>
          )}
        </View>

        {/* TOP ROUTES */}
        {topRoutes.length > 0 && (
          <View style={s.routesBlock}>
            <Text style={[s.sectionLabel, { color: tk.textAccent }]}>\u2708\uFE0F  TOP ROUTES</Text>
            {topRoutes.map((r, i) => (
              <View key={i} style={s.routeRow}>
                <Text style={[s.routeIata, { color: tk.textPrimary }]}>{r.dep}</Text>
                <View style={s.routeLine}>
                  <View style={[s.routeDash,  { backgroundColor: tk.dividerColor }]} />
                  <View style={[s.planeWrap, { backgroundColor: tk.pillBg }]}>
                    <Ionicons name="airplane" size={11} color="#4F8EF0" />
                  </View>
                  <View style={[s.routeDash, { backgroundColor: tk.dividerColor }]} />
                </View>
                <Text style={[s.routeIata, { color: tk.textPrimary, textAlign: "right" }]}>{r.arr}</Text>
                {r.count > 1 && (
                  <View style={[s.countPill, { backgroundColor: tk.pillBg }]}>
                    <Text style={[s.countPillText, { color: tk.textAccentStrong }]}>x{r.count}</Text>
                  </View>
                )}
              </View>
            ))}
          </View>
        )}

        {/* EMPTY STATE */}
        {count === 0 && (
          <View style={s.emptyBlock}>
            <Ionicons name="airplane-outline" size={36} color={tk.textAccent} />
            <Text style={[s.emptyText, { color: tk.textMuted }]}>No flights this month</Text>
          </View>
        )}

        {/* FOOTER */}
        <View style={s.footer}>
          <View style={s.footerLeft}>
            <Text style={[s.ctaLine, { color: tk.textMuted }]}>Track yours at</Text>
            <Text style={[s.ctaUrl,  { color: tk.textAccentStrong }]}>logbook.app</Text>
          </View>
          <AppStoreBadgeNative width={118} t={tk} />
        </View>

      </View>
    </View>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  // Card shell
  card:   { width: CARD_WIDTH, height: CARD_HEIGHT, borderRadius: 28, overflow: "hidden" },

  // Background decoration
  glow1:  { position: "absolute", width: 300, height: 300, borderRadius: 150, top: -80,  right: -70,  opacity: 0.55 },
  glow2:  { position: "absolute", width: 240, height: 240, borderRadius: 120, bottom: 70, left: -70,   opacity: 0.45 },
  glow3:  { position: "absolute", width: 180, height: 180, borderRadius: 90,  top: 290,  left: 100,   opacity: 0.22 },
  star:   { position: "absolute" },
  gridH1: { position: "absolute", left: 0, right: 0, top: "40%", height: 1, opacity: 0.6 },
  gridH2: { position: "absolute", left: 0, right: 0, top: "68%", height: 1, opacity: 0.6 },

  // Inner content container — uniform PAD on all sides
  inner:  {
    flex: 1,
    paddingHorizontal: PAD,
    paddingTop:        PAD,
    paddingBottom:     PAD,
    justifyContent:    "space-between",
  },

  // Top branding row
  topRow:       { flexDirection: "row", alignItems: "center", gap: 10 },
  topBrand:     { flex: 1, gap: 1 },
  brandName:    { fontSize: F.xl,   fontFamily: "DMSans_700Bold",    letterSpacing: -0.3, lineHeight: F.xl + 2 },
  brandSub:     { fontSize: F.xs,   fontFamily: "DMSans_400Regular", letterSpacing: 0.8 },
  rankPill:     { borderWidth: 1, paddingHorizontal: 11, paddingVertical: 5, borderRadius: 20 },
  rankPillText: { fontSize: F.xs + 1, fontFamily: "DMSans_700Bold", letterSpacing: 1.4 },

  // Hero block
  heroBlock:  { alignItems: "center", position: "relative" },
  heroGlow:   { position: "absolute", width: 220, height: 220, borderRadius: 110, top: -12, opacity: 0.18 },
  monthLabel: { fontSize: F.sm,  fontFamily: "DMSans_400Regular", letterSpacing: 3,    marginBottom: 0 },
  monthName:  { fontSize: F.h1,  fontFamily: "DMSans_700Bold",    letterSpacing: -1.5, lineHeight: F.h1 + 4 },
  heroNum:    {
    fontSize: F.hero, fontFamily: "DMSans_700Bold", lineHeight: F.hero + 8,
    letterSpacing: -5,
    textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 24,
  },
  heroSub:    { fontSize: F.xs + 1, fontFamily: "DMSans_700Bold",    letterSpacing: 5, marginTop: -4 },
  headline:   { fontSize: F.md,     fontFamily: "DMSans_500Medium",   letterSpacing: -0.1, marginTop: 5, textAlign: "center" },

  // Stat grid
  statGrid:  {
    flexDirection: "row", borderRadius: 16, borderWidth: 1,
    paddingVertical: 13, paddingHorizontal: 4, alignItems: "center",
  },
  statBox:   { flex: 1, alignItems: "center", gap: 3 },
  statDivV:  { width: 1, height: 32 },
  statIcon:  { width: 26, height: 26, borderRadius: 8, alignItems: "center", justifyContent: "center", marginBottom: 1 },
  statValue: { fontSize: F.base,  fontFamily: "DMSans_700Bold",    letterSpacing: -0.3 },
  statLabel: { fontSize: F.xs,    fontFamily: "DMSans_500Medium",   letterSpacing: 1.5 },

  // Fun facts
  factsBlock: { gap: GAP - 3 },
  factRow:    {
    flexDirection: "row", alignItems: "flex-start", gap: 8,
    borderRadius: 12, borderWidth: 1,
    paddingHorizontal: PAD / 2, paddingVertical: 9,
  },
  factEmoji:     { fontSize: F.md, lineHeight: F.lg + 2 },
  factText:      { flex: 1, fontSize: F.sm, fontFamily: "DMSans_400Regular", lineHeight: 17 },
  factHighlight: { fontFamily: "DMSans_700Bold" },

  // Top routes
  routesBlock:  { gap: GAP - 2 },
  sectionLabel: { fontSize: F.xs, fontFamily: "DMSans_700Bold", letterSpacing: 2.5, marginBottom: 1 },
  routeRow:     { flexDirection: "row", alignItems: "center" },
  routeIata:    { fontSize: F.lg,  fontFamily: "DMSans_700Bold", width: 46, letterSpacing: -0.5 },
  routeLine:    { flex: 1, flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 6 },
  routeDash:    { flex: 1, height: 1 },
  planeWrap:    { width: 20, height: 20, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  countPill:    { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 8, marginLeft: 6 },
  countPillText:{ fontSize: F.xs, fontFamily: "DMSans_700Bold" },

  // Empty state
  emptyBlock: { alignItems: "center", gap: GAP, paddingVertical: PAD },
  emptyText:  { fontSize: F.md, fontFamily: "DMSans_400Regular" },

  // Footer
  footer:     { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  footerLeft: { gap: 2 },
  ctaLine:    { fontSize: F.xs,   fontFamily: "DMSans_400Regular", letterSpacing: 0.3 },
  ctaUrl:     { fontSize: F.base, fontFamily: "DMSans_700Bold",    letterSpacing: 0.2 },
});
