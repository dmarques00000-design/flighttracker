/**
 * GlobeView — Apple Maps-style 3D globe rendered in a WebView using
 * deck.gl GlobeView with a deep-navy/satellite aesthetic:
 *   • Black starfield background
 *   • Deep navy ocean (#0B1F3A)
 *   • Muted teal-green land masses
 *   • Thin atmospheric blue rim glow
 *   • Great-circle arcs with white-blue gradient
 *   • White dot airport markers with blue halo
 *   • Slow auto-rotation that pauses on touch
 *   • Pinch-to-zoom
 *
 * Offline fallback: lightweight SVG flat-map shown when no connectivity.
 */
import React, { useRef, useMemo, useEffect, useState, useCallback } from "react";
import {
  View,
  StyleSheet,
  Dimensions,
  Platform,
  Text,
  AppState,
  AppStateStatus,
} from "react-native";
import { WebView } from "react-native-webview";
import { Flight } from "@/context/flights";

import Svg2, { Circle, Line, Polyline, G, Text as SvgText } from "react-native-svg";

const { width: SCREEN_W } = Dimensions.get("window");
const MAP_W = Math.min(SCREEN_W - 32, 600);
const MAP_H = MAP_W; // square canvas so the sphere looks perfect

// ─── Connectivity hook ────────────────────────────────────────────────────────
const PING_URL = "https://connectivitycheck.gstatic.com/generate_204";
const PING_TIMEOUT = 4000;

async function checkOnline(): Promise<boolean> {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), PING_TIMEOUT);
    const res = await fetch(PING_URL, { method: "HEAD", cache: "no-store", signal: ctrl.signal });
    clearTimeout(timer);
    return res.status < 400;
  } catch {
    return false;
  }
}

function useIsConnected(): boolean {
  const [connected, setConnected] = useState(true);
  const refresh = useCallback(async () => {
    setConnected(await checkOnline());
  }, []);
  useEffect(() => {
    refresh();
    const sub = AppState.addEventListener("change", (s: AppStateStatus) => {
      if (s === "active") refresh();
    });
    return () => sub.remove();
  }, [refresh]);
  return connected;
}

// ─── Airport registry (lng, lat) ──────────────────────────────────────────────
const AIRPORTS: Record<string, [number, number]> = {
  LIS:[-9.14,38.78],GVA:[6.11,46.24],ZRH:[8.55,47.46],
  ATL:[-84.43,33.64],MIA:[-80.29,25.80],JFK:[-73.78,40.64],
  LAX:[-118.41,33.94],LHR:[-0.45,51.47],CDG:[2.55,49.01],
  DXB:[55.37,25.25],HKG:[113.92,22.31],SYD:[151.18,-33.94],
  SIN:[103.99,1.36],NRT:[140.39,35.77],FRA:[8.56,50.04],
  AMS:[4.76,52.31],MAD:[-3.57,40.49],BCN:[2.08,41.30],
  FCO:[12.24,41.80],MUC:[11.78,48.35],ORD:[-87.91,41.97],
  SFO:[-122.38,37.62],BOS:[-71.01,42.37],IAD:[-77.46,38.95],
  EWR:[-74.17,40.69],BKK:[100.75,13.69],ICN:[126.44,37.46],
  DEL:[77.10,28.56],BOM:[72.87,19.09],CPT:[18.60,-33.96],
  GRU:[-46.47,-23.43],YYZ:[-79.63,43.68],MEX:[-99.07,19.43],
  DOH:[51.61,25.27],IST:[28.82,40.98],VIE:[16.57,48.11],
  BRU:[4.48,50.90],ARN:[17.92,59.65],CPH:[12.66,55.62],
  HEL:[24.96,60.32],OSL:[11.08,60.20],WAW:[20.97,52.17],
  PRG:[14.26,50.10],BUD:[19.26,47.43],ATH:[23.95,37.94],
  OPO:[-8.68,41.24],SVQ:[-5.90,37.42],AGP:[-4.50,36.68],
  TXL:[13.29,52.56],DUS:[6.77,51.28],HAM:[9.99,53.63],
  NCE:[7.21,43.66],MRS:[5.22,43.44],LYS:[5.09,45.72],
  EDI:[-3.37,55.95],MAN:[-2.27,53.35],DUB:[-6.27,53.42],
  KEF:[-22.62,63.99],TLV:[34.88,32.00],CAI:[31.41,30.12],
  CMN:[-7.59,33.37],TUN:[10.23,36.85],NBO:[36.93,-1.32],
  JNB:[28.24,-26.13],ACC:[-0.17,5.60],LOS:[3.32,6.58],
  ADD:[38.80,8.98],DAR:[39.20,-6.88],PEK:[116.58,40.08],
  PVG:[121.80,31.14],CAN:[113.30,23.39],KUL:[101.71,2.74],
  CGK:[106.65,-6.13],MNL:[121.02,14.51],BNE:[153.12,-27.38],
  MEL:[144.84,-37.67],AKL:[174.79,-37.01],SCL:[-70.79,-33.39],
  BOG:[-74.14,4.70],LIM:[-77.11,-12.02],EZE:[-58.54,-34.82],
  GIG:[-43.25,-22.81],YVR:[-123.18,49.19],YUL:[-73.74,45.47],
  CUN:[-86.87,21.04],PMI:[2.74,39.55],IBZ:[1.37,38.87],
  TFS:[-16.57,28.04],LPA:[-15.39,27.93],ACE:[-13.61,29.00],
  NAP:[14.29,40.88],MXP:[8.72,45.63],RAK:[-8.04,31.61],
};

