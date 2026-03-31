/**
<<<<<<< HEAD
 * GlobeView — interactive 3D SVG globe with orthographic projection.
 *
 * Performance architecture
 * ─────────────────────────
 * PanResponder (JS) → mutable refs → requestAnimationFrame gate → setState
 * One rAF per gesture move; stale frames are cancelled so we never queue
 * more than one re-render per display frame (~16 ms).
 *
 * Additional savings
 * ──────────────────
 * • Arc 3D unit-sphere points pre-cached at flight-list change time.
 * • Arc steps reduced 64 → 32.
 *
 * Overflow / clipping
 * ───────────────────
 * compact (no sizeProp) — overflow:hidden + borderRadius clips to circle.
 * full-screen (sizeProp set) — overflow:visible; caller controls canvas
 *   size and passes rBase so the sphere fits the viewport exactly.
=======
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
>>>>>>> main
 */
import React, { useRef, useMemo, useCallback } from "react";
import {
  View,
  Text,
  Dimensions,
  PanResponder,
} from "react-native";
import Svg, {
  Circle,
  Path,
  G,
  Defs,
  RadialGradient,
  Stop,
  ClipPath,
} from "react-native-svg";
import { useColors } from "@/constants/colors";
import { Flight } from "@/context/flights";

<<<<<<< HEAD
// ─── World data ────────────────────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-require-imports
const worldTopo = require("world-atlas/countries-110m.json") as TopoJSON;

interface TopoJSON {
  type: string;
  objects: Record<string, TopoObject>;
  arcs: number[][][];
  transform?: { scale: [number, number]; translate: [number, number] };
}
interface TopoObject   { type: string; geometries: TopoGeometry[]; }
interface TopoGeometry { type: string; arcs: ArcIndex; id?: number; properties?: Record<string, unknown>; }
type ArcIndex = number | number[] | number[][] | number[][][];

function decodeArcs(topo: TopoJSON): [number, number][][] {
  const { arcs, transform } = topo;
  const scale  = transform?.scale    ?? [1, 1];
  const transl = transform?.translate ?? [0, 0];
  return arcs.map((arc) => {
    let x = 0, y = 0;
    return arc.map(([dx, dy]) => { x += dx; y += dy; return [x * scale[0] + transl[0], y * scale[1] + transl[1]] as [number, number]; });
  });
}
function stitchRing(idx: number[], dec: [number, number][][]): [number, number][] {
  const pts: [number, number][] = [];
  for (const i of idx) { const a = i < 0 ? [...dec[~i]].reverse() : dec[i]; pts.push(...a.slice(0, -1)); }
  return pts;
}
function extractCountryRings(topo: TopoJSON): [number, number][][][] {
  const dec = decodeArcs(topo);
  const obj = topo.objects["countries"] ?? topo.objects[Object.keys(topo.objects)[0]];
  const out: [number, number][][][] = [];
  for (const g of obj.geometries) {
    if (g.type === "Polygon")           { out.push((g.arcs as number[][]).map(r => stitchRing(r, dec))); }
    else if (g.type === "MultiPolygon") { for (const p of (g.arcs as number[][][])) out.push(p.map(r => stitchRing(r, dec))); }
=======
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
>>>>>>> main
  }
  return out;
}
const COUNTRY_POLYGONS = extractCountryRings(worldTopo);

<<<<<<< HEAD
// ─── Default (compact card) size ─────────────────────────────────────────────────────────
const { width: SCREEN_W } = Dimensions.get("window");
const DEFAULT_SIZE = Math.min(SCREEN_W - 40, 360);

// ─── Airport registry [lon, lat] ──────────────────────────────────────────────
=======
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
>>>>>>> main
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
  DUS:[6.77,51.28],HAM:[9.99,53.63],NCE:[7.21,43.66],
  EDI:[-3.37,55.95],MAN:[-2.27,53.35],DUB:[-6.27,53.42],
  KEF:[-22.62,63.99],TLV:[34.88,32.00],CAI:[31.41,30.12],
  CMN:[-7.59,33.37],NBO:[36.93,-1.32],JNB:[28.24,-26.13],
  ACC:[-0.17,5.60],ADD:[38.80,8.98],PEK:[116.58,40.08],
  PVG:[121.80,31.14],CAN:[113.30,23.39],KUL:[101.71,2.74],
  CGK:[106.65,-6.13],MNL:[121.02,14.51],BNE:[153.12,-27.38],
  MEL:[144.84,-37.67],AKL:[174.79,-37.01],SCL:[-70.79,-33.39],
  BOG:[-74.14,4.70],LIM:[-77.11,-12.02],EZE:[-58.54,-34.82],
  GIG:[-43.25,-22.81],YVR:[-123.18,49.19],YUL:[-73.74,45.47],
  CUN:[-86.87,21.04],PMI:[2.74,39.55],TFS:[-16.57,28.04],
  LPA:[-15.39,27.93],RAK:[-8.04,31.61],
};

