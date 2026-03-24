/**
 * GlobeView — deck.gl ArcLayer map with Apple Maps-style light basemap.
 *
 * Requirements:
 *   npx expo install react-native-webview
 *   npx expo install @react-native-community/netinfo
 *
 * Basemap: Carto Voyager (light, coloured roads, cyan water — closest free
 *          equivalent to Apple Maps). Arc & dot colours tuned for light bg.
 *
 * Offline fallback: when there is no network connection the CDN-hosted
 * maplibre-gl / deck.gl / Carto tile-style cannot load.  Instead we render
 * a lightweight SVG canvas that plots airport dots and approximate
 * great-circle arcs using only the local AIRPORTS registry.
 */
import React, { useRef, useMemo, useEffect, useState } from "react";
import {
  View,
  StyleSheet,
  Dimensions,
  Platform,
  Text,
  Svg,
  // SVG primitives come from react-native-svg, imported below
} from "react-native";
import { WebView } from "react-native-webview";
import { Flight } from "@/context/flights";

// react-native-svg is bundled with Expo – no extra install needed.
import Svg2, { Circle, Line, Polyline, G, Text as SvgText } from "react-native-svg";

// @react-native-community/netinfo ships with Expo SDK 50+
import NetInfo from "@react-native-community/netinfo";

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

// ─── Offline SVG fallback ─────────────────────────────────────────────────────
// Simple equirectangular projection: lon → x, lat → y
const PADDING = 20;
const LON_MIN = -180, LON_MAX = 180;
const LAT_MIN = -75,  LAT_MAX = 85;

function project(lon: number, lat: number): [number, number] {
  const x = PADDING + ((lon - LON_MIN) / (LON_MAX - LON_MIN)) * (MAP_W - PADDING * 2);
  const y = PADDING + ((LAT_MAX - lat) / (LAT_MAX - LAT_MIN)) * (MAP_H - PADDING * 2);
  return [x, y];
}

/**
 * Approximate a great-circle arc with N intermediate screen points so the
 * polyline curves naturally across the flat projection.
 */
function greatCirclePoints(
  from: [number, number],
  to: [number, number],
  steps = 30
): string {
  const [lon1, lat1] = from.map((d) => (d * Math.PI) / 180);
  const [lon2, lat2] = to.map((d) => (d * Math.PI) / 180);
  const points: string[] = [];

  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    // Linear slerp in spherical coords (simplified — good enough for visuals)
    const lat = lat1 + (lat2 - lat1) * t;
    const lon = lon1 + (lon2 - lon1) * t;
    const [x, y] = project(
      (lon * 180) / Math.PI,
      (lat * 180) / Math.PI
    );
    points.push(`${x.toFixed(1)},${y.toFixed(1)}`);
  }
  return points.join(" ");
}

interface OfflineFallbackProps {
  flights: Flight[];
}

function OfflineFallback({ flights }: OfflineFallbackProps) {
  const { arcs, airports } = useMemo(() => {
    const seenRoutes = new Set<string>();
    const arcList: { from: [number, number]; to: [number, number] }[] = [];
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
      arcList.push({ from: fc, to: tc });
    }

    const airportList = Array.from(airportSet)
      .filter((k) => AIRPORTS[k])
      .map((k) => ({ iata: k, coords: AIRPORTS[k] }));

    return { arcs: arcList, airports: airportList };
  }, [flights]);

  return (
    <View style={styles.fallbackContainer}>
      {/* Offline banner */}
      <View style={styles.offlineBanner}>
        <Text style={styles.offlineBannerText}>✈︎  Offline — showing cached routes</Text>
      </View>

      {/* SVG canvas */}
      <Svg2 width={MAP_W} height={MAP_H} style={styles.svg}>
        {/* World outline rectangles as a minimal basemap hint */}
        {/* Faint grid lines */}
        {[-60, -30, 0, 30, 60].map((lat) => {
          const [, y] = project(0, lat);
          return (
            <Line
              key={`lat-${lat}`}
              x1={PADDING}
              y1={y}
              x2={MAP_W - PADDING}
              y2={y}
              stroke="#C8D4E0"
              strokeWidth={0.5}
              strokeDasharray="4 4"
            />
          );
        })}
        {[-120, -60, 0, 60, 120].map((lon) => {
          const [x] = project(lon, 0);
          return (
            <Line
              key={`lon-${lon}`}
              x1={x}
              y1={PADDING}
              x2={x}
              y2={MAP_H - PADDING}
              stroke="#C8D4E0"
              strokeWidth={0.5}
              strokeDasharray="4 4"
            />
          );
        })}

        {/* Arc glow */}
        {arcs.map((arc, i) => (
          <Polyline
            key={`glow-${i}`}
            points={greatCirclePoints(arc.from, arc.to)}
            fill="none"
            stroke="rgba(79,142,240,0.18)"
            strokeWidth={8}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ))}

        {/* Arc core */}
        {arcs.map((arc, i) => (
          <Polyline
            key={`arc-${i}`}
            points={greatCirclePoints(arc.from, arc.to)}
            fill="none"
            stroke="#4F8EF0"
            strokeWidth={1.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity={0.9}
          />
        ))}

        {/* Airport dots — outer ring */}
        {airports.map((ap) => {
          const [x, y] = project(ap.coords[0], ap.coords[1]);
          return (
            <Circle
              key={`ring-${ap.iata}`}
              cx={x}
              cy={y}
              r={6}
              fill="rgba(79,142,240,0.22)"
            />
          );
        })}

        {/* Airport dots — solid fill with white border */}
        {airports.map((ap) => {
          const [x, y] = project(ap.coords[0], ap.coords[1]);
          return (
            <Circle
              key={`dot-${ap.iata}`}
              cx={x}
              cy={y}
              r={3.5}
              fill="#1E64DC"
              stroke="white"
              strokeWidth={1.2}
            />
          );
        })}

        {/* IATA labels for small sets (≤ 12 airports) */}
        {airports.length <= 12 &&
          airports.map((ap) => {
            const [x, y] = project(ap.coords[0], ap.coords[1]);
            return (
              <SvgText
                key={`label-${ap.iata}`}
                x={x + 5}
                y={y - 5}
                fontSize={7}
                fill="#3C5078"
                fontWeight="600"
                fontFamily="-apple-system, sans-serif"
              >
                {ap.iata}
              </SvgText>
            );
          })}

        {/* Empty state */}
        {airports.length === 0 && (
          <SvgText
            x={MAP_W / 2}
            y={MAP_H / 2}
            textAnchor="middle"
            fontSize={13}
            fill="rgba(60,80,120,0.45)"
            fontFamily="-apple-system, sans-serif"
          >
            Add flights to see your network
          </SvgText>
        )}
      </Svg2>
    </View>
  );
}

