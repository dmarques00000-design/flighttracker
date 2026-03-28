/**
 * GlobeView — interactive 3D SVG globe with orthographic projection.
 *
 * - Pure react-native-svg + reanimated (no new installs needed)
 * - Auto-spins slowly when idle; responds to drag gestures
 * - Great-circle flight arcs clipped to the visible hemisphere
 * - Full dark/light theme via useColors()
 */
import React, { useEffect, useRef, useMemo, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
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
  Rect,
} from "react-native-svg";
import Animated, {
  useSharedValue,
  useAnimatedReaction,
  runOnJS,
  withTiming,
  cancelAnimation,
  Easing,
} from "react-native-reanimated";
import { useColors } from "@/constants/colors";
import { Flight } from "@/context/flights";

// ─── Layout ────────────────────────────────────────────────────────────────────
const { width: SCREEN_W } = Dimensions.get("window");
const SIZE = Math.min(SCREEN_W - 40, 360);
const CX   = SIZE / 2;
const CY   = SIZE / 2;
const R    = SIZE * 0.44;

// ─── Airport registry [lon, lat] ──────────────────────────────────────────────
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

// ─── Math helpers ─────────────────────────────────────────────────────────────
const D2R = Math.PI / 180;

/** Convert geographic [lon, lat] + current rotation to 3-D xyz on unit sphere */
function geoToXyz(lon: number, lat: number, rotLon: number, rotLat: number): [number, number, number] {
  const lam = (lon + rotLon) * D2R;
  const phi = lat * D2R;
  const rotPhiRad = rotLat * D2R;

  // First apply rotLon (around Z axis), then rotLat (around X axis)
  let x = Math.cos(phi) * Math.cos(lam);
  let y = Math.cos(phi) * Math.sin(lam);
  let z = Math.sin(phi);

  // Tilt around X axis by rotLat
  const cosT = Math.cos(rotPhiRad);
  const sinT = Math.sin(rotPhiRad);
  const y2 = y * cosT - z * sinT;
  const z2 = y * sinT + z * cosT;

  return [x, y2, z2];
}

/** Project 3-D xyz onto 2-D screen using orthographic projection */
function project(x: number, y: number, _z: number): [number, number] {
  return [CX + x * R, CY - _z * R];
}

/** Is the point visible (on the front hemisphere)? */
function isVisible(x: number, _y: number, _z: number): boolean {
  return _y > 0;
}

/** Interpolate great-circle path and return SVG path string, only visible segments */
function greatCirclePath(
  from: [number, number],
  to:   [number, number],
  rotLon: number,
  rotLat: number,
  steps = 64
): string {
  const pts: Array<{ x: number; z: number; vis: boolean }> = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    // Spherical interpolation (slerp) between two points
    const [x1, y1, z1] = geoToXyz(from[0], from[1], rotLon, rotLat);
    const [x2, y2, z2] = geoToXyz(to[0],   to[1],   rotLon, rotLat);
    // Linear blend then normalise
    const bx = x1 + (x2 - x1) * t;
    const by = y1 + (y2 - y1) * t;
    const bz = z1 + (z2 - z1) * t;
    const len = Math.sqrt(bx * bx + by * by + bz * bz);
    const nx = bx / len;
    const ny = by / len;
    const nz = bz / len;
    const [px, pz] = project(nx, ny, nz);
    pts.push({ x: px, z: pz, vis: ny > 0 });
  }

  // Build path string, breaking on visibility transitions
  let d = "";
  let penDown = false;
  for (const pt of pts) {
    if (pt.vis) {
      if (!penDown) { d += `M${pt.x.toFixed(1)},${pt.z.toFixed(1)}`; penDown = true; }
      else          { d += `L${pt.x.toFixed(1)},${pt.z.toFixed(1)}`; }
    } else {
      penDown = false;
    }
  }
  return d;
}