// ─── Math ──────────────────────────────────────────────────────────────────────
const D2R = Math.PI / 180;

function geoToXyz(lon: number, lat: number, rotLon: number, rotLat: number): [number, number, number] {
  const lam = (lon + rotLon) * D2R, phi = lat * D2R;
  const x = Math.cos(phi) * Math.cos(lam);
  const y = Math.cos(phi) * Math.sin(lam);
  const z = Math.sin(phi);
  const cosT = Math.cos(rotLat * D2R), sinT = Math.sin(rotLat * D2R);
  return [x, y * cosT - z * sinT, y * sinT + z * cosT];
}

<<<<<<< HEAD
function pts3dToPath(pts: [number, number, number][], CX: number, CY: number, r: number): string {
  let d = "", pen = false;
  for (const [x, y, z] of pts) {
    if (y > 0) {
      const px = (CX - x * r).toFixed(1), pz = (CY - z * r).toFixed(1);
      d += pen ? `L${px},${pz}` : `M${px},${pz}`;
      pen = true;
    } else { pen = false; }
  }
  return d;
}

function precomputeArc(from: [number, number], to: [number, number], steps = 32): [number, number, number][] {
  const pts: [number, number, number][] = [];
  const [x1, y1, z1] = [Math.cos(from[1]*D2R)*Math.cos(from[0]*D2R), Math.cos(from[1]*D2R)*Math.sin(from[0]*D2R), Math.sin(from[1]*D2R)];
  const [x2, y2, z2] = [Math.cos(to[1]*D2R)*Math.cos(to[0]*D2R),   Math.cos(to[1]*D2R)*Math.sin(to[0]*D2R),   Math.sin(to[1]*D2R)];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const bx = x1+(x2-x1)*t, by = y1+(y2-y1)*t, bz = z1+(z2-z1)*t;
    const len = Math.sqrt(bx*bx+by*by+bz*bz);
    pts.push([bx/len, by/len, bz/len]);
  }
  return pts;
}

function rotateArcPts(pts: [number, number, number][], rotLon: number, rotLat: number): [number, number, number][] {
  const lamOff = rotLon * D2R, cosT = Math.cos(rotLat * D2R), sinT = Math.sin(rotLat * D2R);
  return pts.map(([x, y, z]) => {
    const cosL = Math.cos(lamOff), sinL = Math.sin(lamOff);
    const rx = x * cosL - y * sinL;
    const ry = x * sinL + y * cosL;
    const rz = z;
    return [rx, ry * cosT - rz * sinT, ry * sinT + rz * cosT] as [number, number, number];
  });
}

function ringToPath(ring: [number, number][], rotLon: number, rotLat: number, CX: number, CY: number, r: number): string {
  let d = "", pen = false;
  for (const [lon, lat] of ring) {
    const [x, y, z] = geoToXyz(lon, lat, rotLon, rotLat);
    if (y > 0) {
      const px = (CX - x * r).toFixed(1), pz = (CY - z * r).toFixed(1);
      d += pen ? `L${px},${pz}` : `M${px},${pz}`;
      pen = true;
    } else { pen = false; }
  }
  return d;
}

function graticulePaths(rotLon: number, rotLat: number, CX: number, CY: number, r: number): string[] {
  const out: string[] = []; const steps = 48;
  for (const lat of [-60, -30, 0, 30, 60]) {
    let d = "", pen = false;
    for (let i = 0; i <= steps; i++) {
      const [x, y, z] = geoToXyz(-180 + (360/steps)*i, lat, rotLon, rotLat);
      if (y > 0) { d += pen ? `L${(CX-x*r).toFixed(1)},${(CY-z*r).toFixed(1)}` : `M${(CX-x*r).toFixed(1)},${(CY-z*r).toFixed(1)}`; pen = true; } else pen = false;
    }
    if (d) out.push(d);
  }
  for (let lon = -180; lon < 180; lon += 30) {
    let d = "", pen = false;
    for (let i = 0; i <= steps; i++) {
      const [x, y, z] = geoToXyz(lon, -90+(180/steps)*i, rotLon, rotLat);
      if (y > 0) { d += pen ? `L${(CX-x*r).toFixed(1)},${(CY-z*r).toFixed(1)}` : `M${(CX-x*r).toFixed(1)},${(CY-z*r).toFixed(1)}`; pen = true; } else pen = false;
    }
    if (d) out.push(d);
  }
  return out;
}