// ─── buildHTML (unchanged — used when online) ─────────────────────────────────
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
const STYLE_URL = "https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json";

const map = new maplibregl.Map({
  container: "map",
  style: STYLE_URL,
  center: [${initLon.toFixed(2)}, ${initLat.toFixed(2)}],
  zoom: ${hasData ? 1.9 : 1.3},
  pitch: 0,
  bearing: 0,
  antialias: true,
  attributionControl: false,
  logoPosition: "bottom-right",
});

map.on("load", () => {

  ["water","water-shadow","waterway","waterway-shadow"].forEach(id => {
    if (map.getLayer(id)) {
      try { map.setPaintProperty(id, "fill-color", "#B8E4F4"); } catch(_){}
      try { map.setPaintProperty(id, "line-color", "#91D4EE"); } catch(_){}
    }
  });

  ["background","landcover","land"].forEach(id => {
    if (map.getLayer(id)) {
      try { map.setPaintProperty(id, "background-color", "#F5F0E8"); } catch(_){}
      try { map.setPaintProperty(id, "fill-color",       "#F5F0E8"); } catch(_){}
    }
  });

  ["landuse-park","landuse_park","park","green_areas","landuse-residential"].forEach(id => {
    if (map.getLayer(id)) {
      try { map.setPaintProperty(id, "fill-color", "#D4E8CE"); } catch(_){}
    }
  });

  map.getStyle().layers.forEach(layer => {
    if (!layer.id) return;
    const lid = layer.id.toLowerCase();
    if (lid.includes("road") || lid.includes("highway") || lid.includes("street") || lid.includes("tunnel") || lid.includes("bridge")) {
      if (layer.type === "line") {
        const color = lid.includes("motorway") || lid.includes("highway")
          ? "#E2C97E"
          : "#FFFFFF";
        try { map.setPaintProperty(layer.id, "line-color", color); } catch(_){}
      }
      if (layer.type === "fill") {
        try { map.setPaintProperty(layer.id, "fill-color", "#FFFFFF"); } catch(_){}
      }
    }
    if (lid.includes("casing") || lid.includes("outline")) {
      if (layer.type === "line") {
        try { map.setPaintProperty(layer.id, "line-color", "#D8D0C8"); } catch(_){}
      }
    }
    if (lid.includes("building")) {
      if (layer.type === "fill") {
        try { map.setPaintProperty(layer.id, "fill-color",   "#E8E0D8"); } catch(_){}
        try { map.setPaintProperty(layer.id, "fill-opacity", 0.7);       } catch(_){}
      }
    }
  });

  setTimeout(() => {
    map.easeTo({ pitch: 28, bearing: -8, duration: 1600,
      easing: t => t<0.5 ? 2*t*t : -1+(4-2*t)*t });
  }, 400);

  startRotate();
});

const { MapboxOverlay, ArcLayer, ScatterplotLayer } = deck;

function buildLayers() {
  const layers = [];

  if (ARCS.length > 0) {
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

  // ── Connectivity state ────────────────────────────────────────────────────
  const [isConnected, setIsConnected] = useState<boolean>(true);

  useEffect(() => {
    // Get initial state
    NetInfo.fetch().then((state) => {
      setIsConnected(state.isConnected ?? true);
    });

    // Subscribe to future changes
    const unsubscribe = NetInfo.addEventListener((state) => {
      setIsConnected(state.isConnected ?? true);
    });

    return unsubscribe;
  }, []);

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
          backgroundColor="#EEF2F5"
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
  container: { borderRadius: 16, overflow: "hidden", backgroundColor: "#EEF2F5" },
  webview:   { flex: 1, backgroundColor: "transparent" },
  fallbackContainer: {
    flex: 1,
    backgroundColor: "#EEF2F5",
    borderRadius: 16,
    overflow: "hidden",
  },
  offlineBanner: {
    position: "absolute",
    top: 8,
    left: 0,
    right: 0,
    zIndex: 10,
    alignItems: "center",
  },
  offlineBannerText: {
    fontSize: 11,
    color: "rgba(60,80,120,0.65)",
    fontWeight: "500",
    backgroundColor: "rgba(255,255,255,0.82)",
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 10,
    overflow: "hidden",
    letterSpacing: 0.2,
  },
  svg: {
    backgroundColor: "#EEF2F5",
  },
});

export default GlobeView;