// ─── Offline SVG fallback ─────────────────────────────────────────────────────
const PADDING = 20;
const LON_MIN = -180, LON_MAX = 180;
const LAT_MIN = -75,  LAT_MAX = 85;

function project(lon: number, lat: number): [number, number] {
  const x = PADDING + ((lon - LON_MIN) / (LON_MAX - LON_MIN)) * (MAP_W - PADDING * 2);
  const y = PADDING + ((LAT_MAX - lat) / (LAT_MAX - LAT_MIN)) * (MAP_H - PADDING * 2);
  return [x, y];
}

function greatCirclePoints(from: [number,number], to: [number,number], steps = 30): string {
  const [lon1, lat1] = from.map(d => (d * Math.PI) / 180);
  const [lon2, lat2] = to.map(d => (d * Math.PI) / 180);
  const pts: string[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const [x, y] = project((lon1 + (lon2-lon1)*t)*180/Math.PI, (lat1+(lat2-lat1)*t)*180/Math.PI);
    pts.push(`${x.toFixed(1)},${y.toFixed(1)}`);
  }
  return pts.join(" ");
}

function OfflineFallback({ flights }: { flights: Flight[] }) {
  const { arcs, airports } = useMemo(() => {
    const seen = new Set<string>();
    const arcList: {from:[number,number];to:[number,number]}[] = [];
    const apSet = new Set<string>();
    for (const f of flights) {
      const fc = AIRPORTS[f.departureAirport], tc = AIRPORTS[f.arrivalAirport];
      if (!fc || !tc) continue;
      apSet.add(f.departureAirport); apSet.add(f.arrivalAirport);
      const key = [f.departureAirport, f.arrivalAirport].sort().join("-");
      if (seen.has(key)) continue;
      seen.add(key);
      arcList.push({ from: fc, to: tc });
    }
    return { arcs: arcList, airports: Array.from(apSet).filter(k=>AIRPORTS[k]).map(k=>({iata:k,coords:AIRPORTS[k]})) };
  }, [flights]);

  return (
    <View style={styles.fallbackContainer}>
      <View style={styles.offlineBanner}>
        <Text style={styles.offlineBannerText}>✈︎  Offline — showing cached routes</Text>
      </View>
      <Svg2 width={MAP_W} height={MAP_H} style={styles.svg}>
        {[-60,-30,0,30,60].map(lat => {
          const [,y] = project(0,lat);
          return <Line key={`lat-${lat}`} x1={PADDING} y1={y} x2={MAP_W-PADDING} y2={y} stroke="#C8D4E0" strokeWidth={0.5} strokeDasharray="4 4"/>;
        })}
        {[-120,-60,0,60,120].map(lon => {
          const [x] = project(lon,0);
          return <Line key={`lon-${lon}`} x1={x} y1={PADDING} x2={x} y2={MAP_H-PADDING} stroke="#C8D4E0" strokeWidth={0.5} strokeDasharray="4 4"/>;
        })}
        {arcs.map((arc,i) => <Polyline key={`glow-${i}`} points={greatCirclePoints(arc.from,arc.to)} fill="none" stroke="rgba(79,142,240,0.18)" strokeWidth={8} strokeLinecap="round"/>)}
        {arcs.map((arc,i) => <Polyline key={`arc-${i}`} points={greatCirclePoints(arc.from,arc.to)} fill="none" stroke="#4F8EF0" strokeWidth={1.5} strokeLinecap="round" opacity={0.9}/>)}
        {airports.map(ap => { const [x,y]=project(ap.coords[0],ap.coords[1]); return <Circle key={`ring-${ap.iata}`} cx={x} cy={y} r={6} fill="rgba(79,142,240,0.22)"/>; })}
        {airports.map(ap => { const [x,y]=project(ap.coords[0],ap.coords[1]); return <Circle key={`dot-${ap.iata}`} cx={x} cy={y} r={3.5} fill="#1E64DC" stroke="white" strokeWidth={1.2}/>; })}
        {airports.length===0 && <SvgText x={MAP_W/2} y={MAP_H/2} textAnchor="middle" fontSize={13} fill="rgba(60,80,120,0.45)" fontFamily="-apple-system,sans-serif">Add flights to see your network</SvgText>}
      </Svg2>
    </View>
  );
}

