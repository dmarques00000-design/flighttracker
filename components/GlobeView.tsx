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
  OPO:{lat:41.24,lng:-8.68},SVQ:{lat:37.42,lng:-5.90},AGP:{lat:36.68,lng:-4.50},
  TXL:{lat:52.56,lng:13.29},DUS:{lat:51.28,lng:6.77},HAM:{lat:53.63,lng:9.99},
  NCE:{lat:43.66,lng:7.21},MRS:{lat:43.44,lng:5.22},LYS:{lat:45.72,lng:5.09},
  GVA:{lat:46.24,lng:6.11},EDI:{lat:55.95,lng:-3.37},MAN:{lat:53.35,lng:-2.27},
  DUB:{lat:53.42,lng:-6.27},KEF:{lat:63.99,lng:-22.62},TLV:{lat:32.00,lng:34.88},
  CAI:{lat:30.12,lng:31.41},CMN:{lat:33.37,lng:-7.59},TUN:{lat:36.85,lng:10.23},
  NBO:{lat:-1.32,lng:36.93},JNB:{lat:-26.13,lng:28.24},ACC:{lat:5.60,lng:-0.17},
  LOS:{lat:6.58,lng:3.32},ADD:{lat:8.98,lng:38.80},DAR:{lat:-6.88,lng:39.20},
  PEK:{lat:40.08,lng:116.58},PVG:{lat:31.14,lng:121.80},CAN:{lat:23.39,lng:113.30},
  KUL:{lat:2.74,lng:101.71},CGK:{lat:-6.13,lng:106.65},MNL:{lat:14.51,lng:121.02},
  BNE:{lat:-27.38,lng:153.12},MEL:{lat:-37.67,lng:144.84},AKL:{lat:-37.01,lng:174.79},
  SCL:{lat:-33.39,lng:-70.79},BOG:{lat:4.70,lng:-74.14},LIM:{lat:-12.02,lng:-77.11},
  EZE:{lat:-34.82,lng:-58.54},GIG:{lat:-22.81,lng:-43.25},SSA:{lat:-12.91,lng:-38.33},
  YVR:{lat:49.19,lng:-123.18},YUL:{lat:45.47,lng:-73.74},YEG:{lat:53.31,lng:-113.58},
  SJO:{lat:9.99,lng:-84.21},GUA:{lat:14.58,lng:-90.53},PTY:{lat:9.07,lng:-79.38},
  CUN:{lat:21.04,lng:-86.87},
};

function getCoord(iata: string) { return AIRPORTS[iata] ?? null; }

