/**
 * MonthlyRecapCard — Monthly Recap
 * Same viral-optimised approach as StoryCard.
 * Language: "You\u2019ve taken X flights this [Month]"
 * Fun facts: time-in-air + CO\u2082 comparisons
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
import { getTimeFunFact } from "@/utils/timeFunFact";

export const CARD_WIDTH  = 390;
export const CARD_HEIGHT = 693;

const MONTH_NAMES = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];

function fmt(n: number): string {
  if (n >= 1_000_000) return `${(n/1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${(n/1_000).toFixed(1)}K`;
  return String(n);
}
function fmtHours(minutes: number): string {
  const h=Math.floor(minutes/60), m=minutes%60;
  if (h===0) return `${m}m`;
  if (m===0) return `${h}h`;
  return `${h}h\u2009${m}m`;
}
function computeRank(n: number): number {
  if (n===0) return 0;
  if (n<=1) return 15; if (n<=3) return 35; if (n<=6) return 55;
  if (n<=10) return 70; if (n<=15) return 82; if (n<=25) return 91;
  if (n<=40) return 96; return 99;
}
function getTopRoutes(flights: Flight[]): { dep:string;arr:string;count:number }[] {
  const freq: Record<string,number> = {};
  flights.forEach((f) => { const k=`${f.departureAirport}\u2192${f.arrivalAirport}`; freq[k]=(freq[k]||0)+1; });
  return Object.entries(freq).sort((a,b)=>b[1]-a[1]).slice(0,3)
    .map(([k,count])=>{ const [dep,arr]=k.split("\u2192"); return {dep,arr,count}; });
}
function getUniqueDestinations(flights: Flight[]): number {
  return new Set(flights.map((f)=>f.arrivalCity)).size;
}

// ── LogoMark ────────────────────────────────────────────────────────────────────────────
function LogoMark({ size = 28 }: { size?: number }) {
  const s=size,pad=s*0.10,bw=s-pad*2,bh=bw*0.72,bx=pad,by=(s-bh)/2,spX=bx+bw/2;
  const lx1=bx,ly1=by+bh*0.06,lx2=spX-1,ly2=by,lx3=spX-1,ly3=by+bh,lx4=bx,ly4=by+bh*0.94;
  const rx1=spX+1,ry1=by,rx2=bx+bw,ry2=by+bh*0.06,rx3=bx+bw,ry3=by+bh*0.94,rx4=spX+1,ry4=by+bh;
  const arcPad=bw*0.1,arcX0=spX+arcPad+2,arcX3=bx+bw-arcPad,arcCX=(arcX0+arcX3)/2,arcY=by+bh*0.5,arcCY=arcY-bh*0.22;
  return (
    <Svg width={s} height={s} viewBox={`0 0 ${s} ${s}`}>
      <Defs>
        <ClipPath id="mrc_clip"><Rect x="0" y="0" width={s} height={s} rx={s*0.22} ry={s*0.22} /></ClipPath>
        <SvgLG id="mrc_bg" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0%" stopColor="#16161E" stopOpacity="1" />
          <Stop offset="100%" stopColor="#0E0E18" stopOpacity="1" />
        </SvgLG>
      </Defs>
      <Rect x="0" y="0" width={s} height={s} rx={s*0.22} ry={s*0.22} fill="url(#mrc_bg)" />
      <G clipPath="url(#mrc_clip)">
        <Path d={`M${lx1},${ly1} L${lx2},${ly2} L${lx3},${ly3} L${lx4},${ly4} Z`} fill="#16161E" stroke="#2A2A3A" strokeWidth={s*0.025} />
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

// ── App Store Badge ───────────────────────────────────────────────────────────────────────────
function AppStoreBadge({ width = 118 }: { width?: number }) {
  const h=width*0.33, r=h*0.28;
  return (
    <Svg width={width} height={h} viewBox={`0 0 ${width} ${h}`}>
      <Defs>
        <SvgLG id="mbadge_bg" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0%" stopColor="#2A2A35" stopOpacity="1" />
          <Stop offset="100%" stopColor="#1A1A25" stopOpacity="1" />
        </SvgLG>
      </Defs>
      <Rect x={0} y={0} width={width} height={h} rx={r} ry={r} fill="url(#mbadge_bg)" stroke="rgba(255,255,255,0.15)" strokeWidth={0.8} />
      <Text x={width*0.5} y={h*0.40} fontSize={h*0.28} fill="rgba(255,255,255,0.65)" fontFamily="DMSans_400Regular" textAnchor="middle" letterSpacing={0.3}>Available on the</Text>
      <Text x={width*0.5} y={h*0.80} fontSize={h*0.42} fill="#FFFFFF" fontFamily="DMSans_700Bold" textAnchor="middle" letterSpacing={-0.2}>App Store</Text>
    </Svg>
  );
}

// ── StatBox ────────────────────────────────────────────────────────────────────────────
function StatBox({ icon, color, value, label }: { icon:string;color:string;value:string;label:string }) {
  return (
    <View style={s.statBox}>
      <View style={[s.statIcon,{backgroundColor:color+"22"}]}>
        <Ionicons name={icon as never} size={14} color={color} />
      </View>
      <Text style={s.statValue}>{value}</Text>
      <Text style={s.statLabel}>{label}</Text>
    </View>
  );
}

export interface MonthlyRecapCardProps {
  flights: Flight[];
  month: number;
  year: number;
}

const STARS: {t:number;l:number;r:number;o:number}[] = [
  {t:22,l:40,r:2,o:.6},{t:55,l:310,r:1.5,o:.5},{t:80,l:170,r:1,o:.4},{t:110,l:340,r:2,o:.7},
  {t:140,l:15,r:1.5,o:.5},{t:200,l:290,r:1,o:.4},{t:240,l:60,r:2,o:.3},{t:300,l:350,r:1.5,o:.6},
  {t:480,l:25,r:1.5,o:.4},{t:530,l:340,r:2,o:.5},{t:590,l:180,r:1,o:.3},{t:630,l:80,r:2,o:.4},
];

export default function MonthlyRecapCard({ flights, month, year }: MonthlyRecapCardProps) {
  const count        = flights.length;
  const miles        = flights.reduce((acc,f)=>acc+f.distanceMiles, 0);
  const co2          = flights.reduce((acc,f)=>acc+f.co2Kg, 0);
  const flightMin    = flights.reduce((acc,f)=>acc+f.durationMinutes, 0);
  const rank         = computeRank(count);
  const topRoutes    = getTopRoutes(flights);
  const destinations = getUniqueDestinations(flights);
  const monthName    = MONTH_NAMES[month];
  const co2Fact      = co2 > 0 ? getCO2FunFact(co2) : null;
  const timeFact     = flightMin > 0 ? getTimeFunFact(flightMin) : null;

  // Headline: "You\u2019ve taken X flights this March"
  const headline = `You\u2019ve taken ${count} flight${count!==1?"s":""} this ${monthName}`;

  return (
    <View style={s.card}>
      <LinearGradient colors={["#030A1C","#071330","#030A1C"]} locations={[0,0.5,1]} style={StyleSheet.absoluteFill} />
      <View style={s.glow1} />
      <View style={s.glow2} />
      <View style={s.glow3} />
      {STARS.map((st,i)=>(<View key={i} style={[s.star,{top:st.t,left:st.l,width:st.r,height:st.r,borderRadius:st.r/2,opacity:st.o}]} />))}
      <View style={s.gridH1} />
      <View style={s.gridH2} />

      <View style={s.inner}>

        {/* ── TOP BRANDING ── */}
        <View style={s.topRow}>
          <LogoMark size={36} />
          <View style={s.topBrand}>
            <Text style={s.brandName}>Logbook</Text>
            <Text style={s.brandSub}>Flight Journal</Text>
          </View>
          {rank > 0 && (
            <View style={s.rankPill}>
              <Text style={s.rankPillText}>TOP {100-rank}%</Text>
            </View>
          )}
        </View>

        {/* ── MONTH + HEADLINE ── */}
        <View style={s.heroBlock}>
          <View style={s.heroGlow} />
          <Text style={s.monthName}>{monthName.toUpperCase()}</Text>
          <Text style={s.yearLabel}>{year}</Text>
          <Text style={s.heroNum}>{count}</Text>
          <Text style={s.heroSub}>{count===1?"FLIGHT":"FLIGHTS"}</Text>
          <Text style={s.headline}>{headline}</Text>
        </View>

        {/* ── STAT GRID ── */}
        <View style={s.statGrid}>
          <StatBox icon="navigate" color="#4F8EF0" value={fmt(miles)} label="MILES" />
          <View style={s.statDivV} />
          <StatBox icon="time" color="#F59E0B" value={fmtHours(flightMin)} label="IN AIR" />
          <View style={s.statDivV} />
          <StatBox icon="leaf" color="#10B981" value={`${fmt(co2)}kg`} label="CO\u2082" />
          <View style={s.statDivV} />
          <StatBox icon="location" color="#4F8EF0" value={String(destinations)} label={destinations===1?"DEST":"DESTS"} />
        </View>

        {/* ── FUN FACTS ── */}
        <View style={s.factsBlock}>
          {timeFact && (
            <View style={s.factRow}>
              <Text style={s.factEmoji}>\u23F0</Text>
              <Text style={s.factText}>
                <Text style={s.factHighlight}>{fmtHours(flightMin)} in the air.</Text>
                {" That\u2019s "}{timeFact}
              </Text>
            </View>
          )}
          {co2Fact && (
            <View style={s.factRow}>
              <Text style={s.factEmoji}>\uD83C\uDF43</Text>
              <Text style={s.factText}>
                <Text style={s.factHighlight}>{fmt(co2)} kg CO\u2082.</Text>
                {" That\u2019s like "}{co2Fact}
              </Text>
            </View>
          )}
        </View>

        {/* ── TOP ROUTES ── */}
        {topRoutes.length > 0 && (
          <View style={s.routesBlock}>
            <Text style={s.sectionLabel}>\u2708\uFE0F TOP ROUTES</Text>
            {topRoutes.map((r,i)=>(
              <View key={i} style={s.routeRow}>
                <Text style={s.routeIata}>{r.dep}</Text>
                <View style={s.routeLine}>
                  <View style={s.routeDash} />
                  <View style={s.planeWrap}><Ionicons name="airplane" size={11} color="#4F8EF0" /></View>
                  <View style={s.routeDash} />
                </View>
                <Text style={[s.routeIata,{textAlign:"right"}]}>{r.arr}</Text>
                {r.count>1 && <View style={s.countPill}><Text style={s.countPillText}>x{r.count}</Text></View>}
              </View>
            ))}
          </View>
        )}

        {count===0 && (
          <View style={s.emptyBlock}>
            <Ionicons name="airplane-outline" size={36} color="rgba(79,142,240,0.3)" />
            <Text style={s.emptyText}>No flights this month</Text>
          </View>
        )}

        {/* ── FOOTER ── */}
        <View style={s.footer}>
          <View style={s.footerLeft}>
            <Text style={s.ctaLine}>Track yours at</Text>
            <Text style={s.ctaUrl}>logbook.app</Text>
          </View>
          <AppStoreBadge width={118} />
        </View>

      </View>
    </View>
  );
}

