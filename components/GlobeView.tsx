/**
 * GlobeView — deck.gl ArcLayer map with Apple Maps-style light basemap.
 *
 * Requirements:
 *   npx expo install react-native-webview
 *
 * Basemap: Carto Voyager (light, coloured roads, cyan water — closest free
 *          equivalent to Apple Maps). Arc & dot colours tuned for light bg.
 */
import React, { useRef, useMemo } from "react";
import { View, StyleSheet, Dimensions, Platform } from "react-native";
import { WebView } from "react-native-webview";
import { Flight } from "@/context/flights";

const { width: SCREEN_W } = Dimensions.get("window");
const MAP_W = Math.min(SCREEN_W - 40, 600);
const MAP_H = Math.round(MAP_W * 0.62);

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

function buildHTML(flights: Flight[]): string {
  const seenRoutes = new Set<string>();
  const arcs: { from: [number,number]; to: [number,number] }[] = [];
  const airportSet = new Set<string>();

  for (const f of flights) {
    const fc = AIRPORTS[f.departureAirport];
    const tc = AIRPORTS[f.arrivalAirport];
    if (!fc || !tc) continue;
    airportSet.add(f.departureAirport);
    airportSet.add(f.arrivalAirport);
    const key = [f.departureAirport, f.arrivalAirport].sort().join("-");
    if (seenRoutes.has(key)) continue;
    seenRoutes.add(key);
    arcs.push({ from: fc, to: tc });
  }

  const airports = Array.from(airportSet)
    .filter(k => AIRPORTS[k])
    .map(k => ({ iata: k, coords: AIRPORTS[k] }));

  const hasData = arcs.length > 0;
  let initLon = 10, initLat = 30;
  if (airports.length > 0) {
    initLon = airports.reduce((s, a) => s + a.coords[0], 0) / airports.length;
    initLat = airports.reduce((s, a) => s + a.coords[1], 0) / airports.length;
  }

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no"/>
<link rel="stylesheet" href="https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.css"/>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  html,body{width:100%;height:100%;background:#EEF2F5;overflow:hidden}
  #map{width:100%;height:100%}
  /* Hide Maplibre logo & attribution for cleaner Apple-like look */
  .maplibregl-ctrl-bottom-left,.maplibregl-ctrl-bottom-right{display:none!important}
  /* Empty state */
  #empty{
    display:${hasData ? "none" : "flex"};
    position:absolute;inset:0;
    flex-direction:column;align-items:center;justify-content:center;
    color:rgba(60,80,120,0.45);font-family:-apple-system,sans-serif;gap:10px;
    pointer-events:none;
  }
  #empty p{font-size:13px;letter-spacing:0.3px;font-weight:500}
</style>
</head>
<body>
<div id="map"></div>
<div id="empty">
  <svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4">
    <circle cx="12" cy="12" r="10"/>
    <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
  </svg>
  <p>Add flights to see your network</p>
</div>

<script src="https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.js"></script>
<script src="https://unpkg.com/@deck.gl/core@9.1.6/dist.min.js"></script>
<script src="https://unpkg.com/@deck.gl/layers@9.1.6/dist.min.js"></script>
<script src="https://unpkg.com/@deck.gl/mapbox@9.1.6/dist.min.js"></script>

<script>
(function(){

// ── Colour palette tuned for light Apple Maps-style bg ──────────────────────
// Arc: rich blue on light bg — use the app accent but fully saturated
const ARC_SRC  = [40, 120, 240, 210];   // deep blue tail
const ARC_TIP  = [90, 160, 255, 210];   // lighter blue head
const ARC_GLOW = [79, 142, 240,  28];   // translucent halo
const DOT_FILL = [30, 100, 220, 255];   // solid dot
const DOT_RING = [79, 142, 240,  55];   // outer pulse
const DOT_CORE = [255, 255, 255, 245];  // white pinpoint

const ARCS     = ${JSON.stringify(arcs)};
const AIRPORTS = ${JSON.stringify(airports)};

// ── Apple Maps-inspired Maplibre style (Carto Voyager with tweaks) ───────────
// Voyager is the closest free style: coloured roads, cyan/teal water,
// cream land, thin grey labels — all hallmarks of Apple Maps.
const STYLE_URL = "https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json";

const map = new maplibregl.Map({
  container: "map",
  style: STYLE_URL,
  center: [${initLon.toFixed(2)}, ${initLat.toFixed(2)}],
  zoom: ${hasData ? 1.9 : 1.3},
  pitch: 0,          // flat on load — Apple Maps is flat by default
  bearing: 0,
  antialias: true,
  attributionControl: false,
  logoPosition: "bottom-right",
});

// ── After style loads, apply Apple Maps colour overrides ────────────────────
map.on("load", () => {

  // ── Water: Apple Maps signature teal (#ACE1F0 → #7EC8E3)
  ["water","water-shadow","waterway","waterway-shadow"].forEach(id => {
    if (map.getLayer(id)) {
      try { map.setPaintProperty(id, "fill-color", "#B8E4F4"); } catch(_){}
      try { map.setPaintProperty(id, "line-color", "#91D4EE"); } catch(_){}
    }
  });

  // ── Land: Apple Maps warm cream
  ["background","landcover","land"].forEach(id => {
    if (map.getLayer(id)) {
      try { map.setPaintProperty(id, "background-color", "#F5F0E8"); } catch(_){}
      try { map.setPaintProperty(id, "fill-color",       "#F5F0E8"); } catch(_){}
    }
  });

  // ── Parks / green areas: Apple Maps muted sage green
  ["landuse-park","landuse_park","park","green_areas","landuse-residential"].forEach(id => {
    if (map.getLayer(id)) {
      try { map.setPaintProperty(id, "fill-color", "#D4E8CE"); } catch(_){}
    }
  });

  // ── Roads: Apple Maps light grey palette
  map.getStyle().layers.forEach(layer => {
    if (!layer.id) return;
    const lid = layer.id.toLowerCase();
    if (lid.includes("road") || lid.includes("highway") || lid.includes("street") || lid.includes("tunnel") || lid.includes("bridge")) {
      if (layer.type === "line") {
        const color = lid.includes("motorway") || lid.includes("highway")
          ? "#E2C97E"   // Apple Maps tan/gold for highways
          : "#FFFFFF";  // white for streets
        try { map.setPaintProperty(layer.id, "line-color", color); } catch(_){}
      }
      if (layer.type === "fill") {
        try { map.setPaintProperty(layer.id, "fill-color", "#FFFFFF"); } catch(_){}
      }
    }
    // Casing / outline roads
    if (lid.includes("casing") || lid.includes("outline")) {
      if (layer.type === "line") {
        try { map.setPaintProperty(layer.id, "line-color", "#D8D0C8"); } catch(_){}
      }
    }
    // Building footprints: Apple Maps very soft grey
    if (lid.includes("building")) {
      if (layer.type === "fill") {
        try { map.setPaintProperty(layer.id, "fill-color",   "#E8E0D8"); } catch(_){}
        try { map.setPaintProperty(layer.id, "fill-opacity", 0.7);       } catch(_){}
      }
    }
  });

  // ── Slight pitch-in after load for depth (subtle, like iOS 17 Maps)
  setTimeout(() => {
    map.easeTo({ pitch: 28, bearing: -8, duration: 1600,
      easing: t => t<0.5 ? 2*t*t : -1+(4-2*t)*t });
  }, 400);

  startRotate();
});

// ── deck.gl overlay ──────────────────────────────────────────────────────────
const { MapboxOverlay, ArcLayer, ScatterplotLayer } = deck;

function buildLayers() {
  const layers = [];

  if (ARCS.length > 0) {
    // Wide soft glow — like a shadow of the arc
    layers.push(new ArcLayer({
      id: "arcs-glow",
      data: ARCS,
      getSourcePosition: d => d.from,
      getTargetPosition: d => d.to,
      getSourceColor: ARC_GLOW,
      getTargetColor: ARC_GLOW,
      getWidth: 14,
      getHeight: 0.45,
      greatCircle: true,
      widthUnits: "pixels",
      pickable: false,
    }));

    // Crisp core arc — blue gradient source → tip
    layers.push(new ArcLayer({
      id: "arcs-core",
      data: ARCS,
      getSourcePosition: d => d.from,
      getTargetPosition: d => d.to,
      getSourceColor: ARC_SRC,
      getTargetColor: ARC_TIP,
      getWidth: 2,
      getHeight: 0.45,
      greatCircle: true,
      widthUnits: "pixels",
      pickable: true,
      autoHighlight: true,
      highlightColor: [255, 180, 40, 255],
    }));
  }

  if (AIRPORTS.length > 0) {
    // Outer pulse ring
    layers.push(new ScatterplotLayer({
      id: "dots-ring",
      data: AIRPORTS,
      getPosition: d => d.coords,
      getRadius: 22000,
      getFillColor: DOT_RING,
      stroked: false,
      radiusUnits: "meters",
      pickable: false,
    }));

    // Solid dot with white border
    layers.push(new ScatterplotLayer({
      id: "dots-fill",
      data: AIRPORTS,
      getPosition: d => d.coords,
      getRadius: 8000,
      getFillColor: DOT_FILL,
      stroked: true,
      lineWidthMinPixels: 1.5,
      getLineColor: [255, 255, 255, 220],
      radiusUnits: "meters",
      pickable: true,
      autoHighlight: true,
      highlightColor: [255, 180, 40, 255],
    }));

    // Tiny white centre core
    layers.push(new ScatterplotLayer({
      id: "dots-core",
      data: AIRPORTS,
      getPosition: d => d.coords,
      getRadius: 2800,
      getFillColor: DOT_CORE,
      stroked: false,
      radiusUnits: "meters",
      pickable: false,
    }));
  }

  return layers;
}

const overlay = new MapboxOverlay({
  interleaved: false,
  layers: buildLayers(),
});
map.addControl(overlay);

// ── Slow auto-rotate (very gentle — Apple Maps never auto-rotates, ────────────
//    but a barely-perceptible drift looks premium) ────────────────────────────
let userInteracting = false;
let rotateTimer = null;

function startRotate() {
  if (rotateTimer) return;
  rotateTimer = setInterval(() => {
    if (!userInteracting) {
      map.setBearing((map.getBearing() + 0.05) % 360);
    }
  }, 50);
}

map.on("mousedown",  () => { userInteracting = true; });
map.on("touchstart", () => { userInteracting = true; });
map.on("mouseup",    () => { userInteracting = false; });
map.on("touchend",   () => { setTimeout(() => { userInteracting = false; }, 900); });

window.addEventListener("resize", () => map.resize());

})();
</script>
</body>
</html>`;
}

interface Props { flights: Flight[]; }

export function GlobeView({ flights }: Props) {
  const webRef = useRef<any>(null);
  const html = useMemo(() => buildHTML(flights), [flights]);

  return (
    <View style={[styles.container, { width: MAP_W, height: MAP_H }]}>
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
        backgroundColor="#EEF2F5"
        {...(Platform.OS === "ios" ? { decelerationRate: "fast" } : {})}
        onError={(e) => console.warn("GlobeView error:", e.nativeEvent)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { borderRadius: 16, overflow: "hidden", backgroundColor: "#EEF2F5" },
  webview:   { flex: 1, backgroundColor: "transparent" },
});

export default GlobeView;
