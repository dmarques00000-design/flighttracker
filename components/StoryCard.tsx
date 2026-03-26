/**
 * StoryCard — Yearly Recap
 * 9:16 portrait card for Instagram / WhatsApp story sharing.
 */
import React from "react";
import { View, Text, Image, StyleSheet } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Svg, {
  Path, Rect, Defs, LinearGradient as SvgLG, Stop,
} from "react-native-svg";
import { Flight } from "@/context/flights";
import { getCO2FunFact } from "@/utils/co2FunFact";
import { getTimeFunFact } from "@/utils/timeFunFact";

export const CARD_WIDTH  = 390;
export const CARD_HEIGHT = 693;

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

// ── Official-style App Store Badge ───────────────────────────────────────────────────
function AppStoreBadge({ width = 148 }: { width?: number }) {
  const h = width * 0.31;
  const r = h * 0.26;
  const appleH = h * 0.58;
  const appleW = appleH * 0.814;
  const appleX = width * 0.07;
  const appleY = (h - appleH) / 2;
  const aS = appleH / 1000;

  return (
    <Svg width={width} height={h} viewBox={`0 0 ${width} ${h}`}>
      <Defs>
        <SvgLG id="as_bg" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0%" stopColor="#1C1C1E" stopOpacity="1" />
          <Stop offset="100%" stopColor="#0A0A0C" stopOpacity="1" />
        </SvgLG>
      </Defs>
      <Rect x={0} y={0} width={width} height={h} rx={r} ry={r}
        fill="url(#as_bg)" stroke="rgba(255,255,255,0.22)" strokeWidth={0.9} />
      <Path
        transform={`translate(${appleX}, ${appleY}) scale(${aS})`}
        d="M788.1 340.9c-5.8 4.5-108.2 62.2-108.2 190.5 0 148.4 130.3 200.9 134.2 202.2-.6 3.2-20.7 71.9-68.7 141.9-42.8 61.6-87.5 123.1-155.5 123.1s-85.5-39.5-164-39.5c-76 0-103.7 40.8-165.9 40.8s-105-57.8-155.5-127.4C46 790.8 0 663.5 0 541.8c0-207.4 135.4-317 269-317 71 0 130.3 46.9 174.9 46.9 42.8 0 109.8-49.5 190.5-49.5 30.5 0 110.8 2.6 173 66.3zm-180.9-157.4c32.1-38.1 55.3-91 55.3-143.9 0-7.4-.6-14.8-1.9-20.8-52.3 1.9-114.5 34.7-151.7 75.8-28.8 32.7-56.5 85-56.5 138.6 0 8.3 1.3 16.6 1.9 19.2 3.2.6 8.3 1.3 13.4 1.3 46.9 0 105.8-31.4 139.5-70.2z"
        fill="#FFFFFF"
        opacity={0.95}
      />
      <Text
        x={appleX + appleW + width * 0.06}
        y={h * 0.38}
        fontSize={h * 0.26}
        fill="rgba(255,255,255,0.60)"
        fontFamily="DMSans_400Regular"
        letterSpacing={0.4}
      >Download on the</Text>
      <Text
        x={appleX + appleW + width * 0.06}
        y={h * 0.76}
        fontSize={h * 0.40}
        fill="#FFFFFF"
        fontFamily="DMSans_700Bold"
        letterSpacing={-0.3}
      >App Store</Text>
    </Svg>
  );
}

// ── Component ───────────────────────────────────────────────────────────────────────
export interface StoryCardProps {
  flights: Flight[];
  periodLabel: string;
}

const STARS: { t:number;l:number;r:number;o:number }[] = [
  {t:18,l:48,r:2,o:.65},{t:52,l:320,r:1.5,o:.5},{t:88,l:165,r:1,o:.4},{t:118,l:355,r:2,o:.7},
  {t:148,l:12,r:1.5,o:.5},{t:210,l:298,r:1,o:.35},{t:250,l:68,r:2,o:.3},{t:310,l:362,r:1.5,o:.55},
  {t:490,l:28,r:1.5,o:.4},{t:545,l:350,r:2,o:.5},{t:600,l:185,r:1,o:.3},{t:640,l:88,r:2,o:.45},
];

