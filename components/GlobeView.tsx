import React, { useEffect, useRef, useState, useMemo } from "react";
import { View, StyleSheet, Dimensions, PanResponder } from "react-native";
import Svg, {
  Circle, Path, G, Defs, RadialGradient, Stop, ClipPath,
} from "react-native-svg";
import { Flight } from "@/context/flights";

const { width: screenWidth } = Dimensions.get("window");
const GLOBE_SIZE = Math.min(screenWidth * 0.9, 400);

// ─── Math helpers ─────────────────────────────────────────────────────────────
function latLngTo3D(lat: number, lng: number, r: number) {
  const phi   = (90 - lat)  * (Math.PI / 180);
  const theta = (lng + 180) * (Math.PI / 180);
  return {
    x: -(r * Math.sin(phi) * Math.cos(theta)),
    y:   r * Math.cos(phi),
    z:   r * Math.sin(phi) * Math.sin(theta),
  };
}

function project(x: number, y: number, z: number, rot: number) {
  const cr = Math.cos(rot), sr = Math.sin(rot);
  const depth = x * sr + z * cr;
  return { sx: x * cr - z * sr, sy: y, visible: depth > 0, depth };
}

function greatCircleAngle(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number }
): number {
  const toR = Math.PI / 180;
  const lat1 = a.lat * toR, lat2 = b.lat * toR;
  const dLng = (b.lng - a.lng) * toR;
  return Math.acos(
    Math.max(-1, Math.min(1,
      Math.sin(lat1) * Math.sin(lat2) +
      Math.cos(lat1) * Math.cos(lat2) * Math.cos(dLng)
    ))
  );
}

// ─── Airport registry ─────────────────────────────────────────────────────────
const AIRPORTS: Record<string, { lat: number; lng: number }> = {
  LIS:{lat:38.78,lng:-9.14},GVA:{lat:46.24,lng:6.11},ZRH:{lat:47.46,lng:8.55},
  ATL:{lat:33.64,lng:-84.43},MIA:{lat:25.80,lng:-80.29},JFK:{lat:40.64,lng:-73.78},
  LAX:{lat:33.94,lng:-118.41},LHR:{lat:51.47,lng:-0.45},CDG:{lat:49.01,lng:2.55},
  DXB:{lat:25.25,lng:55.37},HKG:{lat:22.31,lng:113.92},SYD:{lat:-33.94,lng:151.18},
  SIN:{lat:1.36,lng:103.99},NRT:{lat:35.77,lng:140.39},FRA:{lat:50.04,lng:8.56},
  AMS:{lat:52.31,lng:4.76},MAD:{lat:40.49,lng:-3.57},BCN:{lat:41.30,lng:2.08},
  FCO:{lat:41.80,lng:12.24},MUC:{lat:48.35,lng:11.78},ORD:{lat:41.97,lng:-87.91},
  SFO:{lat:37.62,lng:-122.38},BOS:{lat:42.37,lng:-71.01},IAD:{lat:38.95,lng:-77.46},
  EWR:{lat:40.69,lng:-74.17},BKK:{lat:13.69,lng:100.75},ICN:{lat:37.46,lng:126.44},
  DEL:{lat:28.56,lng:77.10},BOM:{lat:19.09,lng:72.87},CPT:{lat:-33.96,lng:18.60},
  GRU:{lat:-23.43,lng:-46.47},YYZ:{lat:43.68,lng:-79.63},MEX:{lat:19.43,lng:-99.07},
  DOH:{lat:25.27,lng:51.61},IST:{lat:40.98,lng:28.82},VIE:{lat:48.11,lng:16.57},
  BRU:{lat:50.90,lng:4.48},ARN:{lat:59.65,lng:17.92},CPH:{lat:55.62,lng:12.66},
  HEL:{lat:60.32,lng:24.96},OSL:{lat:60.20,lng:11.08},WAW:{lat:52.17,lng:20.97},
  PRG:{lat:50.10,lng:14.26},BUD:{lat:47.43,lng:19.26},ATH:{lat:37.94,lng:23.95},
};

function getCoord(iata: string) { return AIRPORTS[iata] ?? { lat: 0, lng: 0 }; }

