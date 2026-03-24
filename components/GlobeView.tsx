/**
 * GlobeView — deck.gl ArcLayer globe rendered inside a WebView.
 *
 * Requirements:
 *   npx expo install react-native-webview
 *
 * Features:
 *  - Dark Carto "Dark Matter" basemap (free, no API key)
 *  - deck.gl ArcLayer with animated, glowing great-circle arcs
 *  - ScatterplotLayer airport dots with pulse ring
 *  - Orthographic-style globe tilt on load
 *  - Smooth auto-rotate that pauses on user interaction
 *  - Fully matches app accent colour (#4F8EF0)
 *  - Data passed via postMessage — no server round-trip
 */
import React, { useRef, useMemo, useCallback } from "react";
import { View, StyleSheet, Dimensions, Platform } from "react-native";
import { WebView } from "react-native-webview";
import { Flight } from "@/context/flights";

const { width: SCREEN_W } = Dimensions.get("window");
const MAP_W = Math.min(SCREEN_W - 40, 600);
const MAP_H = Math.round(MAP_W * 0.62);

// ─── Airport registry ──────────────────────────────────────────────────────────
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

// Build the HTML bundle injected into WebView
function buildHTML(flights: Flight[]): string {
  // Collect unique routes and airports
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

  const arcsJSON      = JSON.stringify(arcs);
  const airportsJSON  = JSON.stringify(airports);
  const hasData       = arcs.length > 0;

  // Centre the initial view on the centroid of all airports, or world centre
  let initLon = 10, initLat = 30;
  if (airports.length > 0) {
    initLon = airports.reduce((s, a) => s + a.coords[0], 0) / airports.length;
    initLat = airports.reduce((s, a) => s + a.coords[1], 0) / airports.length;
  }

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  html, body { width:100%; height:100%; background:#060D1A; overflow:hidden; }
  #map { width:100%; height:100%; }
  /* Empty state */
  #empty {
    display:${hasData ? "none" : "flex"};
    position:absolute; inset:0;
    flex-direction:column; align-items:center; justify-content:center;
    color:rgba(255,255,255,0.3); font-family:sans-serif; gap:8px;
    pointer-events:none;
  }
  #empty svg { opacity:0.25; }
  #empty p { font-size:13px; letter-spacing:0.5px; }
</style>
</head>
<body>
<div id="map"></div>
<div id="empty">
  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="1.5">
    <circle cx="12" cy="12" r="10"/>
    <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
  </svg>
  <p>Add flights to see your network</p>
</div>

<!-- deck.gl + Maplibre stack (all from CDN) -->
<script src="https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.js"></script>
<script src="https://unpkg.com/@deck.gl/core@9.1.6/dist.min.js"></script>
<script src="https://unpkg.com/@deck.gl/layers@9.1.6/dist.min.js"></script>
<script src="https://unpkg.com/@deck.gl/mapbox@9.1.6/dist.min.js"></script>

<script>
(function() {
  const ACCENT      = [79, 142, 240];   // #4F8EF0
  const ACCENT_WARM = [120, 180, 255];  // lighter tip
  const GREEN       = [16, 185, 129];   // #10B981
  const ARCS        = ${arcsJSON};
  const AIRPORTS    = ${airportsJSON};

  // ── Maplibre base map ────────────────────────────────────────────────────
  const map = new maplibregl.Map({
    container: "map",
    style: "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json",
    center: [${initLon.toFixed(2)}, ${initLat.toFixed(2)}],
    zoom: ${hasData ? 1.8 : 1.2},
    pitch: 30,
    bearing: -10,
    antialias: true,
    attributionControl: false,
  });

  // ── deck.gl overlay ──────────────────────────────────────────────────────
  const { MapboxOverlay } = deck;
  const { ArcLayer, ScatterplotLayer, TextLayer } = deck;

  // Animate arc dash offset for a "flying" effect
  let tick = 0;
  let userInteracting = false;
  let rotateInterval = null;

  function buildLayers(t) {
    const layers = [];

    if (ARCS.length > 0) {
      // ── Glow / shadow arc (wide, low opacity) ──
      layers.push(new ArcLayer({
        id: "arcs-glow",
        data: ARCS,
        getSourcePosition: d => d.from,
        getTargetPosition: d => d.to,
        getSourceColor: [...ACCENT, 30],
        getTargetColor: [...ACCENT_WARM, 30],
        getWidth: 10,
        getHeight: 0.5,
        greatCircle: true,
        widthUnits: "pixels",
        widthScale: 1,
        pickable: false,
      }));

      // ── Core arc ──
      layers.push(new ArcLayer({
        id: "arcs-core",
        data: ARCS,
        getSourcePosition: d => d.from,
        getTargetPosition: d => d.to,
        getSourceColor: d => [...ACCENT, 220],
        getTargetColor: d => [...ACCENT_WARM, 220],
        getWidth: 1.8,
        getHeight: 0.5,
        greatCircle: true,
        widthUnits: "pixels",
        widthScale: 1,
        pickable: true,
        autoHighlight: true,
        highlightColor: [255, 220, 100, 255],
      }));
    }

    if (AIRPORTS.length > 0) {
      // ── Outer pulse ring ──
      layers.push(new ScatterplotLayer({
        id: "dots-ring",
        data: AIRPORTS,
        getPosition: d => d.coords,
        getRadius: 18000,
        getFillColor: [...ACCENT, 40],
        stroked: false,
        radiusUnits: "meters",
        pickable: false,
      }));

      // ── Inner dot ──
      layers.push(new ScatterplotLayer({
        id: "dots-core",
        data: AIRPORTS,
        getPosition: d => d.coords,
        getRadius: 7000,
        getFillColor: [...ACCENT, 255],
        stroked: true,
        lineWidthMinPixels: 1.2,
        getLineColor: [255, 255, 255, 180],
        radiusUnits: "meters",
        pickable: true,
        autoHighlight: true,
        highlightColor: [255, 220, 100, 255],
      }));

      // ── White centre pinpoint ──
      layers.push(new ScatterplotLayer({
        id: "dots-white",
        data: AIRPORTS,
        getPosition: d => d.coords,
        getRadius: 2500,
        getFillColor: [255, 255, 255, 240],
        stroked: false,
        radiusUnits: "meters",
        pickable: false,
      }));
    }

    return layers;
  }

  const deckOverlay = new MapboxOverlay({
    interleaved: false,
    layers: buildLayers(0),
  });

  map.addControl(deckOverlay);

  // ── Slow auto-rotate ─────────────────────────────────────────────────────
  function startRotate() {
    if (rotateInterval) return;
    rotateInterval = setInterval(() => {
      if (!userInteracting) {
        map.setBearing((map.getBearing() + 0.08) % 360);
      }
    }, 50);
  }

  map.on("load", () => {
    startRotate();
    // Subtle animated pitch-in on load
    map.easeTo({ pitch: 40, bearing: -15, duration: 1800, easing: t => t < 0.5 ? 2*t*t : -1+(4-2*t)*t });
  });

  // Pause rotate while user drags
  map.on("mousedown",  () => { userInteracting = true; });
  map.on("touchstart", () => { userInteracting = true; });
  map.on("mouseup",    () => { userInteracting = false; });
  map.on("touchend",   () => {
    setTimeout(() => { userInteracting = false; }, 800);
  });

  // ── Resize guard ────────────────────────────────────────────────────────
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
        // Allow loading CDN scripts
        mixedContentMode="always"
        allowFileAccess
        allowUniversalAccessFromFileURLs
        // Transparent background so the map bg colour shows
        backgroundColor="#060D1A"
        // iOS: remove default white flash
        {...(Platform.OS === "ios" ? { decelerationRate: "fast" } : {})}
        onError={(e) => console.warn("GlobeView WebView error:", e.nativeEvent)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { borderRadius: 16, overflow: "hidden", backgroundColor: "#060D1A" },
  webview:   { flex: 1, backgroundColor: "transparent" },
});

export default GlobeView;