export default function StoryCard({ flights, periodLabel }: StoryCardProps) {
  const count     = flights.length;
  const miles     = flights.reduce((s,f)=>s+f.distanceMiles, 0);
  const co2       = flights.reduce((s,f)=>s+f.co2Kg, 0);
  const flightMin = flights.reduce((s,f)=>s+f.durationMinutes, 0);
  const delayMin  = flights.reduce((s,f)=>s+f.delayMinutes, 0);
  const rank      = computeRank(count);
  const topPct    = 100 - rank;
  const co2Fact   = co2 > 0 ? getCO2FunFact(co2) : null;
  const timeFact  = flightMin > 0 ? getTimeFunFact(flightMin) : null;

  const isAllTime = periodLabel.toLowerCase() === "all time";
  const headline  = isAllTime
    ? `You\u2019ve taken ${count} flight${count !== 1 ? "s" : ""} \u2014 all time`
    : `You\u2019ve taken ${count} flight${count !== 1 ? "s" : ""} in ${periodLabel}`;

  return (
    <View style={c.card}>
      <LinearGradient colors={["#040C1E","#081630","#040C1E"]} locations={[0,0.5,1]} style={StyleSheet.absoluteFill} />
      <View style={c.glow1} />
      <View style={c.glow2} />
      <View style={c.glow3} />
      {STARS.map((st,i)=><View key={i} style={[c.star,{top:st.t,left:st.l,width:st.r,height:st.r,borderRadius:st.r/2,opacity:st.o}]} />)}
      <View style={c.gridH1} />
      <View style={c.gridH2} />

      <View style={c.inner}>

        {/* ── TOP BRANDING ROW ── */}
        <View style={c.topRow}>
          <Image
            source={require("@/assets/images/icon.png")}
            style={c.logoIcon}
            resizeMode="cover"
          />
          <View style={c.topBrand}>
            <Text style={c.brandName}>Logbook</Text>
            <Text style={c.brandSub}>Flight Journal</Text>
          </View>
        </View>

        {/* ── RANK PILL — centred below branding ── */}
        {rank > 0 && (
          <View style={c.rankRow}>
            <View style={c.rankPill}>
              <Text style={c.rankStar}>{"\u2605"}</Text>
              <Text style={c.rankPillText}>TOP {topPct}% of all travellers</Text>
            </View>
          </View>
        )}

        {/* ── PERIOD + HEADLINE ── */}
        <View style={c.headlineBlock}>
          <Text style={c.headlinePeriod}>
            {`${isAllTime ? "ALL TIME" : periodLabel.toUpperCase()} \u00b7 YEAR RECAP`}
          </Text>
          <Text style={c.headline}>{headline}</Text>
        </View>

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

        {/* ── FUN FACTS ── */}
        <View style={c.factsBlock}>
          {timeFact && (
            <View style={c.factRow}>
              <Text style={c.factEmoji}>{"⏰"}</Text>
              <Text style={c.factText}>
                <Text style={c.factHighlight}>{formatHours(flightMin)} in the air.</Text>
                {` That\u2019s `}{timeFact}
              </Text>
            </View>
          )}
          {co2Fact && (
            <View style={c.factRow}>
              <Text style={c.factEmoji}>{"🍃"}</Text>
              <Text style={c.factText}>
                <Text style={c.factHighlight}>{formatNum(co2)} kg CO\u2082.</Text>
                {` That\u2019s like `}{co2Fact}
              </Text>
            </View>
          )}
        </View>

        {/* ── FOOTER ── */}
        <View style={c.footer}>
          <View style={c.footerLeft}>
            <Text style={c.ctaLine}>Track yours at</Text>
            <Text style={c.ctaUrl}>logbook.app</Text>
          </View>
          <AppStoreBadge width={148} />
        </View>

      </View>
    </View>
  );
}

function StatItem({ icon, color, value, label }: { icon:string;color:string;value:string;label:string }) {
  return (
    <View style={c.statItem}>
      <View style={[c.statIcon,{backgroundColor:color+"22"}]}>
        <Svg width={15} height={15} viewBox="0 0 24 24">
          <Path d={
            icon === "navigate"  ? "M12 2L19 21 12 17 5 21 12 2Z" :
            icon === "time"      ? "M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67V7z" :
            icon === "leaf"      ? "M17 8C8 10 5.9 16.17 3.82 21.34L5.71 22l1-2.3A4.49 4.49 0 008 20C19 20 22 3 22 3c-1 2-8 2-8 2 2-2.5 4.72-3.5 7-3.5-4 0-7 1.5-7 1.5C14 5 16.5 6 17 8z" :
            icon === "hourglass" ? "M6 2v6l4 4-4 4v6h12v-6l-4-4 4-4V2H6zm10 14.5V20H8v-3.5l4-4 4 4zM8 7.5V4h8v3.5l-4 4-4-4z" :
            ""
          } fill={color} />
        </Svg>
      </View>
      <Text style={c.statVal}>{value}</Text>
      <Text style={c.statLbl}>{label}</Text>
    </View>
  );
}