// ─── Land data: continents as closed polygons (no date-line crossings) ────────
// Each polygon is fully contained within one hemisphere (lng range ≤ 180°).
// We draw ONLY the segments whose endpoints are both visible, so no
// back-face artefacts. Fill uses a separate point-filter pass.
const LAND: [number, number][][] = [
  // ── North America (contiguous) ──────────────────────────────────────────
  [
    [49,-95],[49,-100],[49,-104],[49,-110],[49,-115],[49,-123],
    [47,-124],[43,-124],[38,-123],[34,-121],[32,-117],[30,-117],
    [29,-99],[25,-97],[25,-80],[28,-81],[30,-81],[34,-78],[36,-76],
    [38,-75],[40,-74],[41,-72],[42,-70],[45,-67],[47,-68],[48,-70],
    [46,-64],[45,-61],[44,-66],[42,-70],[40,-74],[38,-75],[36,-76],
    [34,-78],[30,-85],[28,-82],[26,-80],[25,-80],[24,-84],[25,-86],
    [28,-88],[29,-92],[28,-96],[29,-99],[30,-104],[31,-109],[33,-114],
    [32,-117],[34,-121],[36,-122],[38,-123],[40,-124],[43,-124],
    [47,-124],[49,-123],[49,-95],
  ],
  // ── Alaska ───────────────────────────────────────────────────────────────
  [[71,-156],[66,-166],[59,-164],[55,-160],[57,-136],[60,-141],[71,-141],[71,-156]],
  // ── Canada east ──────────────────────────────────────────────────────────
  [
    [49,-95],[49,-86],[47,-84],[44,-77],[43,-79],[44,-76],[45,-73],
    [45,-71],[47,-68],[46,-64],[45,-61],[44,-66],[43,-66],[46,-60],
    [47,-54],[49,-56],[52,-56],[54,-60],[57,-61],[59,-64],[64,-65],
    [65,-70],[65,-75],[66,-82],[70,-84],[74,-80],[78,-76],[80,-74],
    [83,-68],[82,-58],[78,-52],[76,-52],[75,-58],[72,-64],[68,-64],
    [64,-78],[58,-84],[52,-82],[50,-78],[50,-84],[52,-92],[50,-96],
    [52,-100],[52,-96],[50,-96],[50,-90],[52,-82],[49,-86],[49,-95],
  ],
  // ── Mexico / Central America ─────────────────────────────────────────────
  [
    [29,-99],[25,-97],[18,-88],[10,-88],[8,-77],[10,-77],[12,-83],
    [15,-83],[16,-88],[15,-92],[16,-96],[18,-104],[22,-85],[24,-81],
    [25,-77],[28,-82],[30,-84],[29,-90],[29,-94],[28,-96],[29,-99],
  ],
  // ── Cuba ─────────────────────────────────────────────────────────────────
  [[23,-74],[20,-77],[20,-75],[22,-73],[23,-74]],
  // ── Hispaniola ────────────────────────────────────────────────────────────
  [[20,-72],[18,-74],[18,-71],[20,-69],[20,-72]],
  // ── Jamaica ───────────────────────────────────────────────────────────────
  [[18,-78],[17,-78],[17,-76],[18,-76],[18,-78]],
  // ── South America ────────────────────────────────────────────────────────
  [
    [12,-72],[5,-52],[0,-50],[-5,-35],[-10,-36],[-14,-38],[-18,-38],
    [-22,-42],[-24,-44],[-26,-48],[-28,-50],[-32,-52],[-34,-54],
    [-50,-60],[-52,-60],[-54,-68],[-56,-68],[-54,-64],[-42,-63],
    [-32,-52],[-28,-50],[-24,-44],[-20,-40],[-14,-38],[-8,-35],
    [-5,-35],[0,-48],[-1,-44],[-2,-38],[2,-38],[4,-52],[5,-52],
    [8,-60],[8,-52],[2,-52],[0,-50],[2,-68],[4,-68],[5,-70],[6,-72],
    [8,-72],[10,-75],[12,-70],[12,-72],
  ],
  // ── Venezuela / Guyana ────────────────────────────────────────────────────
  [
    [12,-72],[8,-72],[4,-60],[2,-52],[5,-52],[8,-60],[10,-61],[12,-64],
    [11,-66],[12,-68],[12,-72],
  ],
  // ── Bolivia / Paraguay ────────────────────────────────────────────────────
  [
    [-10,-68],[-18,-68],[-18,-58],[-20,-58],[-22,-56],[-24,-58],
    [-18,-64],[-16,-62],[-14,-60],[-12,-62],[-10,-66],[-10,-68],
  ],
  // ── Falklands ─────────────────────────────────────────────────────────────
  [[-52,-60],[-54,-64],[-54,-58],[-52,-58],[-52,-60]],
  // ── Greenland ────────────────────────────────────────────────────────────
  [[83,-28],[80,-18],[76,-18],[72,-22],[70,-26],[72,-34],[76,-46],[80,-52],[82,-44],[84,-36],[83,-28]],
  // ── Iceland ───────────────────────────────────────────────────────────────
  [[66,-14],[64,-24],[63,-18],[64,-12],[66,-10],[66,-14]],
  // ── UK & Ireland ─────────────────────────────────────────────────────────
  [[58,-4],[51,-5],[50,-4],[51,2],[53,0],[58,-4]],
  [[55,-8],[52,-10],[52,-8],[55,-6],[55,-8]],
  // ── Iberia ────────────────────────────────────────────────────────────────
  [[44,-8],[36,-8],[36,2],[43,4],[44,8],[44,-8]],
  // ── France ────────────────────────────────────────────────────────────────
  [[51,2],[50,2],[48,-2],[46,-2],[44,-1],[44,2],[43,4],[46,8],[48,8],[49,8],[50,4],[51,4],[51,2]],
  // ── Scandinavia ───────────────────────────────────────────────────────────
  [[71,28],[65,14],[63,8],[60,5],[58,6],[60,10],[65,14],[68,18],[70,22],[71,26],[71,28]],
  [[70,22],[66,14],[64,10],[60,5],[59,5],[58,8],[60,10],[62,8],[64,10],[68,16],[70,22]],
  [[69,28],[57,12],[56,14],[58,16],[60,18],[64,18],[68,22],[70,24],[69,28]],
  [[70,28],[60,26],[60,24],[64,26],[68,28],[70,28]],
  [[57,10],[55,8],[55,10],[57,12],[57,10]],
  // ── Denmark ───────────────────────────────────────────────────────────────
  [[57,10],[56,8],[55,8],[55,10],[56,12],[57,12],[57,10]],
  // ── Germany / Benelux ─────────────────────────────────────────────────────
  [[55,8],[52,6],[48,8],[48,16],[52,14],[54,14],[55,12],[55,8]],
  [[51,4],[50,4],[50,6],[51,6],[51,4]],
  [[48,8],[46,8],[46,10],[48,10],[48,8]],
  // ── Poland / Baltics ──────────────────────────────────────────────────────
  [[54,14],[52,14],[50,22],[52,24],[54,22],[54,14]],
  [[58,22],[54,22],[54,26],[56,26],[58,24],[58,22]],
  // ── Italy ─────────────────────────────────────────────────────────────────
  [[47,12],[45,8],[44,8],[42,12],[40,18],[38,16],[38,14],[44,12],[46,12],[47,14],[47,12]],
  [[41,8],[39,8],[39,10],[41,10],[41,8]],
  [[38,12],[37,14],[38,16],[38,12]],
  // ── Balkans / Greece ──────────────────────────────────────────────────────
  [[48,16],[46,16],[46,22],[48,22],[48,16]],
  [[46,14],[44,14],[42,20],[44,22],[46,20],[46,14]],
  [[42,20],[38,22],[36,22],[36,26],[38,28],[40,26],[42,26],[42,20]],
  [[35,24],[35,26],[36,26],[35,24]],
  // ── Eastern Europe / Ukraine ──────────────────────────────────────────────
  [[52,22],[48,22],[46,32],[48,38],[52,36],[52,22]],
  [[54,24],[50,24],[52,28],[54,28],[54,24]],
  // ── Finland ───────────────────────────────────────────────────────────────
  [[70,24],[68,22],[66,20],[68,20],[70,22],[70,24]],
  // ── Russia west ───────────────────────────────────────────────────────────
  [[72,32],[68,32],[66,30],[64,30],[62,30],[60,28],[58,28],[56,34],[54,36],[54,58],[56,58],[60,60],[64,60],[68,54],[72,54],[72,32]],
  // ── Russia central ────────────────────────────────────────────────────────
  [[72,54],[68,54],[64,60],[60,60],[56,60],[56,80],[60,80],[64,78],[68,74],[72,72],[72,54]],
  // ── Russia east ───────────────────────────────────────────────────────────
  [[72,72],[68,74],[64,78],[60,80],[56,80],[56,100],[60,100],[64,100],[68,100],[72,100],[72,72]],
  [[72,100],[68,100],[64,100],[60,100],[56,100],[56,120],[60,130],[64,140],[68,148],[72,140],[72,120],[72,100]],
  [[60,162],[55,158],[52,160],[54,164],[56,164],[58,162],[60,162]],
  [[68,140],[58,130],[60,130],[64,136],[68,140]],
  // ── Turkey ────────────────────────────────────────────────────────────────
  [[42,26],[38,26],[36,28],[36,36],[38,42],[40,44],[42,44],[42,26]],
  // ── Caucasus / Iran ───────────────────────────────────────────────────────
  [[42,44],[38,44],[36,44],[34,48],[26,54],[26,60],[28,62],[32,62],[36,62],[38,58],[42,44]],
  // ── Arabian Peninsula ─────────────────────────────────────────────────────
  [[30,36],[22,36],[14,42],[12,50],[18,52],[22,60],[28,50],[30,46],[30,36]],
  [[24,54],[24,56],[26,56],[28,48],[26,48],[24,50],[24,54]],
  // ── Israel / Levant ───────────────────────────────────────────────────────
  [[33,35],[30,34],[28,34],[30,36],[32,38],[33,36],[33,35]],
  // ── Kazakhstan / Central Asia ─────────────────────────────────────────────
  [[54,58],[50,52],[46,52],[46,60],[48,66],[50,72],[52,76],[54,74],[54,66],[54,58]],
  [[42,56],[40,52],[38,56],[38,60],[40,60],[42,60],[42,56]],
  // ── Pakistan / Afghanistan ────────────────────────────────────────────────
  [[38,60],[30,68],[34,70],[36,72],[38,68],[38,60]],
  [[36,72],[28,72],[24,68],[22,68],[20,70],[14,74],[8,76],[8,78],[10,80],[12,80],[16,82],[20,86],[24,88],[26,90],[28,98],[30,96],[32,78],[34,78],[36,76],[36,74],[36,72]],
  // ── Sri Lanka ─────────────────────────────────────────────────────────────
  [[10,80],[8,80],[8,82],[10,82],[10,80]],
  // ── Bangladesh / Myanmar ──────────────────────────────────────────────────
  [[28,98],[22,98],[16,98],[14,98],[16,102],[20,100],[22,100],[26,98],[28,96],[28,98]],
  // ── Indochina ─────────────────────────────────────────────────────────────
  [[20,100],[14,100],[8,100],[6,100],[6,102],[14,102],[18,102],[20,102],[20,100]],
  [[22,102],[12,108],[14,110],[16,108],[20,104],[22,104],[22,102]],
  // ── Malaysia / Borneo ─────────────────────────────────────────────────────
  [[6,100],[2,104],[4,104],[6,102],[6,100]],
  [[8,114],[2,108],[0,108],[0,116],[2,118],[4,118],[8,116],[8,114]],
  [[6,96],[-2,102],[-4,104],[-4,106],[0,106],[2,106],[4,104],[6,98],[6,96]],
  [[-6,106],[-8,108],[-8,114],[-6,112],[-6,108],[-6,106]],
  // ── Philippines ───────────────────────────────────────────────────────────
  [[18,120],[8,124],[10,126],[14,122],[16,122],[18,122],[18,120]],
  // ── China ─────────────────────────────────────────────────────────────────
  [[54,122],[48,134],[44,130],[40,128],[36,122],[26,120],[22,114],[22,108],[26,104],[28,98],[30,96],[34,80],[36,76],[38,76],[40,76],[44,80],[48,88],[50,90],[52,88],[52,96],[52,102],[54,118],[54,122]],
  [[52,88],[48,88],[44,88],[44,100],[44,108],[48,114],[52,118],[52,108],[52,100],[52,88]],
  // ── Korea ─────────────────────────────────────────────────────────────────
  [[38,126],[34,126],[34,128],[36,130],[38,130],[38,126]],
  // ── Japan ─────────────────────────────────────────────────────────────────
  [[40,140],[36,136],[34,132],[34,134],[36,138],[38,140],[40,142],[40,140]],
  [[44,142],[42,140],[42,142],[44,144],[44,142]],
  // ── Africa north ─────────────────────────────────────────────────────────
  [[36,-6],[22,-14],[22,0],[26,2],[30,2],[34,2],[36,2],[36,-2],[34,-2],[30,-8],[22,-12],[22,0],[36,-2],[36,-6]],
  [[37,8],[34,10],[32,10],[34,12],[36,12],[37,10],[37,8]],
  [[34,10],[22,10],[22,20],[24,22],[26,24],[30,24],[32,24],[34,20],[34,10]],
  [[32,24],[22,24],[22,28],[22,32],[24,36],[26,36],[30,34],[32,34],[32,28],[32,24]],
  // ── West Africa ───────────────────────────────────────────────────────────
  [[22,24],[4,28],[4,32],[8,32],[12,36],[16,38],[18,38],[22,36],[22,28],[22,24]],
  [[18,38],[8,38],[8,44],[12,44],[14,42],[16,44],[18,42],[18,38]],
  [[12,44],[2,44],[2,48],[4,46],[8,48],[10,50],[12,50],[12,44]],
  [[4,34],[-10,40],[-6,40],[0,42],[4,42],[4,36],[4,34]],
  // ── Central / East Africa ─────────────────────────────────────────────────
  [[16,0],[4,-16],[4,0],[4,8],[8,8],[12,8],[14,14],[16,12],[16,0]],
  [[4,18],[-8,22],[-8,28],[-4,32],[0,30],[4,26],[4,18]],
  [[-4,12],[-22,20],[-16,24],[-8,24],[-4,16],[-4,12]],
  [[-8,28],[-18,34],[-16,38],[-14,38],[-10,36],[-8,32],[-8,28]],
  [[-22,20],[-34,18],[-30,24],[-28,28],[-24,32],[-22,34],[-20,32],[-22,30],[-22,20]],
  // ── Madagascar ────────────────────────────────────────────────────────────
  [[-12,48],[-26,48],[-20,50],[-14,50],[-12,48]],
  // ── Australia ────────────────────────────────────────────────────────────
  [[-10,136],[-20,114],[-32,116],[-34,120],[-36,136],[-38,140],[-38,146],[-36,148],[-32,152],[-28,154],[-24,152],[-18,146],[-14,136],[-10,136]],
  [[-40,146],[-44,146],[-44,148],[-40,148],[-40,146]],
  // ── New Zealand ───────────────────────────────────────────────────────────
  [[-36,174],[-46,168],[-42,172],[-36,174]],
  [[-42,172],[-46,168],[-46,170],[-44,172],[-42,172]],
  // ── Papua New Guinea ──────────────────────────────────────────────────────
  [[-2,132],[-6,146],[-4,148],[-2,148],[0,144],[0,140],[-2,132]],
  // ── Taiwan ────────────────────────────────────────────────────────────────
  [[26,122],[22,120],[22,122],[24,122],[26,122]],
  // ── Svalbard ──────────────────────────────────────────────────────────────
  [[80,16],[76,20],[78,28],[80,28],[80,16]],
];