// ─── Land polygons ─────────────────────────────────────────────────────────────
const LAND: [number, number][][] = [
  // North America (contiguous)
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
  [[71,-156],[66,-166],[59,-164],[55,-160],[57,-136],[60,-141],[71,-141],[71,-156]],
  [
    [49,-95],[49,-86],[47,-84],[44,-77],[43,-79],[44,-76],[45,-73],
    [45,-71],[47,-68],[46,-64],[45,-61],[44,-66],[43,-66],[46,-60],
    [47,-54],[49,-56],[52,-56],[54,-60],[57,-61],[59,-64],[64,-65],
    [65,-70],[65,-75],[66,-82],[70,-84],[74,-80],[78,-76],[80,-74],
    [83,-68],[82,-58],[78,-52],[76,-52],[75,-58],[72,-64],[68,-64],
    [64,-78],[58,-84],[52,-82],[50,-78],[50,-84],[52,-92],[50,-96],
    [52,-100],[52,-96],[50,-96],[50,-90],[52,-82],[49,-86],[49,-95],
  ],
  [
    [29,-99],[25,-97],[18,-88],[10,-88],[8,-77],[10,-77],[12,-83],
    [15,-83],[16,-88],[15,-92],[16,-96],[18,-104],[22,-85],[24,-81],
    [25,-77],[28,-82],[30,-84],[29,-90],[29,-94],[28,-96],[29,-99],
  ],
  [[23,-74],[20,-77],[20,-75],[22,-73],[23,-74]],
  [[20,-72],[18,-74],[18,-71],[20,-69],[20,-72]],
  [[18,-78],[17,-78],[17,-76],[18,-76],[18,-78]],
  [
    [12,-72],[5,-52],[0,-50],[-5,-35],[-10,-36],[-14,-38],[-18,-38],
    [-22,-42],[-24,-44],[-26,-48],[-28,-50],[-32,-52],[-34,-54],
    [-50,-60],[-52,-60],[-54,-68],[-56,-68],[-54,-64],[-42,-63],
    [-32,-52],[-28,-50],[-24,-44],[-20,-40],[-14,-38],[-8,-35],
    [-5,-35],[0,-48],[-1,-44],[-2,-38],[2,-38],[4,-52],[5,-52],
    [8,-60],[8,-52],[2,-52],[0,-50],[2,-68],[4,-68],[5,-70],[6,-72],
    [8,-72],[10,-75],[12,-70],[12,-72],
  ],
  [
    [12,-72],[8,-72],[4,-60],[2,-52],[5,-52],[8,-60],[10,-61],[12,-64],
    [11,-66],[12,-68],[12,-72],
  ],
  [
    [-10,-68],[-18,-68],[-18,-58],[-20,-58],[-22,-56],[-24,-58],
    [-18,-64],[-16,-62],[-14,-60],[-12,-62],[-10,-66],[-10,-68],
  ],
  [[-52,-60],[-54,-64],[-54,-58],[-52,-58],[-52,-60]],
  [[83,-28],[80,-18],[76,-18],[72,-22],[70,-26],[72,-34],[76,-46],[80,-52],[82,-44],[84,-36],[83,-28]],
  [[66,-14],[64,-24],[63,-18],[64,-12],[66,-10],[66,-14]],
  [[58,-4],[51,-5],[50,-4],[51,2],[53,0],[58,-4]],
  [[55,-8],[52,-10],[52,-8],[55,-6],[55,-8]],
  [[44,-8],[36,-8],[36,2],[43,4],[44,8],[44,-8]],
  [[51,2],[50,2],[48,-2],[46,-2],[44,-1],[44,2],[43,4],[46,8],[48,8],[49,8],[50,4],[51,4],[51,2]],
  [[71,28],[65,14],[63,8],[60,5],[58,6],[60,10],[65,14],[68,18],[70,22],[71,26],[71,28]],
  [[70,22],[66,14],[64,10],[60,5],[59,5],[58,8],[60,10],[62,8],[64,10],[68,16],[70,22]],
  [[69,28],[57,12],[56,14],[58,16],[60,18],[64,18],[68,22],[70,24],[69,28]],
  [[70,28],[60,26],[60,24],[64,26],[68,28],[70,28]],
  [[57,10],[55,8],[55,10],[57,12],[57,10]],
  [[57,10],[56,8],[55,8],[55,10],[56,12],[57,12],[57,10]],
  [[55,8],[52,6],[48,8],[48,16],[52,14],[54,14],[55,12],[55,8]],
  [[51,4],[50,4],[50,6],[51,6],[51,4]],
  [[48,8],[46,8],[46,10],[48,10],[48,8]],
  [[54,14],[52,14],[50,22],[52,24],[54,22],[54,14]],
  [[58,22],[54,22],[54,26],[56,26],[58,24],[58,22]],
  [[47,12],[45,8],[44,8],[42,12],[40,18],[38,16],[38,14],[44,12],[46,12],[47,14],[47,12]],
  [[41,8],[39,8],[39,10],[41,10],[41,8]],
  [[38,12],[37,14],[38,16],[38,12]],
  [[48,16],[46,16],[46,22],[48,22],[48,16]],
  [[46,14],[44,14],[42,20],[44,22],[46,20],[46,14]],
  [[42,20],[38,22],[36,22],[36,26],[38,28],[40,26],[42,26],[42,20]],
  [[35,24],[35,26],[36,26],[35,24]],
  [[52,22],[48,22],[46,32],[48,38],[52,36],[52,22]],
  [[54,24],[50,24],[52,28],[54,28],[54,24]],
  [[70,24],[68,22],[66,20],[68,20],[70,22],[70,24]],
  [[72,32],[68,32],[66,30],[64,30],[62,30],[60,28],[58,28],[56,34],[54,36],[54,58],[56,58],[60,60],[64,60],[68,54],[72,54],[72,32]],
  [[72,54],[68,54],[64,60],[60,60],[56,60],[56,80],[60,80],[64,78],[68,74],[72,72],[72,54]],
  [[72,72],[68,74],[64,78],[60,80],[56,80],[56,100],[60,100],[64,100],[68,100],[72,100],[72,72]],
  [[72,100],[68,100],[64,100],[60,100],[56,100],[56,120],[60,130],[64,140],[68,148],[72,140],[72,120],[72,100]],
  [[60,162],[55,158],[52,160],[54,164],[56,164],[58,162],[60,162]],
  [[68,140],[58,130],[60,130],[64,136],[68,140]],
  [[42,26],[38,26],[36,28],[36,36],[38,42],[40,44],[42,44],[42,26]],
  [[42,44],[38,44],[36,44],[34,48],[26,54],[26,60],[28,62],[32,62],[36,62],[38,58],[42,44]],
  [[30,36],[22,36],[14,42],[12,50],[18,52],[22,60],[28,50],[30,46],[30,36]],
  [[24,54],[24,56],[26,56],[28,48],[26,48],[24,50],[24,54]],
  [[33,35],[30,34],[28,34],[30,36],[32,38],[33,36],[33,35]],
  [[54,58],[50,52],[46,52],[46,60],[48,66],[50,72],[52,76],[54,74],[54,66],[54,58]],
  [[42,56],[40,52],[38,56],[38,60],[40,60],[42,60],[42,56]],
  [[38,60],[30,68],[34,70],[36,72],[38,68],[38,60]],
  [[36,72],[28,72],[24,68],[22,68],[20,70],[14,74],[8,76],[8,78],[10,80],[12,80],[16,82],[20,86],[24,88],[26,90],[28,98],[30,96],[32,78],[34,78],[36,76],[36,74],[36,72]],
  [[10,80],[8,80],[8,82],[10,82],[10,80]],
  [[28,98],[22,98],[16,98],[14,98],[16,102],[20,100],[22,100],[26,98],[28,96],[28,98]],
  [[20,100],[14,100],[8,100],[6,100],[6,102],[14,102],[18,102],[20,102],[20,100]],
  [[22,102],[12,108],[14,110],[16,108],[20,104],[22,104],[22,102]],
  [[6,100],[2,104],[4,104],[6,102],[6,100]],
  [[8,114],[2,108],[0,108],[0,116],[2,118],[4,118],[8,116],[8,114]],
  [[6,96],[-2,102],[-4,104],[-4,106],[0,106],[2,106],[4,104],[6,98],[6,96]],
  [[-6,106],[-8,108],[-8,114],[-6,112],[-6,108],[-6,106]],
  [[18,120],[8,124],[10,126],[14,122],[16,122],[18,122],[18,120]],
  [[54,122],[48,134],[44,130],[40,128],[36,122],[26,120],[22,114],[22,108],[26,104],[28,98],[30,96],[34,80],[36,76],[38,76],[40,76],[44,80],[48,88],[50,90],[52,88],[52,96],[52,102],[54,118],[54,122]],
  [[52,88],[48,88],[44,88],[44,100],[44,108],[48,114],[52,118],[52,108],[52,100],[52,88]],
  [[38,126],[34,126],[34,128],[36,130],[38,130],[38,126]],
  [[40,140],[36,136],[34,132],[34,134],[36,138],[38,140],[40,142],[40,140]],
  [[44,142],[42,140],[42,142],[44,144],[44,142]],
  [[36,-6],[22,-14],[22,0],[26,2],[30,2],[34,2],[36,2],[36,-2],[34,-2],[30,-8],[22,-12],[22,0],[36,-2],[36,-6]],
  [[37,8],[34,10],[32,10],[34,12],[36,12],[37,10],[37,8]],
  [[34,10],[22,10],[22,20],[24,22],[26,24],[30,24],[32,24],[34,20],[34,10]],
  [[32,24],[22,24],[22,28],[22,32],[24,36],[26,36],[30,34],[32,34],[32,28],[32,24]],
  [[22,24],[4,28],[4,32],[8,32],[12,36],[16,38],[18,38],[22,36],[22,28],[22,24]],
  [[18,38],[8,38],[8,44],[12,44],[14,42],[16,44],[18,42],[18,38]],
  [[12,44],[2,44],[2,48],[4,46],[8,48],[10,50],[12,50],[12,44]],
  [[4,34],[-10,40],[-6,40],[0,42],[4,42],[4,36],[4,34]],
  [[16,0],[4,-16],[4,0],[4,8],[8,8],[12,8],[14,14],[16,12],[16,0]],
  [[4,18],[-8,22],[-8,28],[-4,32],[0,30],[4,26],[4,18]],
  [[-4,12],[-22,20],[-16,24],[-8,24],[-4,16],[-4,12]],
  [[-8,28],[-18,34],[-16,38],[-14,38],[-10,36],[-8,32],[-8,28]],
  [[-22,20],[-34,18],[-30,24],[-28,28],[-24,32],[-22,34],[-20,32],[-22,30],[-22,20]],
  [[-12,48],[-26,48],[-20,50],[-14,50],[-12,48]],
  [[-10,136],[-20,114],[-32,116],[-34,120],[-36,136],[-38,140],[-38,146],[-36,148],[-32,152],[-28,154],[-24,152],[-18,146],[-14,136],[-10,136]],
  [[-40,146],[-44,146],[-44,148],[-40,148],[-40,146]],
  [[-36,174],[-46,168],[-42,172],[-36,174]],
  [[-42,172],[-46,168],[-46,170],[-44,172],[-42,172]],
  [[-2,132],[-6,146],[-4,148],[-2,148],[0,144],[0,140],[-2,132]],
  [[26,122],[22,120],[22,122],[24,122],[26,122]],
  [[80,16],[76,20],[78,28],[80,28],[80,16]],
];