// ─── buildHTML ────────────────────────────────────────────────────────────────
function buildHTML(flights: Flight[]): string {
  const seen = new Set<string>();
  const arcs: {from:[number,number];to:[number,number]}[] = [];
  const apSet = new Set<string>();

  for (const f of flights) {
    const fc = AIRPORTS[f.departureAirport], tc = AIRPORTS[f.arrivalAirport];
    if (!fc || !tc) continue;
    apSet.add(f.departureAirport); apSet.add(f.arrivalAirport);
    const key = [f.departureAirport, f.arrivalAirport].sort().join("-");
    if (seen.has(key)) continue;
    seen.add(key);
    arcs.push({ from: fc, to: tc });
  }

  const airports = Array.from(apSet).filter(k=>AIRPORTS[k]).map(k=>({iata:k,coords:AIRPORTS[k]}));
  const hasData = arcs.length > 0;

  let initLon = 10, initLat = 20;
  if (airports.length > 0) {
    initLon = airports.reduce((s,a)=>s+a.coords[0],0)/airports.length;
    initLat = airports.reduce((s,a)=>s+a.coords[1],0)/airports.length;
  }

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no"/>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  html,body{width:100%;height:100%;background:#000;overflow:hidden}
  canvas{display:block}
  #deck-canvas{position:absolute;inset:0;pointer-events:none}
  #empty{
    display:${hasData?"none":"flex"};
    position:absolute;inset:0;
    flex-direction:column;align-items:center;justify-content:center;
    color:rgba(180,210,255,0.55);font-family:-apple-system,sans-serif;gap:12px;
    pointer-events:none;z-index:10;
  }
  #empty p{font-size:13px;letter-spacing:0.4px;font-weight:500}
</style>
</head>
<body>
<canvas id="bg-canvas" style="position:absolute;inset:0;width:100%;height:100%;"></canvas>
<div id="deck-root" style="position:absolute;inset:0;"></div>
<div id="empty">
  <svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4">
    <circle cx="12" cy="12" r="10"/>
    <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
  </svg>
  <p>Add flights to see your network</p>
</div>

<script src="https://unpkg.com/deck.gl@9.1.6/dist.min.js"></script>