// ─── Component ────────────────────────────────────────────────────────────────
interface GlobeViewProps { flights: Flight[]; size?: number; }

export function GlobeView({ flights, size = GLOBE_SIZE }: GlobeViewProps) {
  const R = size / 2;
  const AUTO_SPEED = (2 * Math.PI) / (40 * 30); // full rotation every 40 s @ 30 fps

  const rotRef   = useRef(0.3);
  const velRef   = useRef(0);
  const dragging = useRef(false);
  const lastX    = useRef(0);
  const [rotation, setRotation] = useState(0.3);

  // ── Animation loop ─────────────────────────────────────────────────────────
  useEffect(() => {
    const id = setInterval(() => {
      if (dragging.current) {
        rotRef.current = (rotRef.current + velRef.current) % (2 * Math.PI);
        velRef.current *= 0.82;
      } else {
        velRef.current *= 0.90;
        rotRef.current = (rotRef.current + AUTO_SPEED + velRef.current) % (2 * Math.PI);
      }
      setRotation(rotRef.current);
    }, 1000 / 30);
    return () => clearInterval(id);
  }, []);

  // ── Pan / drag ─────────────────────────────────────────────────────────────
  const panResponder = useMemo(() =>
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder:  () => true,
      onPanResponderGrant: (_, gs) => {
        dragging.current = true;
        lastX.current = gs.x0;
        velRef.current = 0;
      },
      onPanResponderMove: (_, gs) => {
        const dx = gs.moveX - lastX.current;
        lastX.current = gs.moveX;
        const delta = (dx / R) * 0.9;
        rotRef.current = (rotRef.current + delta) % (2 * Math.PI);
        velRef.current = delta;
        setRotation(rotRef.current);
      },
      onPanResponderRelease:   () => { dragging.current = false; },
      onPanResponderTerminate: () => { dragging.current = false; },
    }),
  [R]);

  // ── Graticule (grid lines) ─────────────────────────────────────────────────
  const gridLines = useMemo(() => {
    const lines: React.ReactNode[] = [];

    const pushSeg = (seg: string[], key: string) => {
      if (seg.length > 1)
        lines.push(<Path key={key} d={`M${seg.join("L")}`} fill="none"
                         stroke="rgba(255,255,255,0.08)" strokeWidth="0.6" />);
    };

    for (const lat of [-60, -30, 0, 30, 60]) {
      let seg: string[] = [];
      for (let lng = -180; lng <= 180; lng += 3) {
        const p3 = latLngTo3D(lat, lng, R * 0.996);
        const p  = project(p3.x, p3.y, p3.z, rotation);
        if (p.visible) { seg.push(`${p.sx + R},${-p.sy + R}`); }
        else { pushSeg(seg, `la${lat}x${lng}`); seg = []; }
      }
      pushSeg(seg, `la${lat}e`);
    }
    for (const lng of [0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330]) {
      let seg: string[] = [];
      for (let lat = -90; lat <= 90; lat += 3) {
        const p3 = latLngTo3D(lat, lng, R * 0.996);
        const p  = project(p3.x, p3.y, p3.z, rotation);
        if (p.visible) { seg.push(`${p.sx + R},${-p.sy + R}`); }
        else { pushSeg(seg, `ln${lng}x${lat}`); seg = []; }
      }
      pushSeg(seg, `ln${lng}e`);
    }
    return lines;
  }, [rotation, R]);

  // ── Land: fill + border from same polygon set ─────────────────────────────
  // KEY INSIGHT: We only ever connect *consecutive* visible points.
  // When a point crosses the limb, we start a new sub-path.
  // For fills we still close the path but ONLY when the polygon is
  // substantially on the visible side (avoids cross-globe smearing).
  const { landFills, landBorders } = useMemo(() => {
    const fills:   React.ReactNode[] = [];
    const borders: React.ReactNode[] = [];

    LAND.forEach((poly, ci) => {
      // --- project all points ---
      const projected = poly.map(([lat, lng]) => {
        const p3 = latLngTo3D(lat, lng, R * 0.998);
        return project(p3.x, p3.y, p3.z, rotation);
      });

      const totalPts   = projected.length;
      const visiblePts = projected.filter(p => p.visible).length;
      const visRatio   = visiblePts / totalPts;

      // --- fill: only when >60% of polygon is on visible face ---
      if (visRatio > 0.60 && visiblePts >= 3) {
        // Build path using only visible points (skip hidden ones)
        const pts = projected
          .filter(p => p.visible)
          .map(p => `${(p.sx + R).toFixed(1)},${(-p.sy + R).toFixed(1)}`);
        if (pts.length >= 3) {
          fills.push(
            <Path
              key={`lf${ci}`}
              d={`M${pts.join("L")}Z`}
              fill="#DCCFA0"
              fillOpacity={0.88}
              stroke="none"
            />
          );
        }
      }

      // --- border: segments between consecutive visible points ---
      let seg: string[] = [];
      projected.forEach((p, i) => {
        if (p.visible) {
          seg.push(`${(p.sx + R).toFixed(1)},${(-p.sy + R).toFixed(1)}`);
        } else {
          if (seg.length > 1)
            borders.push(<Path key={`lb${ci}-${i}`} d={`M${seg.join("L")}`}
                               fill="none" stroke="rgba(164,138,80,0.55)" strokeWidth="0.65" />);
          seg = [];
        }
      });
      if (seg.length > 1)
        borders.push(<Path key={`lb${ci}-e`} d={`M${seg.join("L")}`}
                           fill="none" stroke="rgba(164,138,80,0.55)" strokeWidth="0.65" />);
    });

    return { landFills: fills, landBorders: borders };
  }, [rotation, R]);

  // ── Flight arcs ────────────────────────────────────────────────────────────
  const flightArcs = useMemo(() => {
    return flights.slice(0, 25).map((f, idx) => {
      const from = getCoord(f.departureAirport);
      const to   = getCoord(f.arrivalAirport);
      if (!from || !to) return null;

      const fp = latLngTo3D(from.lat, from.lng, R * 0.97);
      const tp = latLngTo3D(to.lat,   to.lng,   R * 0.97);
      const f2 = project(fp.x, fp.y, fp.z, rotation);
      const t2 = project(tp.x, tp.y, tp.z, rotation);
      if (!f2.visible && !t2.visible) return null;

      const angle      = greatCircleAngle(from, to);
      const liftFactor = 1.04 + (angle / Math.PI) * 0.18;

      const mid  = { x: (fp.x+tp.x)/2, y: (fp.y+tp.y)/2, z: (fp.z+tp.z)/2 };
      const dist = Math.sqrt(mid.x**2 + mid.y**2 + mid.z**2) || 1;
      const cp3  = { x: mid.x/dist*R*liftFactor, y: mid.y/dist*R*liftFactor, z: mid.z/dist*R*liftFactor };
      const c2   = project(cp3.x, cp3.y, cp3.z, rotation);

      const op = f2.visible && t2.visible ? 1 : 0.3;
      const d  = `M${f2.sx+R},${-f2.sy+R} Q${c2.sx+R},${-c2.sy+R} ${t2.sx+R},${-t2.sy+R}`;

      return (
        <G key={`arc-${idx}`}>
          <Path d={d} stroke="#4FAEFF" strokeWidth="8"  fill="none" opacity={0.06 * op} strokeLinecap="round" />
          <Path d={d} stroke="#4FAEFF" strokeWidth="1.8" fill="none" opacity={0.92 * op} strokeLinecap="round" />
        </G>
      );
    });
  }, [flights, rotation, R]);

  // ── Airport dots ───────────────────────────────────────────────────────────
  const airportDots = useMemo(() => {
    const iatas = new Set<string>();
    flights.forEach(f => { iatas.add(f.departureAirport); iatas.add(f.arrivalAirport); });
    return Array.from(iatas).slice(0, 50).flatMap(iata => {
      const coord = getCoord(iata);
      if (!coord || (coord.lat === 0 && coord.lng === 0)) return [];
      const p3 = latLngTo3D(coord.lat, coord.lng, R * 0.98);
      const p  = project(p3.x, p3.y, p3.z, rotation);
      if (!p.visible) return [];
      const cx = p.sx + R, cy = -p.sy + R;
      return [(
        <G key={`dot-${iata}`}>
          <Circle cx={cx} cy={cy} r={5.5} fill="#4FAEFF" opacity={0.16} />
          <Circle cx={cx} cy={cy} r={3}   fill="#4FAEFF" opacity={1} />
          <Circle cx={cx} cy={cy} r={1.2} fill="#FFFFFF" opacity={0.96} />
        </G>
      )];
    });
  }, [flights, rotation, R]);

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <View style={[styles.container, { width: size, height: size }]} {...panResponder.panHandlers}>
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <Defs>
          {/*
            OCEAN — Apple Maps uses a cool teal-cyan, NOT dark navy.
            Sampled from Apple Maps screenshots: ~#89CFF0 at highlight,
            ~#4F9FD5 mid, ~#2472B8 edge.
          */}
          <RadialGradient id="ocean" cx="38%" cy="32%" rx="64%" ry="64%">
            <Stop offset="0%"   stopColor="#A8DCF0" stopOpacity="1" />
            <Stop offset="35%"  stopColor="#5BAEE0" stopOpacity="1" />
            <Stop offset="70%"  stopColor="#3280C8" stopOpacity="1" />
            <Stop offset="100%" stopColor="#1A60A8" stopOpacity="1" />
          </RadialGradient>

          {/*
            SPECULAR — large soft highlight top-left, like a glass ball.
            Apple Maps globe has a very pronounced white sheen.
          */}
          <RadialGradient id="shine" cx="28%" cy="22%" rx="50%" ry="46%">
            <Stop offset="0%"   stopColor="#FFFFFF" stopOpacity="0.55" />
            <Stop offset="35%"  stopColor="#FFFFFF" stopOpacity="0.18" />
            <Stop offset="65%"  stopColor="#FFFFFF" stopOpacity="0.04" />
            <Stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
          </RadialGradient>

          {/* ATMOSPHERE — blue rim halo */}
          <RadialGradient id="atmo" cx="50%" cy="50%" rx="50%" ry="50%">
            <Stop offset="78%"  stopColor="#8EC8FF" stopOpacity="0" />
            <Stop offset="91%"  stopColor="#70AAFF" stopOpacity="0.38" />
            <Stop offset="100%" stopColor="#4480EE" stopOpacity="0.68" />
          </RadialGradient>

          {/* LIMB DARKENING — subtle edge shadow for spherical feel */}
          <RadialGradient id="limb" cx="50%" cy="50%">
            <Stop offset="0%"   stopColor="#00001A" stopOpacity="0" />
            <Stop offset="60%"  stopColor="#00001A" stopOpacity="0.03" />
            <Stop offset="88%"  stopColor="#00001A" stopOpacity="0.14" />
            <Stop offset="100%" stopColor="#00001A" stopOpacity="0.36" />
          </RadialGradient>

          {/* Clip path — keeps everything inside the circle */}
          <ClipPath id="globe-clip">
            <Circle cx={R} cy={R} r={R * 0.987} />
          </ClipPath>
        </Defs>

        {/* 1 — Ocean */}
        <Circle cx={R} cy={R} r={R * 0.987} fill="url(#ocean)" />

        {/* 2 — Land + borders, clipped to circle */}
        <G clipPath="url(#globe-clip)">
          {landFills}
          {gridLines}
          {landBorders}
        </G>

        {/* 3 — Flight arcs + dots (on top, not clipped so halos are visible) */}
        <G clipPath="url(#globe-clip)">
          {flightArcs}
          {airportDots}
        </G>

        {/* 4 — Limb darkening */}
        <Circle cx={R} cy={R} r={R * 0.987} fill="url(#limb)" />

        {/* 5 — Specular glass sheen */}
        <Circle cx={R} cy={R} r={R * 0.987} fill="url(#shine)" />

        {/* 6 — Atmospheric rim */}
        <Circle cx={R} cy={R} r={R * 0.987} fill="url(#atmo)" />

        {/* 7 — Crisp 1px edge ring */}
        <Circle cx={R} cy={R} r={R * 0.987} fill="none" stroke="rgba(50,100,200,0.30)" strokeWidth="1" />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: "center", justifyContent: "center" },
});

export default GlobeView;