function pinchDist(t: { pageX: number; pageY: number }[]): number {
  const dx = t[0].pageX - t[1].pageX, dy = t[0].pageY - t[1].pageY;
  return Math.sqrt(dx*dx + dy*dy);
}

// ─── Props ────────────────────────────────────────────────────────────────────
interface Props {
  flights: Flight[];
  /** Canvas side-length in px. Defaults to compact home-preview size. */
  size?: number;
  /** Override the default R_BASE (SIZE * 0.44). Used by the full-screen
   *  view to set the initial sphere radius to exactly half the screen. */
  rBase?: number;
  onDragStart?: () => void;
  onDragEnd?: () => void;
  fullScreen?: boolean;
}

// ─── Component ────────────────────────────────────────────────────────────────
export function GlobeView({ flights, size: sizeProp, rBase: rBaseProp, onDragStart, onDragEnd }: Props) {
  const SIZE    = sizeProp ?? DEFAULT_SIZE;
  const CX      = SIZE / 2;
  const CY      = SIZE / 2;
  const R_BASE  = rBaseProp ?? SIZE * 0.44;
  const R_MIN   = R_BASE * 0.6;
  const R_MAX   = R_BASE * 4;

  const isFullScreen = sizeProp !== undefined;

  const C = useColors();
  const isDark = C.bg === "#0A0A0F" || C.bg.startsWith("#0");

  // ─── Render state — one update per animation frame ────────────────────
  const [renderState, setRenderState] = React.useState({ lon: 10, lat: 20, radius: R_BASE });
  const lonRef    = useRef(10);
  const latRef    = useRef(20);
  const radiusRef = useRef(R_BASE);
  const rafRef    = useRef<number | null>(null);

  const scheduleRender = useCallback(() => {
    if (rafRef.current !== null) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      setRenderState({ lon: lonRef.current, lat: latRef.current, radius: radiusRef.current });
    });
  }, []);

  const lastPage      = useRef<{ x: number; y: number } | null>(null);
  const pinchStartRef = useRef<{ dist: number; r: number } | null>(null);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponderCapture: () => true,
      onMoveShouldSetPanResponderCapture:  () => true,
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder:  () => true,

      onPanResponderGrant: (evt) => {
        if (rafRef.current !== null) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
        const touches = evt.nativeEvent.touches;
        if (touches.length >= 2) {
          pinchStartRef.current = { dist: pinchDist(touches as unknown as { pageX: number; pageY: number }[]), r: radiusRef.current };
          lastPage.current = null;
        } else {
          lastPage.current = { x: evt.nativeEvent.pageX, y: evt.nativeEvent.pageY };
          pinchStartRef.current = null;
        }
        onDragStart?.();
      },

      onPanResponderMove: (evt) => {
        const touches = evt.nativeEvent.touches;
        if (touches.length >= 2) {
          if (!pinchStartRef.current) {
            pinchStartRef.current = { dist: pinchDist(touches as unknown as { pageX: number; pageY: number }[]), r: radiusRef.current };
          }
          const scale = pinchDist(touches as unknown as { pageX: number; pageY: number }[]) / pinchStartRef.current.dist;
          radiusRef.current = Math.max(R_MIN, Math.min(R_MAX, pinchStartRef.current.r * scale));
          lastPage.current  = null;
        } else {
          pinchStartRef.current = null;
          if (!lastPage.current) { lastPage.current = { x: evt.nativeEvent.pageX, y: evt.nativeEvent.pageY }; return; }
          const dx = evt.nativeEvent.pageX - lastPage.current.x;
          const dy = evt.nativeEvent.pageY - lastPage.current.y;
          lonRef.current = lonRef.current + dx * 0.5;
          latRef.current = Math.max(-60, Math.min(60, latRef.current - dy * 0.4));
          lastPage.current = { x: evt.nativeEvent.pageX, y: evt.nativeEvent.pageY };
        }
        scheduleRender();
      },

      onPanResponderRelease: () => {
        lastPage.current = null; pinchStartRef.current = null;
        onDragEnd?.();
      },
      onPanResponderTerminate: () => {
        lastPage.current = null; pinchStartRef.current = null;
        onDragEnd?.();
      },
    })
  ).current;

  // ─── Pre-compute arc 3D points (only when flights change) ─────────────
  const arcPts3d = useMemo(() => {
    const seen = new Set<string>();
    const out: { pts: [number, number, number][] }[] = [];
    for (const f of flights) {
      const fc = AIRPORTS[f.departureAirport], tc = AIRPORTS[f.arrivalAirport];
      if (!fc || !tc) continue;
      const key = [f.departureAirport, f.arrivalAirport].sort().join("-");
      if (!seen.has(key)) { seen.add(key); out.push({ pts: precomputeArc(fc, tc, 32) }); }
    }
    return out;
=======
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
>>>>>>> main
  }, [flights]);

  const airportList = useMemo(() => {
    const set = new Set<string>();
    for (const f of flights) { if (AIRPORTS[f.departureAirport]) set.add(f.departureAirport); if (AIRPORTS[f.arrivalAirport]) set.add(f.arrivalAirport); }
    return Array.from(set).map(k => ({ iata: k, coords: AIRPORTS[k] }));
  }, [flights]);

  const { lon: renderLon, lat: renderLat, radius } = renderState;

  const countryPaths = useMemo(() =>
    COUNTRY_POLYGONS
      .map((poly, pi) => { const d = ringToPath(poly[0], renderLon, renderLat, CX, CY, radius); return d ? { key: `c${pi}`, d } : null; })
      .filter(Boolean) as { key: string; d: string }[],
    [renderLon, renderLat, radius, CX, CY] // eslint-disable-line react-hooks/exhaustive-deps
  );

  const arcPaths = useMemo(() =>
    arcPts3d.map(({ pts }) => pts3dToPath(rotateArcPts(pts, renderLon, renderLat), CX, CY, radius)),
    [arcPts3d, renderLon, renderLat, radius, CX, CY] // eslint-disable-line react-hooks/exhaustive-deps
  );

  const graticuleLines = useMemo(() =>
    graticulePaths(renderLon, renderLat, CX, CY, radius),
    [renderLon, renderLat, radius, CX, CY] // eslint-disable-line react-hooks/exhaustive-deps
  );

  const dotPositions = useMemo(() =>
    airportList.map(ap => {
      const [x, y, z] = geoToXyz(ap.coords[0], ap.coords[1], renderLon, renderLat);
      return { iata: ap.iata, px: CX - x * radius, pz: CY - z * radius, vis: y > 0 };
    }),
    [airportList, renderLon, renderLat, radius, CX, CY] // eslint-disable-line react-hooks/exhaustive-deps
  );

  const hasFlights = arcPts3d.length > 0;

  const arcGlowW = Math.max(4,  8   * (R_BASE / radius));
  const arcCoreW = Math.max(1,  1.8 * (R_BASE / radius));
  const dotRGlow = Math.max(4,  8   * (R_BASE / radius));
  const dotRCore = Math.max(2,  4   * (R_BASE / radius));

  const sphereDeep = isDark ? "#0D1B3E" : "#D6E8FF";
  const sphereMid  = isDark ? "#0F2654" : "#EAF3FF";
  const sphereEdge = isDark ? "#061228" : "#B8D4F8";
  const gridColor  = isDark ? "rgba(120,160,255,0.10)" : "rgba(79,142,240,0.10)";
  const landFill   = isDark ? "#1C3566" : "#B8D0F0";
  const landStroke = isDark ? "#2A4A80" : "#8AB0D8";

  return (
<<<<<<< HEAD
    <View style={{ alignItems: "center", paddingVertical: sizeProp ? 0 : 4 }}>
      <View
        style={{
          width: SIZE,
          height: SIZE,
          alignItems: "center",
          justifyContent: "center",
          ...(isFullScreen
            ? { overflow: "visible" }
            : {
                overflow: "hidden",
                borderRadius: SIZE / 2 + 8,
                shadowColor: C.accent,
                shadowOffset: { width: 0, height: 8 },
                shadowOpacity: 0.22,
                shadowRadius: 24,
                elevation: 10,
              }
          ),
        }}
        {...panResponder.panHandlers}
      >
        <Svg width={SIZE} height={SIZE} style={{ overflow: "visible" }}>
          <Defs>
            <RadialGradient id="sphereGrad" cx="38%" cy="32%" r="68%" fx="38%" fy="32%">
              <Stop offset="0%"   stopColor={sphereMid}  stopOpacity="1" />
              <Stop offset="60%"  stopColor={sphereDeep} stopOpacity="1" />
              <Stop offset="100%" stopColor={sphereEdge} stopOpacity="1" />
            </RadialGradient>
            <RadialGradient id="atmosGrad" cx="50%" cy="50%" r="50%" fx="50%" fy="50%">
              <Stop offset="72%"  stopColor="transparent" stopOpacity="0" />
              <Stop offset="88%"  stopColor={isDark ? "#2A5BA8" : "#4F8EF0"} stopOpacity={isDark ? "0.18" : "0.14"} />
              <Stop offset="100%" stopColor={isDark ? "#1E3A7A" : "#4F8EF0"} stopOpacity={isDark ? "0.28" : "0.20"} />
            </RadialGradient>
            <RadialGradient id="specular" cx="35%" cy="28%" r="32%">
              <Stop offset="0%"   stopColor="#FFFFFF" stopOpacity={isDark ? "0.10" : "0.22"} />
              <Stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
            </RadialGradient>
            <ClipPath id="globeClip"><Circle cx={CX} cy={CY} r={radius} /></ClipPath>
          </Defs>

          <Circle cx={CX} cy={CY} r={radius} fill="url(#sphereGrad)" />

          <G clipPath="url(#globeClip)">
            {graticuleLines.map((d, i) => <Path key={`g${i}`} d={d} stroke={gridColor} strokeWidth={0.7} fill="none" />)}
          </G>
          <G clipPath="url(#globeClip)">
            {countryPaths.map(({ key, d }) => <Path key={key} d={d} fill={landFill} stroke={landStroke} strokeWidth={0.5} strokeLinejoin="round" />)}
          </G>
          <G clipPath="url(#globeClip)">
            {arcPaths.map((d, i) => d ? <Path key={`ag${i}`} d={d} stroke={C.accentGlow} strokeWidth={arcGlowW} fill="none" strokeLinecap="round" /> : null)}
          </G>
          <G clipPath="url(#globeClip)">
            {arcPaths.map((d, i) => d ? <Path key={`ac${i}`} d={d} stroke={C.accent} strokeWidth={arcCoreW} fill="none" strokeLinecap="round" opacity={0.92} /> : null)}
          </G>
          <G clipPath="url(#globeClip)">
            {dotPositions.filter(d => d.vis).map(d => <Circle key={`r${d.iata}`} cx={d.px} cy={d.pz} r={dotRGlow} fill={C.accentDim} />)}
          </G>
          <G clipPath="url(#globeClip)">
            {dotPositions.filter(d => d.vis).map(d => <Circle key={`f${d.iata}`} cx={d.px} cy={d.pz} r={dotRCore} fill={C.accent} stroke="#FFFFFF" strokeWidth={1.2} />)}
          </G>

          <Circle cx={CX} cy={CY} r={radius} fill="url(#atmosGrad)" />
          <Circle cx={CX} cy={CY} r={radius} fill="url(#specular)" clipPath="url(#globeClip)" />
          <Circle cx={CX} cy={CY} r={radius} fill="none"
            stroke={isDark ? "rgba(79,142,240,0.18)" : "rgba(79,142,240,0.20)"}
            strokeWidth={1.5}
          />

          {!hasFlights && (
            <Path d={`M${CX},${CY-18} l4,8 l8,1 l-6,6 l2,9 l-8,-4 l-8,4 l2,-9 l-6,-6 l8,-1 z`} fill={C.textMuted} opacity={0.35} />
          )}
        </Svg>

        {!hasFlights && (
          <View style={{ position: "absolute", bottom: SIZE * 0.12, left: 0, right: 0, alignItems: "center" }} pointerEvents="none">
            <Text style={{ fontSize: 12, fontFamily: "DMSans_500Medium", letterSpacing: 0.3, color: C.textMuted }}>Add flights to see your network</Text>
          </View>
        )}
      </View>
=======
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
>>>>>>> main
    </View>
  );
}

<<<<<<< HEAD
=======
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

>>>>>>> main
export default GlobeView;
