/**
 * StoryCard — Yearly Recap
 * ------------------------
 * 9:16 portrait card captured by ViewShot and shared to Instagram / WhatsApp / etc.
 *
 * Viral design goals:
 *  - Logbook wordmark + LogbookLogo mark clearly visible top-left
 *  - "Available on the App Store" iOS badge bottom-right
 *  - Eye-catching hero number (flight count) dominates the card
 *  - Bold colour palette on deep navy background
 *  - CTA line at the bottom: "Track yours → logbook.app"
 */
import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Svg, {
  G, Path, Circle, Rect, Defs, LinearGradient as SvgLG, Stop, ClipPath,
} from "react-native-svg";
import { Ionicons } from "@expo/vector-icons";
import { Flight } from "@/context/flights";
import { getCO2FunFact } from "@/utils/co2FunFact";

export const CARD_WIDTH  = 390;
export const CARD_HEIGHT = 693; // ~9:16 at 390 wide

// ─── helpers ────────────────────────────────────────────────────────────────
function formatNum(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}
function formatHours(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}
function computeRank(n: number): number {
  if (n === 0) return 0;
  if (n <= 1) return 15;  if (n <= 3) return 35;
  if (n <= 6) return 55;  if (n <= 10) return 70;
  if (n <= 15) return 82; if (n <= 25) return 91;
  if (n <= 40) return 96; return 99;
}
function getTopRoutes(flights: Flight[]): { dep: string; arr: string }[] {
  const freq: Record<string, number> = {};
  flights.forEach((f) => {
    const key = `${f.departureAirport}\u2192${f.arrivalAirport}`;
    freq[key] = (freq[key] || 0) + 1;
  });
  return Object.entries(freq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([k]) => { const [dep, arr] = k.split("\u2192"); return { dep, arr }; });
}