<script>
(function(){

// ── Starfield background ───────────────────────────────────────────────────────
(function drawStars(){
  const c = document.getElementById('bg-canvas');
  c.width  = window.innerWidth;
  c.height = window.innerHeight;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#030A14';
  ctx.fillRect(0,0,c.width,c.height);
  const N = 320;
  for(let i=0;i<N;i++){
    const x = Math.random()*c.width;
    const y = Math.random()*c.height;
    const r = Math.random()*1.1+0.15;
    const a = Math.random()*0.7+0.3;
    ctx.beginPath();
    ctx.arc(x,y,r,0,Math.PI*2);
    ctx.fillStyle = \`rgba(200,220,255,\${a})\`;
    ctx.fill();
  }
})();

const W = window.innerWidth;
const H = window.innerHeight;

const ARCS     = ${JSON.stringify(arcs)};
const AIRPORTS = ${JSON.stringify(airports)};

// Arc colours — white → pale blue gradient matching Apple Maps style
const ARC_SRC  = [220, 235, 255, 200];
const ARC_TIP  = [100, 175, 255, 200];
const ARC_GLOW = [100, 175, 255,  22];

// Dot colours — white dot with blue ring
const DOT_RING = [100, 180, 255,  80];
const DOT_FILL = [255, 255, 255, 255];
const DOT_CORE = [140, 200, 255, 220];

let bearing = ${initLon.toFixed(1)};
let userInteracting = false;
let rotateAF = null;

// deck.gl GlobeView with natural-earth basemap style
const {Deck, GlobeView, ArcLayer, ScatterplotLayer} = deck;

function buildLayers(scale){
  const s = scale || 1;
  const layers = [];
  if(ARCS.length > 0){
    layers.push(new ArcLayer({
      id:'arcs-glow',
      data:ARCS,
      getSourcePosition:d=>d.from,
      getTargetPosition:d=>d.to,
      getSourceColor:ARC_GLOW,
      getTargetColor:ARC_GLOW,
      getWidth:18*s,
      getHeight:0.42,
      greatCircle:true,
      widthUnits:'pixels',
      pickable:false,
    }));
    layers.push(new ArcLayer({
      id:'arcs-core',
      data:ARCS,
      getSourcePosition:d=>d.from,
      getTargetPosition:d=>d.to,
      getSourceColor:ARC_SRC,
      getTargetColor:ARC_TIP,
      getWidth:Math.max(1.5,2*s),
      getHeight:0.42,
      greatCircle:true,
      widthUnits:'pixels',
      pickable:true,
      autoHighlight:true,
      highlightColor:[255,210,80,255],
    }));
  }
  if(AIRPORTS.length > 0){
    layers.push(new ScatterplotLayer({
      id:'dots-halo',
      data:AIRPORTS,
      getPosition:d=>d.coords,
      getRadius:28000*s,
      getFillColor:DOT_RING,
      stroked:false,
      radiusUnits:'meters',
      pickable:false,
    }));
    layers.push(new ScatterplotLayer({
      id:'dots-fill',
      data:AIRPORTS,
      getPosition:d=>d.coords,
      getRadius:9000*s,
      getFillColor:DOT_FILL,
      stroked:true,
      lineWidthMinPixels:1.5,
      getLineColor:[100,175,255,180],
      radiusUnits:'meters',
      pickable:true,
      autoHighlight:true,
      highlightColor:[255,210,80,255],
    }));
    layers.push(new ScatterplotLayer({
      id:'dots-core',
      data:AIRPORTS,
      getPosition:d=>d.coords,
      getRadius:3200*s,
      getFillColor:DOT_CORE,
      stroked:false,
      radiusUnits:'meters',
      pickable:false,
    }));
  }
  return layers;
}

// Natural Earth style JSON (deep navy ocean, muted teal land)
const MAP_STYLE = {
  version:8,
  sources:{
    "ne-tiles":{
      type:"vector",
      tiles:["https://basemaps.cartocdn.com/gl/dark-matter-gl-style/{z}/{x}/{y}.pbf"],
      maxzoom:6
    }
  },
  layers:[
    {id:"bg",type:"background",paint:{"background-color":"#0B1F3A"}},
    {id:"water",type:"fill",source:"ne-tiles","source-layer":"water",paint:{"fill-color":"#0B1F3A"}},
    {id:"land",type:"fill",source:"ne-tiles","source-layer":"landcover",paint:{"fill-color":"#1C4D45","fill-opacity":0.9}},
    {id:"land2",type:"fill",source:"ne-tiles","source-layer":"land",paint:{"fill-color":"#1E5248","fill-opacity":0.85}},
    {id:"country-border",type:"line",source:"ne-tiles","source-layer":"admin",paint:{"line-color":"rgba(150,210,200,0.25)","line-width":0.5}},
    {id:"state-border",type:"line",source:"ne-tiles","source-layer":"admin",filter:["==","admin_level",4],paint:{"line-color":"rgba(150,210,200,0.12)","line-width":0.25}},
  ]
};

// Fallback: use Carto dark-matter tile style URL (supports GlobeView natively)
const STYLE_URL = "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json";

let deckInstance = null;

function getViewState(){
  return {
    longitude: bearing,
    latitude: ${initLat.toFixed(1)},
    zoom: ${hasData ? 1.0 : 0.85},
    minZoom: 0.5,
    maxZoom: 4,
  };
}

deckInstance = new Deck({
  canvas: (() => {
    const c = document.createElement('canvas');
    c.id = 'deck-canvas';
    c.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;';
    document.getElementById('deck-root').appendChild(c);
    return c;
  })(),
  width: W,
  height: H,
  views: new GlobeView({id:'globe', resolution:1}),
  initialViewState: getViewState(),
  controller: {
    touchZoom: true,
    touchRotate: false,
    dragPan: true,
    keyboard: false,
    scrollZoom: true,
  },
  layers: buildLayers(1),
  map: true,
  mapStyle: STYLE_URL,
  parameters: {clearColor:[0,0,0,0]},
  onViewStateChange: ({viewState}) => {
    bearing = viewState.longitude;
    userInteracting = true;
    clearTimeout(window._resumeTimer);
    window._resumeTimer = setTimeout(() => { userInteracting = false; }, 1200);
    deckInstance.setProps({viewState});
    return viewState;
  },
  _onMetrics: null,
});

// Slow auto-rotation
function autoRotate(){
  if(!userInteracting && deckInstance){
    bearing = (bearing + 0.04) % 360;
    deckInstance.setProps({
      viewState: { ...getViewState(), longitude: bearing, transitionDuration: 0 }
    });
  }
  rotateAF = requestAnimationFrame(autoRotate);
}
autoRotate();

window.addEventListener('resize', () => {
  document.getElementById('bg-canvas').width  = window.innerWidth;
  document.getElementById('bg-canvas').height = window.innerHeight;
});

})();
</script>
</body>
</html>`;
}

// ─── Component ────────────────────────────────────────────────────────────────
interface Props { flights: Flight[]; }

export function GlobeView({ flights }: Props) {
  const webRef = useRef<any>(null);
  const html   = useMemo(() => buildHTML(flights), [flights]);
  const isConnected = useIsConnected();

  return (
    <View style={[styles.container, { width: MAP_W, height: MAP_H }]}>
      {isConnected ? (
        <WebView
          ref={webRef}
          source={{ html }}
          style={styles.webview}
          scrollEnabled={false}
          bounces={false}
          overScrollMode="never"
          originWhitelist={["*"]}
          allowsInlineMediaPlayback
          javaScriptEnabled
          domStorageEnabled
          mixedContentMode="always"
          allowFileAccess
          allowUniversalAccessFromFileURLs
          backgroundColor="#030A14"
          {...(Platform.OS === "ios" ? { decelerationRate: "fast" } : {})}
          onError={(e) => console.warn("GlobeView error:", e.nativeEvent)}
        />
      ) : (
        <OfflineFallback flights={flights} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 20,
    overflow: "hidden",
    backgroundColor: "#030A14",
  },
  webview: { flex: 1, backgroundColor: "transparent" },
  fallbackContainer: { flex: 1, backgroundColor: "#030A14", borderRadius: 20, overflow: "hidden" },
  offlineBanner: { position: "absolute", top: 8, left: 0, right: 0, zIndex: 10, alignItems: "center" },
  offlineBannerText: {
    fontSize: 11, color: "rgba(160,200,255,0.75)", fontWeight: "500",
    backgroundColor: "rgba(11,31,58,0.88)", paddingHorizontal: 10,
    paddingVertical: 3, borderRadius: 10, overflow: "hidden", letterSpacing: 0.2,
  },
  svg: { backgroundColor: "#030A14" },
});

export default GlobeView;