interface GlobeViewProps { flights: Flight[]; size?: number; }

export function GlobeView({ flights, size = GLOBE_SIZE }: GlobeViewProps) {
  const R = size / 2;

  const rotRef   = useRef(0.3);
  const velRef   = useRef(0);
  const dragging = useRef(false);
  const lastX    = useRef(0);
  const [rotation, setRotation] = useState(0.3);

  // ── Momentum-only animation (no auto-spin) ─────────────────────────────────
  useEffect(() => {
    let raf: ReturnType<typeof setInterval>;
    raf = setInterval(() => {
      if (Math.abs(velRef.current) > 0.0005) {
        rotRef.current = (rotRef.current + velRef.current) % (2 * Math.PI);
        velRef.current *= 0.88; // friction decay
        setRotation(rotRef.current);
      }
    }, 1000 / 60);
    return () => clearInterval(raf);
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
        const dx    = gs.moveX - lastX.current;
        lastX.current = gs.moveX;
        const delta = (dx / R) * 0.85;
        rotRef.current = (rotRef.current + delta) % (2 * Math.PI);
        velRef.current = delta;
        setRotation(rotRef.current);
      },
      onPanResponderRelease:   () => { dragging.current = false; },
      onPanResponderTerminate: () => { dragging.current = false; },
    }),
  [R]);

  // ── Graticule ──────────────────────────────────────────────────────────────
  const gridLines = useMemo(() => {
    const lines: React.ReactNode[] = [];
    const push = (seg: string[], key: string) => {
      if (seg.length > 1)
        lines.push(<Path key={key} d={`M${seg.join("L")}`} fill="none"
                         stroke="rgba(255,255,255,0.07)" strokeWidth="0.5" />);
    };
    for (const lat of [-60,-30,0,30,60]) {
      let s: string[] = [];
      for (let lng=-180;lng<=180;lng+=3) {
        const p3=latLngTo3D(lat,lng,R*0.996);
        const p=project(p3.x,p3.y,p3.z,rotation);
        if (p.visible) s.push(`${p.sx+R},${-p.sy+R}`); else { push(s,`la${lat}x${lng}`); s=[]; }
      }
      push(s,`la${lat}e`);
    }
    for (const lng of [0,30,60,90,120,150,180,210,240,270,300,330]) {
      let s: string[] = [];
      for (let lat=-90;lat<=90;lat+=3) {
        const p3=latLngTo3D(lat,lng,R*0.996);
        const p=project(p3.x,p3.y,p3.z,rotation);
        if (p.visible) s.push(`${p.sx+R},${-p.sy+R}`); else { push(s,`ln${lng}x${lat}`); s=[]; }
      }
      push(s,`ln${lng}e`);
    }
    return lines;
  }, [rotation, R]);

  // ── Land fills + borders ───────────────────────────────────────────────────
  const { landFills, landBorders } = useMemo(() => {
    const fills:   React.ReactNode[] = [];
    const borders: React.ReactNode[] = [];

    LAND.forEach((poly, ci) => {
      const projected = poly.map(([lat,lng]) => {
        const p3=latLngTo3D(lat,lng,R*0.998);
        return project(p3.x,p3.y,p3.z,rotation);
      });
      const vis = projected.filter(p=>p.visible).length;
      const ratio = vis / projected.length;

      if (ratio > 0.60 && vis >= 3) {
        const pts = projected.filter(p=>p.visible)
          .map(p=>`${(p.sx+R).toFixed(1)},${(-p.sy+R).toFixed(1)}`);
        if (pts.length >= 3)
          fills.push(<Path key={`lf${ci}`} d={`M${pts.join("L")}Z`}
            fill="#C8BB8A" fillOpacity={0.92} stroke="none" />);
      }

      let seg: string[] = [];
      projected.forEach((p,i) => {
        if (p.visible) {
          seg.push(`${(p.sx+R).toFixed(1)},${(-p.sy+R).toFixed(1)}`);
        } else {
          if (seg.length>1) borders.push(<Path key={`lb${ci}-${i}`} d={`M${seg.join("L")}`}
            fill="none" stroke="rgba(140,120,65,0.50)" strokeWidth="0.6" />);
          seg=[];
        }
      });
      if (seg.length>1) borders.push(<Path key={`lb${ci}-e`} d={`M${seg.join("L")}`}
        fill="none" stroke="rgba(140,120,65,0.50)" strokeWidth="0.6" />);
    });

    return { landFills: fills, landBorders: borders };
  }, [rotation, R]);

  // ── Flight arcs ────────────────────────────────────────────────────────────
  const flightArcs = useMemo(() => {
    return flights.slice(0, 40).map((f, idx) => {
      const from = getCoord(f.departureAirport);
      const to   = getCoord(f.arrivalAirport);
      if (!from || !to) return null;

      const fp=latLngTo3D(from.lat,from.lng,R*0.97);
      const tp=latLngTo3D(to.lat,to.lng,R*0.97);
      const f2=project(fp.x,fp.y,fp.z,rotation);
      const t2=project(tp.x,tp.y,tp.z,rotation);
      if (!f2.visible && !t2.visible) return null;

      const angle      = greatCircleAngle(from, to);
      const liftFactor = 1.05 + (angle / Math.PI) * 0.16;

      const mid  = { x:(fp.x+tp.x)/2, y:(fp.y+tp.y)/2, z:(fp.z+tp.z)/2 };
      const dist = Math.sqrt(mid.x**2+mid.y**2+mid.z**2)||1;
      const cp3  = { x:mid.x/dist*R*liftFactor, y:mid.y/dist*R*liftFactor, z:mid.z/dist*R*liftFactor };
      const c2   = project(cp3.x,cp3.y,cp3.z,rotation);

      const op = (f2.visible && t2.visible) ? 1 : 0.3;
      const d  = `M${f2.sx+R},${-f2.sy+R} Q${c2.sx+R},${-c2.sy+R} ${t2.sx+R},${-t2.sy+R}`;

      return (
        <G key={`arc-${idx}`}>
          {/* Glow halo */}
          <Path d={d} stroke="#FF6B35" strokeWidth={10} fill="none" opacity={0.07*op} strokeLinecap="round" />
          {/* Core line */}
          <Path d={d} stroke="#FF6B35" strokeWidth={1.8} fill="none" opacity={0.95*op} strokeLinecap="round" strokeDasharray="4 3" />
        </G>
      );
    });
  }, [flights, rotation, R]);

  // ── Airport dots ───────────────────────────────────────────────────────────
  const airportDots = useMemo(() => {
    const iatas = new Set<string>();
    flights.forEach(f => { iatas.add(f.departureAirport); iatas.add(f.arrivalAirport); });
    return Array.from(iatas).slice(0,60).flatMap(iata => {
      const coord = getCoord(iata);
      if (!coord) return [];
      const p3=latLngTo3D(coord.lat,coord.lng,R*0.985);
      const p=project(p3.x,p3.y,p3.z,rotation);
      if (!p.visible) return [];
      const cx=p.sx+R, cy=-p.sy+R;
      return [(
        <G key={`dot-${iata}`}>
          <Circle cx={cx} cy={cy} r={5}   fill="#FF6B35" opacity={0.18} />
          <Circle cx={cx} cy={cy} r={2.8} fill="#FF6B35" opacity={1} />
          <Circle cx={cx} cy={cy} r={1.1} fill="#FFFFFF" opacity={0.95} />
        </G>
      )];
    });
  }, [flights, rotation, R]);

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <View style={[styles.container, { width: size, height: size }]} {...panResponder.panHandlers}>
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <Defs>
          {/* Ocean — Apple Maps bright teal/cyan gradient */}
          <RadialGradient id="ocean" cx="36%" cy="30%" rx="66%" ry="66%">
            <Stop offset="0%"   stopColor="#B8E4F4" stopOpacity="1" />
            <Stop offset="28%"  stopColor="#6DC0E8" stopOpacity="1" />
            <Stop offset="58%"  stopColor="#3899D4" stopOpacity="1" />
            <Stop offset="82%"  stopColor="#1E6FB5" stopOpacity="1" />
            <Stop offset="100%" stopColor="#0D4E95" stopOpacity="1" />
          </RadialGradient>

          {/* Specular glass highlight — Apple Maps has a very strong top-left sheen */}
          <RadialGradient id="shine" cx="26%" cy="20%" rx="52%" ry="48%">
            <Stop offset="0%"   stopColor="#FFFFFF" stopOpacity="0.62" />
            <Stop offset="30%"  stopColor="#FFFFFF" stopOpacity="0.22" />
            <Stop offset="60%"  stopColor="#FFFFFF" stopOpacity="0.05" />
            <Stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
          </RadialGradient>

          {/* Atmospheric rim — blue halo around the edge */}
          <RadialGradient id="atmo" cx="50%" cy="50%" rx="50%" ry="50%">
            <Stop offset="76%"  stopColor="#8EC8FF" stopOpacity="0" />
            <Stop offset="90%"  stopColor="#6AADFF" stopOpacity="0.42" />
            <Stop offset="100%" stopColor="#3D8BEF" stopOpacity="0.75" />
          </RadialGradient>

          {/* Limb darkening — subtle edge shadow */}
          <RadialGradient id="limb" cx="50%" cy="50%">
            <Stop offset="0%"   stopColor="#000820" stopOpacity="0" />
            <Stop offset="62%"  stopColor="#000820" stopOpacity="0.02" />
            <Stop offset="86%"  stopColor="#000820" stopOpacity="0.13" />
            <Stop offset="100%" stopColor="#000820" stopOpacity="0.34" />
          </RadialGradient>

          <ClipPath id="globe-clip">
            <Circle cx={R} cy={R} r={R * 0.987} />
          </ClipPath>
        </Defs>

        {/* 1 — Ocean base */}
        <Circle cx={R} cy={R} r={R*0.987} fill="url(#ocean)" />

        {/* 2 — Land + graticule, clipped */}
        <G clipPath="url(#globe-clip)">
          {landFills}
          {gridLines}
          {landBorders}
        </G>

        {/* 3 — Flight arcs + airport dots, clipped */}
        <G clipPath="url(#globe-clip)">
          {flightArcs}
          {airportDots}
        </G>

        {/* 4 — Limb darkening */}
        <Circle cx={R} cy={R} r={R*0.987} fill="url(#limb)" />

        {/* 5 — Glass specular sheen */}
        <Circle cx={R} cy={R} r={R*0.987} fill="url(#shine)" />

        {/* 6 — Atmospheric halo */}
        <Circle cx={R} cy={R} r={R*0.987} fill="url(#atmo)" />

        {/* 7 — Crisp border ring */}
        <Circle cx={R} cy={R} r={R*0.987} fill="none" stroke="rgba(30,90,200,0.28)" strokeWidth="1" />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: "center", justifyContent: "center" },
});

export default GlobeView;