const c = StyleSheet.create({
  card:  {width:CARD_WIDTH,height:CARD_HEIGHT,backgroundColor:"#040C1E",borderRadius:28,overflow:"hidden",position:"relative"},
  glow1: {position:"absolute",width:360,height:360,borderRadius:180,backgroundColor:"rgba(79,142,240,0.10)",top:-100,right:-100},
  glow2: {position:"absolute",width:260,height:260,borderRadius:130,backgroundColor:"rgba(79,142,240,0.06)",bottom:80,left:-80},
  glow3: {position:"absolute",width:180,height:180,borderRadius:90,backgroundColor:"rgba(245,158,11,0.04)",top:260,left:100},
  star:  {position:"absolute",backgroundColor:"#FFFFFF"},
  gridH1:{position:"absolute",left:0,right:0,top:"35%",height:1,backgroundColor:"rgba(79,142,240,0.05)"},
  gridH2:{position:"absolute",left:0,right:0,top:"65%",height:1,backgroundColor:"rgba(79,142,240,0.05)"},

  inner: {flex:1,paddingHorizontal:32,paddingTop:38,paddingBottom:30,justifyContent:"space-between"},

  topRow:   {flexDirection:"row",alignItems:"center",gap:12},
  logoIcon: {width:52,height:52,borderRadius:52*0.22,overflow:"hidden"},
  topBrand: {flex:1,gap:2},
  brandName:{fontSize:26,color:"#F0F6FF",fontFamily:"DMSans_700Bold",letterSpacing:-0.5,lineHeight:28},
  brandSub: {fontSize:12,color:"rgba(79,142,240,0.7)",fontFamily:"DMSans_400Regular",letterSpacing:0.6},

  rankRow:      {alignItems:"center",marginTop:-4},
  rankPill:     {flexDirection:"row",alignItems:"center",gap:5,backgroundColor:"rgba(79,142,240,0.13)",borderWidth:1,borderColor:"rgba(79,142,240,0.35)",paddingHorizontal:14,paddingVertical:6,borderRadius:20},
  rankStar:     {fontSize:10,color:"#4F8EF0"},
  rankPillText: {fontSize:11,color:"#4F8EF0",fontFamily:"DMSans_700Bold",letterSpacing:0.8},

  headlineBlock: {gap:4},
  headlinePeriod:{fontSize:9,color:"rgba(240,246,255,0.3)",fontFamily:"DMSans_500Medium",letterSpacing:2.5,textTransform:"uppercase"},
  headline:      {fontSize:16,color:"#F0F6FF",fontFamily:"DMSans_700Bold",letterSpacing:-0.2,lineHeight:21},

  heroWrap:  {alignItems:"center",position:"relative"},
  heroGlow:  {position:"absolute",width:200,height:200,borderRadius:100,backgroundColor:"rgba(79,142,240,0.08)",top:-24},
  heroNum:   {fontSize:108,color:"#F0F6FF",fontFamily:"DMSans_700Bold",lineHeight:116,letterSpacing:-6,textShadowColor:"rgba(79,142,240,0.4)",textShadowOffset:{width:0,height:0},textShadowRadius:24},
  heroLabel: {fontSize:12,color:"rgba(79,142,240,0.65)",fontFamily:"DMSans_700Bold",letterSpacing:5,marginTop:-8},

  statsGrid:   {flexDirection:"row",backgroundColor:"rgba(255,255,255,0.04)",borderRadius:18,borderWidth:1,borderColor:"rgba(79,142,240,0.12)",paddingVertical:14,paddingHorizontal:6,alignItems:"center"},
  statItem:    {flex:1,alignItems:"center",gap:3},
  statDivider: {width:1,height:36,backgroundColor:"rgba(79,142,240,0.15)"},
  statIcon:    {width:28,height:28,borderRadius:8,alignItems:"center",justifyContent:"center",marginBottom:2},
  statVal:     {fontSize:15,color:"#F0F6FF",fontFamily:"DMSans_700Bold",letterSpacing:-0.3},
  statLbl:     {fontSize:9,color:"rgba(240,246,255,0.4)",fontFamily:"DMSans_500Medium",letterSpacing:1.5},

  factsBlock: {gap:8},
  factRow:    {flexDirection:"row",alignItems:"flex-start",gap:8,backgroundColor:"rgba(255,255,255,0.03)",borderRadius:12,borderWidth:1,borderColor:"rgba(255,255,255,0.06)",paddingHorizontal:12,paddingVertical:9},
  factEmoji:  {fontSize:14,lineHeight:20},
  factText:   {flex:1,fontSize:12,color:"rgba(240,246,255,0.65)",fontFamily:"DMSans_400Regular",lineHeight:18},
  factHighlight:{fontFamily:"DMSans_700Bold",color:"rgba(240,246,255,0.9)"},

  footer:     {flexDirection:"row",alignItems:"center",justifyContent:"space-between"},
  footerLeft: {gap:2},
  ctaLine:    {fontSize:10,color:"rgba(240,246,255,0.35)",fontFamily:"DMSans_400Regular",letterSpacing:0.3},
  ctaUrl:     {fontSize:14,color:"rgba(79,142,240,0.85)",fontFamily:"DMSans_700Bold",letterSpacing:0.2},
});