// ─── Inline LogoMark ────────────────────────────────────────────────────────
function LogoMark({ size = 28 }: { size?: number }) {
  const s   = size;
  const pad = s * 0.10;
  const bw  = s - pad * 2;
  const bh  = bw * 0.72;
  const bx  = pad;
  const by  = (s - bh) / 2;
  const spX = bx + bw / 2;
  const lx1 = bx; const ly1 = by + bh * 0.06;
  const lx2 = spX - 1; const ly2 = by;
  const lx3 = spX - 1; const ly3 = by + bh;
  const lx4 = bx; const ly4 = by + bh * 0.94;
  const rx1 = spX + 1; const ry1 = by;
  const rx2 = bx + bw; const ry2 = by + bh * 0.06;
  const rx3 = bx + bw; const ry3 = by + bh * 0.94;
  const rx4 = spX + 1; const ry4 = by + bh;
  const arcPad = bw * 0.1;
  const arcX0  = spX + arcPad + 2;
  const arcX3  = bx + bw - arcPad;
  const arcCX  = (arcX0 + arcX3) / 2;
  const arcCY  = by + bh * 0.5 - bh * 0.22;
  const arcY   = by + bh * 0.5;
  return (
    <Svg width={s} height={s} viewBox={`0 0 ${s} ${s}`}>
      <Defs>
        <ClipPath id="sc_clip">
          <Rect x="0" y="0" width={s} height={s} rx={s * 0.22} ry={s * 0.22} />
        </ClipPath>
        <SvgLG id="sc_bg" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0%"  stopColor="#16161E" stopOpacity="1" />
          <Stop offset="100%" stopColor="#0E0E18" stopOpacity="1" />
        </SvgLG>
      </Defs>
      <Rect x="0" y="0" width={s} height={s} rx={s*0.22} ry={s*0.22} fill="url(#sc_bg)" />
      <G clipPath="url(#sc_clip)">
        <Path d={`M${lx1},${ly1} L${lx2},${ly2} L${lx3},${ly3} L${lx4},${ly4} Z`} fill="#16161E" stroke="#2A2A3A" strokeWidth={s*0.025} />
        {[0.3,0.5,0.7].map((t,i)=>{
          const ly=by+bh*t; const xo=bw*0.08;
          return <Path key={i} d={`M${bx+xo},${ly} L${spX-xo*0.5},${ly}`} stroke="#2A2A3A" strokeWidth={s*0.018} strokeLinecap="round" />;
        })}
        <Path d={`M${rx1},${ry1} L${rx2},${ry2} L${rx3},${ry3} L${rx4},${ry4} Z`} fill="#16161E" stroke="#2A2A3A" strokeWidth={s*0.025} />
        <Rect x={spX-s*0.03} y={by} width={s*0.06} height={bh} fill="#000" opacity={0.4} />
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

// ─── iOS App Store Badge ─────────────────────────────────────────────────────
function AppStoreBadge({ width = 120 }: { width?: number }) {
  const h = width * 0.33;
  const r = h * 0.28;
  return (
    <Svg width={width} height={h} viewBox={`0 0 ${width} ${h}`}>
      <Defs>
        <SvgLG id="badge_bg" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0%"  stopColor="#2A2A35" stopOpacity="1" />
          <Stop offset="100%" stopColor="#1A1A25" stopOpacity="1" />
        </SvgLG>
      </Defs>
      {/* Background pill */}
      <Rect x={0} y={0} width={width} height={h} rx={r} ry={r}
        fill="url(#badge_bg)" stroke="rgba(255,255,255,0.15)" strokeWidth={0.8}
      />
      {/* Apple logo  mark (simplified) */}
      <Path
        d={`M${width*0.09},${h*0.48} a${h*0.22},${h*0.22} 0 0 1 ${h*0.22},-${h*0.22} ${h*0.11},${h*0.11} 0 0 1 -${h*0.06},-${h*0.1} ${h*0.22},${h*0.22} 0 0 1 ${h*0.22},${h*0.22} ${h*0.22},${h*0.22} 0 0 1 -${h*0.38},0 Z`}
        fill="#FFFFFF" opacity={0.9}
        transform={`translate(${width*0.05}, ${h*0.07})`}
      />
      {/* "Available on the" */}
      <Text
        x={width * 0.37} y={h * 0.40}
        fontSize={h * 0.28} fill="rgba(255,255,255,0.65)"
        fontFamily="DMSans_400Regular" textAnchor="middle" letterSpacing={0.3}
      >
        Available on the
      </Text>
      {/* "App Store" */}
      <Text
        x={width * 0.37} y={h * 0.78}
        fontSize={h * 0.42} fill="#FFFFFF"
        fontFamily="DMSans_700Bold" textAnchor="middle" letterSpacing={-0.2}
      >
        App Store
      </Text>
    </Svg>
  );
}

// ─── Component ───────────────────────────────────────────────────────────────
export interface StoryCardProps {
  flights: Flight[];
  periodLabel: string;
}

const STARS: { t: number; l: number; r: number; o: number }[] = [
  { t: 18,  l: 48,  r: 2,   o: 0.65 }, { t: 52,  l: 320, r: 1.5, o: 0.5  },
  { t: 88,  l: 165, r: 1,   o: 0.4  }, { t: 118, l: 355, r: 2,   o: 0.7  },
  { t: 148, l: 12,  r: 1.5, o: 0.5  }, { t: 210, l: 298, r: 1,   o: 0.35 },
  { t: 250, l: 68,  r: 2,   o: 0.3  }, { t: 310, l: 362, r: 1.5, o: 0.55 },
  { t: 490, l: 28,  r: 1.5, o: 0.4  }, { t: 545, l: 350, r: 2,   o: 0.5  },
  { t: 600, l: 185, r: 1,   o: 0.3  }, { t: 640, l: 88,  r: 2,   o: 0.45 },
];

export default function StoryCard({ flights, periodLabel }: StoryCardProps) {
  const count      = flights.length;
  const miles      = flights.reduce((s, f) => s + f.distanceMiles, 0);
  const co2        = flights.reduce((s, f) => s + f.co2Kg, 0);
  const flightMin  = flights.reduce((s, f) => s + f.durationMinutes, 0);
  const delayMin   = flights.reduce((s, f) => s + f.delayMinutes, 0);
  const rank       = computeRank(count);
  const topRoutes  = getTopRoutes(flights);
  const funFact    = co2 > 0 ? getCO2FunFact(co2) : null;

  return (
    <View style={c.card}>
      {/* Deep navy gradient background */}
      <LinearGradient
        colors={["#040C1E", "#081630", "#040C1E"]}
        locations={[0, 0.5, 1]}
        style={StyleSheet.absoluteFill}
      />

      {/* Atmospheric glow blobs */}
      <View style={c.glow1} />
      <View style={c.glow2} />
      <View style={c.glow3} />

      {/* Starfield */}
      {STARS.map((st, i) => (
        <View key={i} style={[c.star, { top: st.t, left: st.l, width: st.r, height: st.r, borderRadius: st.r / 2, opacity: st.o }]} />
      ))}

      {/* Subtle grid lines */}
      <View style={c.gridH1} />
      <View style={c.gridH2} />

      <View style={c.inner}>
        {/* ── TOP: Logo + Branding ── */}
        <View style={c.topRow}>
          <LogoMark size={36} />
          <View style={c.topBrand}>
            <Text style={c.brandName}>Logbook</Text>
            <Text style={c.brandSub}>Flight Journal</Text>
          </View>
          <View style={c.topRight}>
            {rank > 0 && (
              <View style={c.rankPill}>
                <Text style={c.rankPillText}>TOP {100 - rank}%</Text>
              </View>
            )}
          </View>
        </View>

        {/* ── PERIOD label ── */}
        <Text style={c.periodLabel}>{periodLabel.toUpperCase()} · YEAR RECAP</Text>

        {/* ── HERO NUMBER ── */}
        <View style={c.heroWrap}>
          <View style={c.heroGlow} />
          <Text style={c.heroNum}>{count}</Text>
          <Text style={c.heroLabel}>FLIGHTS</Text>
        </View>

        {/* ── STATS GRID ── */}
        <View style={c.statsGrid}>
          <StatItem icon="navigate" color="#4F8EF0" value={formatNum(miles)} label="miles" />
          <View style={c.statDivider} />
          <StatItem icon="time" color="#F59E0B" value={formatHours(flightMin)} label="in air" />
          <View style={c.statDivider} />
          <StatItem icon="leaf" color="#10B981" value={`${formatNum(co2)}kg`} label="CO\u2082" />
          {delayMin > 0 && <><View style={c.statDivider} /><StatItem icon="hourglass" color="#EF4444" value={formatHours(delayMin)} label="delayed" /></>}
        </View>

        {/* ── FUN FACT ── */}
        {funFact && (
          <View style={c.funFactRow}>
            <Text style={c.funFactText}>\uD83C\uDF43 That\u2019s like {funFact}</Text>
          </View>
        )}

        {/* ── TOP ROUTES ── */}
        {topRoutes.length > 0 && (
          <View style={c.routesBlock}>
            <Text style={c.sectionLabel}>\u2708\uFE0F TOP ROUTES</Text>
            {topRoutes.map((r, i) => (
              <View key={i} style={c.routeRow}>
                <Text style={c.routeIata}>{r.dep}</Text>
                <View style={c.routeLine}>
                  <View style={c.routeDash} />
                  <Ionicons name="airplane" size={13} color="#4F8EF0" />
                  <View style={c.routeDash} />
                </View>
                <Text style={[c.routeIata, { textAlign: "right" }]}>{r.arr}</Text>
              </View>
            ))}
          </View>
        )}

        {/* ── FOOTER: CTA + App Store badge ── */}
        <View style={c.footer}>
          <View style={c.footerLeft}>
            <Text style={c.ctaLine}>Track yours at</Text>
            <Text style={c.ctaUrl}>logbook.app</Text>
          </View>
          <AppStoreBadge width={118} />
        </View>
      </View>
    </View>
  );
}

function StatItem({ icon, color, value, label }: { icon: string; color: string; value: string; label: string }) {
  return (
    <View style={c.statItem}>
      <View style={[c.statIcon, { backgroundColor: color + "22" }]}>
        <Ionicons name={icon as never} size={15} color={color} />
      </View>
      <Text style={c.statVal}>{value}</Text>
      <Text style={c.statLbl}>{label}</Text>
    </View>
  );
}

const c = StyleSheet.create({
  card: { width: CARD_WIDTH, height: CARD_HEIGHT, backgroundColor: "#040C1E", borderRadius: 28, overflow: "hidden", position: "relative" },
  glow1: { position: "absolute", width: 360, height: 360, borderRadius: 180, backgroundColor: "rgba(79,142,240,0.10)", top: -100, right: -100 },
  glow2: { position: "absolute", width: 260, height: 260, borderRadius: 130, backgroundColor: "rgba(79,142,240,0.06)", bottom: 80, left: -80 },
  glow3: { position: "absolute", width: 180, height: 180, borderRadius: 90,  backgroundColor: "rgba(245,158,11,0.04)", top: 260, left: 100 },
  star:  { position: "absolute", backgroundColor: "#FFFFFF" },
  gridH1: { position: "absolute", left: 0, right: 0, top: "35%",  height: 1, backgroundColor: "rgba(79,142,240,0.05)" },
  gridH2: { position: "absolute", left: 0, right: 0, top: "65%",  height: 1, backgroundColor: "rgba(79,142,240,0.05)" },

  inner: { flex: 1, paddingHorizontal: 32, paddingTop: 38, paddingBottom: 30, justifyContent: "space-between" },

  // Top branding row
  topRow:    { flexDirection: "row", alignItems: "center", gap: 10 },
  topBrand:  { flex: 1, gap: 1 },
  brandName: { fontSize: 20, color: "#F0F6FF", fontFamily: "DMSans_700Bold", letterSpacing: -0.3, lineHeight: 22 },
  brandSub:  { fontSize: 10, color: "rgba(79,142,240,0.7)", fontFamily: "DMSans_400Regular", letterSpacing: 0.8 },
  topRight:  { alignItems: "flex-end" },
  rankPill:  { backgroundColor: "rgba(79,142,240,0.15)", borderWidth: 1, borderColor: "rgba(79,142,240,0.4)", paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20 },
  rankPillText: { fontSize: 11, color: "#4F8EF0", fontFamily: "DMSans_700Bold", letterSpacing: 1.5 },

  // Period
  periodLabel: { fontSize: 10, color: "rgba(240,246,255,0.35)", fontFamily: "DMSans_500Medium", letterSpacing: 2.5, textTransform: "uppercase", textAlign: "center", marginTop: 2 },

  // Hero
  heroWrap:  { alignItems: "center", position: "relative" },
  heroGlow:  { position: "absolute", width: 220, height: 220, borderRadius: 110, backgroundColor: "rgba(79,142,240,0.08)", top: -30 },
  heroNum:   { fontSize: 112, color: "#F0F6FF", fontFamily: "DMSans_700Bold", lineHeight: 120, letterSpacing: -6, textShadowColor: "rgba(79,142,240,0.4)", textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 24 },
  heroLabel: { fontSize: 13, color: "rgba(79,142,240,0.65)", fontFamily: "DMSans_700Bold", letterSpacing: 5, marginTop: -8 },

  // Stats
  statsGrid:   { flexDirection: "row", backgroundColor: "rgba(255,255,255,0.04)", borderRadius: 18, borderWidth: 1, borderColor: "rgba(79,142,240,0.12)", paddingVertical: 16, paddingHorizontal: 6, alignItems: "center" },
  statItem:    { flex: 1, alignItems: "center", gap: 4 },
  statDivider: { width: 1, height: 38, backgroundColor: "rgba(79,142,240,0.15)" },
  statIcon:    { width: 30, height: 30, borderRadius: 9, alignItems: "center", justifyContent: "center", marginBottom: 2 },
  statVal:     { fontSize: 16, color: "#F0F6FF", fontFamily: "DMSans_700Bold", letterSpacing: -0.3 },
  statLbl:     { fontSize: 9, color: "rgba(240,246,255,0.4)", fontFamily: "DMSans_500Medium", letterSpacing: 1.5 },

  // Fun fact
  funFactRow:  { backgroundColor: "rgba(16,185,129,0.08)", borderRadius: 12, borderWidth: 1, borderColor: "rgba(16,185,129,0.18)", paddingHorizontal: 14, paddingVertical: 8 },
  funFactText: { fontSize: 11, color: "rgba(16,185,129,0.85)", fontFamily: "DMSans_400Regular", fontStyle: "italic", textAlign: "center", lineHeight: 16 },

  // Routes
  routesBlock: { gap: 10 },
  sectionLabel: { fontSize: 9, color: "rgba(79,142,240,0.55)", fontFamily: "DMSans_700Bold", letterSpacing: 2.5, marginBottom: 2 },
  routeRow:  { flexDirection: "row", alignItems: "center" },
  routeIata: { fontSize: 20, color: "#F0F6FF", fontFamily: "DMSans_700Bold", width: 46, letterSpacing: -0.5 },
  routeLine: { flex: 1, flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 6 },
  routeDash: { flex: 1, height: 1, backgroundColor: "rgba(79,142,240,0.25)" },

  // Footer
  footer: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  footerLeft: { gap: 2 },
  ctaLine: { fontSize: 10, color: "rgba(240,246,255,0.35)", fontFamily: "DMSans_400Regular", letterSpacing: 0.3 },
  ctaUrl:  { fontSize: 14, color: "rgba(79,142,240,0.85)", fontFamily: "DMSans_700Bold", letterSpacing: 0.2 },
});