/** Graticule lines (lat/lon grid) */
function graticulePaths(rotLon: number, rotLat: number): string[] {
  const paths: string[] = [];
  const steps = 48;

  // Latitude parallels: -60, -30, 0, 30, 60
  for (const lat of [-60, -30, 0, 30, 60]) {
    let d = ""; let penDown = false;
    for (let i = 0; i <= steps; i++) {
      const lon = -180 + (360 / steps) * i;
      const [x, y, z] = geoToXyz(lon, lat, rotLon, rotLat);
      const [px, pz] = project(x, y, z);
      if (y > 0) {
        if (!penDown) { d += `M${px.toFixed(1)},${pz.toFixed(1)}`; penDown = true; }
        else          { d += `L${px.toFixed(1)},${pz.toFixed(1)}`; }
      } else { penDown = false; }
    }
    if (d) paths.push(d);
  }

  // Longitude meridians: every 30 degrees
  for (let lon = -180; lon < 180; lon += 30) {
    let d = ""; let penDown = false;
    for (let i = 0; i <= steps; i++) {
      const lat = -90 + (180 / steps) * i;
      const [x, y, z] = geoToXyz(lon, lat, rotLon, rotLat);
      const [px, pz] = project(x, y, z);
      if (y > 0) {
        if (!penDown) { d += `M${px.toFixed(1)},${pz.toFixed(1)}`; penDown = true; }
        else          { d += `L${px.toFixed(1)},${pz.toFixed(1)}`; }
      } else { penDown = false; }
    }
    if (d) paths.push(d);
  }

  return paths;
}

// ─── Component ────────────────────────────────────────────────────────────────
interface Props { flights: Flight[]; }