const s = StyleSheet.create({
  card:  {width:CARD_WIDTH,height:CARD_HEIGHT,backgroundColor:"#030A1C",borderRadius:28,overflow:"hidden"},
  glow1: {position:"absolute",width:340,height:340,borderRadius:170,backgroundColor:"rgba(79,142,240,0.09)",top:-90,right:-90},
  glow2: {position:"absolute",width:260,height:260,borderRadius:130,backgroundColor:"rgba(79,142,240,0.05)",bottom:60,left:-80},
  glow3: {position:"absolute",width:200,height:200,borderRadius:100,backgroundColor:"rgba(245,158,11,0.04)",top:280,left:90},
  star:  {position:"absolute",backgroundColor:"#FFFFFF"},
  gridH1:{position:"absolute",left:0,right:0,top:"40%",height:1,backgroundColor:"rgba(79,142,240,0.05)"},
  gridH2:{position:"absolute",left:0,right:0,top:"68%",height:1,backgroundColor:"rgba(79,142,240,0.05)"},

  inner: {flex:1,paddingHorizontal:32,paddingTop:38,paddingBottom:28,justifyContent:"space-between"},

  topRow:    {flexDirection:"row",alignItems:"center",gap:10},
  topBrand:  {flex:1,gap:1},
  brandName: {fontSize:20,color:"#F0F6FF",fontFamily:"DMSans_700Bold",letterSpacing:-0.3,lineHeight:22},
  brandSub:  {fontSize:10,color:"rgba(79,142,240,0.7)",fontFamily:"DMSans_400Regular",letterSpacing:0.8},
  rankPill:  {backgroundColor:"rgba(79,142,240,0.15)",borderWidth:1,borderColor:"rgba(79,142,240,0.4)",paddingHorizontal:12,paddingVertical:5,borderRadius:20},
  rankPillText:{fontSize:11,color:"#4F8EF0",fontFamily:"DMSans_700Bold",letterSpacing:1.5},

  heroBlock: {alignItems:"center",position:"relative"},
  heroGlow:  {position:"absolute",width:230,height:230,borderRadius:115,backgroundColor:"rgba(79,142,240,0.07)",top:-16},
  monthName: {fontSize:40,color:"#F0F6FF",fontFamily:"DMSans_700Bold",letterSpacing:-1.5,lineHeight:44},
  yearLabel: {fontSize:12,color:"rgba(240,246,255,0.3)",fontFamily:"DMSans_400Regular",letterSpacing:3,marginBottom:4},
  heroNum:   {fontSize:100,color:"#F0F6FF",fontFamily:"DMSans_700Bold",lineHeight:108,letterSpacing:-5,textShadowColor:"rgba(79,142,240,0.4)",textShadowOffset:{width:0,height:0},textShadowRadius:20},
  heroSub:   {fontSize:11,color:"rgba(79,142,240,0.65)",fontFamily:"DMSans_700Bold",letterSpacing:5,marginTop:-6},
  headline:  {fontSize:13,color:"rgba(240,246,255,0.55)",fontFamily:"DMSans_500Medium",letterSpacing:-0.1,marginTop:6,textAlign:"center"},

  statGrid:  {flexDirection:"row",backgroundColor:"rgba(255,255,255,0.04)",borderRadius:16,borderWidth:1,borderColor:"rgba(79,142,240,0.12)",paddingVertical:14,paddingHorizontal:4,alignItems:"center"},
  statBox:   {flex:1,alignItems:"center",gap:4},
  statDivV:  {width:1,height:34,backgroundColor:"rgba(79,142,240,0.15)"},
  statIcon:  {width:26,height:26,borderRadius:8,alignItems:"center",justifyContent:"center",marginBottom:2},
  statValue: {fontSize:15,color:"#F0F6FF",fontFamily:"DMSans_700Bold",letterSpacing:-0.3},
  statLabel: {fontSize:9,color:"rgba(240,246,255,0.4)",fontFamily:"DMSans_500Medium",letterSpacing:1.5},

  factsBlock: {gap:7},
  factRow:    {flexDirection:"row",alignItems:"flex-start",gap:8,backgroundColor:"rgba(255,255,255,0.03)",borderRadius:11,borderWidth:1,borderColor:"rgba(255,255,255,0.06)",paddingHorizontal:11,paddingVertical:8},
  factEmoji:  {fontSize:13,lineHeight:19},
  factText:   {flex:1,fontSize:11,color:"rgba(240,246,255,0.65)",fontFamily:"DMSans_400Regular",lineHeight:17},
  factHighlight:{fontFamily:"DMSans_700Bold",color:"rgba(240,246,255,0.9)"},

  routesBlock:  {gap:8},
  sectionLabel: {fontSize:9,color:"rgba(79,142,240,0.55)",fontFamily:"DMSans_700Bold",letterSpacing:2.5,marginBottom:2},
  routeRow:  {flexDirection:"row",alignItems:"center",gap:0},
  routeIata: {fontSize:18,color:"#F0F6FF",fontFamily:"DMSans_700Bold",width:44,letterSpacing:-0.5},
  routeLine: {flex:1,flexDirection:"row",alignItems:"center",gap:4,paddingHorizontal:6},
  routeDash: {flex:1,height:1,backgroundColor:"rgba(79,142,240,0.25)"},
  planeWrap: {width:20,height:20,borderRadius:10,backgroundColor:"rgba(79,142,240,0.15)",alignItems:"center",justifyContent:"center"},
  countPill: {backgroundColor:"rgba(79,142,240,0.15)",paddingHorizontal:7,paddingVertical:2,borderRadius:8,marginLeft:6},
  countPillText:{fontSize:10,color:"#4F8EF0",fontFamily:"DMSans_700Bold"},

  emptyBlock: {alignItems:"center",gap:8,paddingVertical:20},
  emptyText:  {fontSize:13,color:"rgba(240,246,255,0.3)",fontFamily:"DMSans_400Regular"},

  footer:     {flexDirection:"row",alignItems:"center",justifyContent:"space-between"},
  footerLeft: {gap:2},
  ctaLine:    {fontSize:10,color:"rgba(240,246,255,0.35)",fontFamily:"DMSans_400Regular",letterSpacing:0.3},
  ctaUrl:     {fontSize:14,color:"rgba(79,142,240,0.85)",fontFamily:"DMSans_700Bold",letterSpacing:0.2},
});