export function GlobeView({ flights }: Props) {
  const C = useColors();
  const isDark = C.bg === "#0A0A0F" || C.bg.startsWith("#0");

  // Rotation state (degrees)
  const rotLon = useSharedValue(10);
  const rotLat = useSharedValue(20);

  // Render-triggering state (JS side)
  const [renderLon, setRenderLon] = React.useState(10);
  const [renderLat, setRenderLat] = React.useState(20);
  const isInteracting = useRef(false);
  const spinAnim = useRef<any>(null);

  // Sync shared values to JS state for SVG re-render
  useAnimatedReaction(
    () => ({ lon: rotLon.value, lat: rotLat.value }),
    (cur) => { runOnJS(setRenderLon)(cur.lon); runOnJS(setRenderLat)(cur.lat); },
    []
  );

  // Auto-spin
  const startSpin = useCallback(() => {
    cancelAnimation(rotLon);
    // Spin ~360 degrees over 60 seconds, then loop
    const spinOnce = () => {
      spinAnim.current = withTiming(
        rotLon.value + 360,
        { duration: 60000, easing: Easing.linear },
        (finished) => { if (finished) runOnJS(startSpin)(); }
      );
      rotLon.value = spinAnim.current;
    };
    spinOnce();
  }, [rotLon]);

  const stopSpin = useCallback(() => {
    cancelAnimation(rotLon);
  }, [rotLon]);

  useEffect(() => {
    const t = setTimeout(() => startSpin(), 600);
    return () => { clearTimeout(t); stopSpin(); };
  }, [startSpin, stopSpin]);

  // Drag gesture
  const lastTouch = useRef<{ x: number; y: number } | null>(null);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder:  () => true,
      onPanResponderGrant: (evt) => {
        isInteracting.current = true;
        stopSpin();
        const { locationX, locationY } = evt.nativeEvent;
        lastTouch.current = { x: locationX, y: locationY };
      },
      onPanResponderMove: (evt) => {
        const { locationX, locationY } = evt.nativeEvent;
        if (!lastTouch.current) return;
        const dx = locationX - lastTouch.current.x;
        const dy = locationY - lastTouch.current.y;
        rotLon.value = rotLon.value + dx * 0.4;
        rotLat.value = Math.max(-60, Math.min(60, rotLat.value - dy * 0.4));
        lastTouch.current = { x: locationX, y: locationY };
      },
      onPanResponderRelease: () => {
        lastTouch.current = null;
        isInteracting.current = false;
        // Resume spin after 1.5 s of inactivity
        const t = setTimeout(() => { if (!isInteracting.current) startSpin(); }, 1500);
        return () => clearTimeout(t);
      },
      onPanResponderTerminate: () => {
        lastTouch.current = null;
        isInteracting.current = false;
        setTimeout(() => startSpin(), 1500);
      },
    })
  ).current;

  // Derive unique routes + airports from flights
  const { routes, airportList } = useMemo(() => {
    const seenRoutes = new Set<string>();
    const routeList: { from: [number, number]; to: [number, number] }[] = [];
    const airportSet = new Set<string>();

    for (const f of flights) {
      const fc = AIRPORTS[f.departureAirport];
      const tc = AIRPORTS[f.arrivalAirport];
      if (!fc || !tc) continue;
      airportSet.add(f.departureAirport);
      airportSet.add(f.arrivalAirport);
      const key = [f.departureAirport, f.arrivalAirport].sort().join("-");
      if (!seenRoutes.has(key)) {
        seenRoutes.add(key);
        routeList.push({ from: fc, to: tc });
      }
    }

    return {
      routes: routeList,
      airportList: Array.from(airportSet)
        .filter(k => AIRPORTS[k])
        .map(k => ({ iata: k, coords: AIRPORTS[k] })),
    };
  }, [flights]);

  const hasFlights = routes.length > 0;

  // Theme colours
  const sphereDeep = isDark ? "#0D1B3E" : "#D6E8FF";
  const sphereMid  = isDark ? "#0F2654" : "#EAF3FF";
  const sphereEdge = isDark ? "#061228" : "#B8D4F8";
  const gridColor  = isDark ? "rgba(120,160,255,0.12)" : "rgba(79,142,240,0.12)";
  const arcColor   = C.accent;
  const arcGlow    = C.accentGlow;
  const dotColor   = C.accent;
  const dotRing    = C.accentDim;
  const emptyColor = C.textMuted;

  // Compute arc paths
  const arcPaths = useMemo(() => {
    return routes.map(r => greatCirclePath(r.from, r.to, renderLon, renderLat));
  }, [routes, renderLon, renderLat]);

  // Compute graticule
  const graticuleLines = useMemo(() => {
    return graticulePaths(renderLon, renderLat);
  }, [renderLon, renderLat]);

  // Compute airport screen positions
  const dotPositions = useMemo(() => {
    return airportList.map(ap => {
      const [x, y, z] = geoToXyz(ap.coords[0], ap.coords[1], renderLon, renderLat);
      const [px, pz] = project(x, y, z);
      return { iata: ap.iata, px, pz, vis: y > 0 };
    });
  }, [airportList, renderLon, renderLat]);

  const S = styles(C);

  return (
    <View style={S.wrapper}>
      <View
        style={[S.container, { width: SIZE, height: SIZE }]}
        {...panResponder.panHandlers}
      >
        <Svg width={SIZE} height={SIZE}>
          <Defs>
            {/* Sphere gradient */}
            <RadialGradient
              id="sphereGrad"
              cx="38%" cy="32%" r="68%"
              fx="38%" fy="32%"
            >
              <Stop offset="0%"   stopColor={sphereMid}  stopOpacity="1" />
              <Stop offset="60%"  stopColor={sphereDeep} stopOpacity="1" />
              <Stop offset="100%" stopColor={sphereEdge} stopOpacity="1" />
            </RadialGradient>

            {/* Atmosphere highlight (limb brightening) */}
            <RadialGradient
              id="atmosGrad"
              cx="50%" cy="50%" r="50%"
              fx="50%" fy="50%"
            >
              <Stop offset="72%" stopColor="transparent"           stopOpacity="0" />
              <Stop offset="88%" stopColor={isDark ? "#2A5BA8" : "#4F8EF0"} stopOpacity={isDark ? "0.18" : "0.14"} />
              <Stop offset="100%" stopColor={isDark ? "#1E3A7A" : "#4F8EF0"} stopOpacity={isDark ? "0.28" : "0.20"} />
            </RadialGradient>

            {/* Specular highlight */}
            <RadialGradient
              id="specular"
              cx="35%" cy="28%" r="32%"
            >
              <Stop offset="0%"   stopColor="#FFFFFF" stopOpacity={isDark ? "0.10" : "0.22"} />
              <Stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
            </RadialGradient>

            {/* Clip to circle */}
            <ClipPath id="globeClip">
              <Circle cx={CX} cy={CY} r={R} />
            </ClipPath>
          </Defs>

          {/* ── Base sphere ── */}
          <Circle cx={CX} cy={CY} r={R} fill="url(#sphereGrad)" />

          {/* ── Graticule grid ── */}
          <G clipPath="url(#globeClip)">
            {graticuleLines.map((d, i) => (
              <Path key={`g${i}`} d={d} stroke={gridColor} strokeWidth={0.7} fill="none" />
            ))}
          </G>

          {/* ── Arc glow (thick, low opacity) ── */}
          <G clipPath="url(#globeClip)">
            {arcPaths.map((d, i) =>
              d ? <Path key={`ag${i}`} d={d} stroke={arcGlow} strokeWidth={8} fill="none" strokeLinecap="round" /> : null
            )}
          </G>

          {/* ── Arc core lines ── */}
          <G clipPath="url(#globeClip)">
            {arcPaths.map((d, i) =>
              d ? <Path key={`ac${i}`} d={d} stroke={arcColor} strokeWidth={1.8} fill="none" strokeLinecap="round" opacity={0.92} /> : null
            )}
          </G>

          {/* ── Airport dots — ring ── */}
          <G clipPath="url(#globeClip)">
            {dotPositions.filter(d => d.vis).map(d => (
              <Circle key={`r${d.iata}`} cx={d.px} cy={d.pz} r={8} fill={dotRing} />
            ))}
          </G>

          {/* ── Airport dots — filled ── */}
          <G clipPath="url(#globeClip)">
            {dotPositions.filter(d => d.vis).map(d => (
              <Circle key={`f${d.iata}`} cx={d.px} cy={d.pz} r={4} fill={dotColor} stroke="#FFFFFF" strokeWidth={1.2} />
            ))}
          </G>

          {/* ── Atmosphere rim ── */}
          <Circle cx={CX} cy={CY} r={R} fill="url(#atmosGrad)" />

          {/* ── Specular highlight ── */}
          <Circle cx={CX} cy={CY} r={R} fill="url(#specular)" clipPath="url(#globeClip)" />

          {/* ── Globe border ── */}
          <Circle cx={CX} cy={CY} r={R} fill="none" stroke={isDark ? "rgba(79,142,240,0.18)" : "rgba(79,142,240,0.20)"} strokeWidth={1.5} />

          {/* ── Empty state label ── */}
          {!hasFlights && (
            <G>
              <Path
                d={`M${CX},${CY - 18} l4,8 l8,1 l-6,6 l2,9 l-8,-4 l-8,4 l2,-9 l-6,-6 l8,-1 z`}
                fill={emptyColor}
                opacity={0.35}
              />
            </G>
          )}
        </Svg>

        {!hasFlights && (
          <View style={S.emptyOverlay} pointerEvents="none">
            <Text style={[S.emptyText, { color: emptyColor }]}>Add flights to see your network</Text>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = (C: ReturnType<typeof useColors>) => StyleSheet.create({
  wrapper: {
    alignItems: "center",
    paddingVertical: 4,
  },
  container: {
    borderRadius: SIZE / 2 + 8,
    overflow: "visible",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: C.accent,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.22,
    shadowRadius: 24,
    elevation: 10,
  },
  emptyOverlay: {
    position: "absolute",
    bottom: SIZE * 0.12,
    left: 0,
    right: 0,
    alignItems: "center",
  },
  emptyText: {
    fontSize: 12,
    fontFamily: "DMSans_500Medium",
    letterSpacing: 0.3,
  },
});

export default GlobeView;
