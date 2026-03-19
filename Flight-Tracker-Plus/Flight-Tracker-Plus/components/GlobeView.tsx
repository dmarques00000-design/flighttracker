import React, { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { View, StyleSheet, Dimensions } from "react-native";
import Svg, { Circle, Path, G, Defs, RadialGradient, Stop } from "react-native-svg";
import { Colors } from "@/constants/colors";
import { Flight } from "@/context/flights";

const { width: screenWidth } = Dimensions.get("window");
const GLOBE_SIZE = Math.min(screenWidth * 0.9, 400);

interface Coord { lat: number; lng: number; }

// ─── Projection helpers ────────────────────────────────────────────────────────
function latLngTo3D(lat: number, lng: number, r: number) {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lng + 180) * (Math.PI / 180);
  return {
    x: -(r * Math.sin(phi) * Math.cos(theta)),
    y:   r * Math.cos(phi),
    z:   r * Math.sin(phi) * Math.sin(theta),
  };
}

function project(x: number, y: number, z: number, rot: number) {
  const cr = Math.cos(rot), sr = Math.sin(rot);
  return {
    sx: x * cr - z * sr,
    sy: y,
    visible: x * sr + z * cr > 0,
  };
}

// ─── Airport database ──────────────────────────────────────────────────────────
const AIRPORTS: Record<string, Coord> = {
  LIS: { lat: 38.78, lng: -9.14 }, GVA: { lat: 46.24, lng: 6.11 },
  ZRH: { lat: 47.46, lng: 8.55 }, ATL: { lat: 33.64, lng: -84.43 },
  MIA: { lat: 25.80, lng: -80.29 }, JFK: { lat: 40.64, lng: -73.78 },
  LAX: { lat: 33.94, lng: -118.41 }, LHR: { lat: 51.47, lng: -0.45 },
  CDG: { lat: 49.01, lng: 2.55 }, DXB: { lat: 25.25, lng: 55.37 },
  HKG: { lat: 22.31, lng: 113.92 }, SYD: { lat: -33.94, lng: 151.18 },
  SIN: { lat: 1.36, lng: 103.99 }, NRT: { lat: 35.77, lng: 140.39 },
  FRA: { lat: 50.04, lng: 8.56 }, AMS: { lat: 52.31, lng: 4.76 },
  MAD: { lat: 40.49, lng: -3.57 }, BCN: { lat: 41.30, lng: 2.08 },
  FCO: { lat: 41.80, lng: 12.24 }, MUC: { lat: 48.35, lng: 11.78 },
  ORD: { lat: 41.97, lng: -87.91 }, SFO: { lat: 37.62, lng: -122.38 },
  BOS: { lat: 42.37, lng: -71.01 }, IAD: { lat: 38.95, lng: -77.46 },
  EWR: { lat: 40.69, lng: -74.17 }, BKK: { lat: 13.69, lng: 100.75 },
  ICN: { lat: 37.46, lng: 126.44 }, DEL: { lat: 28.56, lng: 77.10 },
  BOM: { lat: 19.09, lng: 72.87 }, CPT: { lat: -33.96, lng: 18.60 },
  GRU: { lat: -23.43, lng: -46.47 }, YYZ: { lat: 43.68, lng: -79.63 },
  MEX: { lat: 19.43, lng: -99.07 }, DOH: { lat: 25.27, lng: 51.61 },
  IST: { lat: 40.98, lng: 28.82 }, VIE: { lat: 48.11, lng: 16.57 },
  BRU: { lat: 50.90, lng: 4.48 }, ARN: { lat: 59.65, lng: 17.92 },
  CPH: { lat: 55.62, lng: 12.66 }, HEL: { lat: 60.32, lng: 24.96 },
  OSL: { lat: 60.20, lng: 11.08 }, WAW: { lat: 52.17, lng: 20.97 },
  PRG: { lat: 50.10, lng: 14.26 }, BUD: { lat: 47.43, lng: 19.26 },
  ATH: { lat: 37.94, lng: 23.95 }, LHR2: { lat: 51.47, lng: -0.45 },
};

function getCoord(iata: string): Coord {
  return AIRPORTS[iata] ?? { lat: 0, lng: 0 };
}

// ─── World country outlines (simplified polygons, one ring per country) ─────────
// Each entry is an array of [lat, lng] pairs forming a closed polygon.
const COUNTRIES: [number, number][][] = [
  // Greenland
  [[83,15],[83,-60],[76,-73],[70,-55],[60,-44],[62,-30],[70,-22],[75,-18],[80,-10],[83,15]],
  // Canada
  [[72,-80],[72,-120],[68,-140],[60,-135],[54,-130],[50,-128],[48,-85],[45,-65],[50,-55],[58,-62],[65,-64],[70,-70],[75,-78],[72,-80]],
  // USA (lower 48)
  [[48,-123],[45,-124],[42,-124],[38,-123],[34,-118],[32,-117],[30,-103],[25,-97],[25,-80],[30,-81],[35,-76],[40,-74],[44,-67],[46,-68],[47,-70],[49,-95],[49,-110],[48,-123]],
  // Alaska
  [[71,-156],[68,-166],[60,-165],[55,-160],[58,-136],[62,-141],[68,-141],[71,-156]],
  // Mexico
  [[30,-110],[25,-97],[22,-97],[18,-92],[16,-88],[16,-92],[19,-87],[21,-87],[22,-90],[25,-90],[30,-110]],
  // Cuba
  [[23,-74],[22,-78],[20,-77],[20,-75],[22,-73],[23,-74]],
  // Greenland (ice sheet simplified)
  // UK & Ireland
  [[58,-5],[55,-6],[52,-10],[51,-5],[51,1],[53,2],[56,0],[58,-5]],
  [[54,-8],[54,-6],[52,-6],[52,-10],[54,-8]],
  // Iceland
  [[66,-14],[64,-24],[63,-18],[64,-12],[66,-14]],
  // Norway
  [[71,28],[70,22],[65,14],[60,5],[58,8],[62,14],[68,18],[71,28]],
  // Sweden
  [[69,28],[60,18],[56,13],[56,18],[60,22],[65,22],[69,28]],
  // Finland
  [[70,28],[65,28],[60,25],[60,20],[65,22],[70,28]],
  // Denmark
  [[57,12],[55,8],[55,10],[57,12]],
  // Netherlands + Belgium
  [[53,7],[52,4],[50,3],[50,6],[53,7]],
  // France
  [[51,2],[48,-5],[44,-2],[43,3],[43,7],[46,7],[49,8],[51,2]],
  // Spain & Portugal
  [[44,-9],[36,-9],[36,-6],[38,-1],[41,3],[44,3],[44,-9]],
  // Portugal
  [[42,-9],[37,-9],[36,-7],[38,-7],[40,-7],[42,-9]],
  // Germany
  [[55,8],[52,6],[48,8],[48,14],[52,14],[55,12],[55,8]],
  // Italy
  [[47,12],[44,8],[38,15],[38,16],[40,18],[44,12],[47,12]],
  [[38,15],[37,14],[38,16]],
  // Switzerland & Austria
  [[48,8],[46,6],[46,10],[48,14],[48,8]],
  // Czech + Slovakia
  [[52,12],[48,12],[48,18],[52,18],[52,12]],
  // Poland
  [[54,14],[50,14],[50,24],[54,24],[54,14]],
  // Ukraine + Belarus
  [[52,23],[46,22],[46,38],[52,38],[52,23]],
  // Romania + Hungary
  [[48,16],[44,22],[44,30],[48,30],[48,16]],
  // Greece
  [[42,20],[36,22],[36,28],[38,28],[42,26],[42,20]],
  // Turkey
  [[42,26],[36,26],[36,36],[38,44],[42,44],[42,36],[42,26]],
  // Russia (Europe)
  [[70,30],[55,28],[55,60],[60,60],[68,55],[70,50],[70,30]],
  // Russia (Asia – west)
  [[70,60],[55,60],[55,80],[65,80],[70,70],[70,60]],
  // Russia (Asia – east)
  [[70,130],[60,130],[55,135],[60,150],[66,170],[70,160],[70,130]],
  // Kazakhstan
  [[55,50],[46,50],[46,80],[55,80],[55,50]],
  // China
  [[53,74],[40,74],[22,100],[22,120],[40,135],[53,135],[53,74]],
  // India
  [[36,70],[8,68],[8,80],[20,88],[28,98],[36,76],[36,70]],
  // Japan
  [[44,142],[30,130],[32,132],[36,140],[40,140],[44,142]],
  // South Korea
  [[38,126],[34,126],[34,130],[38,130],[38,126]],
  // Mongolia
  [[52,88],[42,88],[42,120],[52,120],[52,88]],
  // Southeast Asia
  [[28,92],[10,98],[5,100],[1,104],[5,116],[20,108],[28,100],[28,92]],
  // Indonesia (Sumatra + Java)
  [[6,96],[0,96],[-8,115],[-5,120],[0,110],[6,106],[6,96]],
  // Philippines
  [[20,118],[5,118],[5,127],[12,124],[18,122],[20,118]],
  // Australia
  [[-10,130],[-15,125],[-20,114],[-30,114],[-36,136],[-38,147],[-34,151],[-24,152],[-18,146],[-12,136],[-10,130]],
  // New Zealand
  [[-34,172],[-44,168],[-46,168],[-44,170],[-40,174],[-34,172]],
  // Middle East (Saudi + Gulf)
  [[30,36],[22,36],[12,44],[22,56],[26,56],[30,48],[30,36]],
  // Iran
  [[38,44],[26,56],[26,62],[36,62],[38,58],[38,44]],
  // Pakistan + Afghanistan
  [[38,60],[24,62],[24,70],[36,76],[38,70],[38,60]],
  // Egypt + Libya
  [[32,24],[22,24],[22,36],[30,34],[32,34],[32,24]],
  // Libya + Algeria + Morocco + Tunisia
  [[36,8],[20,8],[20,24],[32,24],[36,24],[36,8]],
  // West Africa
  [[22,0],[4,-16],[4,8],[12,8],[22,8],[22,0]],
  // East Africa (Ethiopia + Somalia)
  [[14,40],[0,42],[2,48],[12,48],[14,44],[14,40]],
  // Central Africa
  [[4,8],[0,8],[-5,12],[-5,30],[4,30],[4,8]],
  // Southern Africa
  [[-5,20],[-30,16],[-34,18],[-30,30],[-20,36],[-5,40],[-5,20]],
  // Madagascar
  [[-12,44],[-26,44],[-25,48],[-12,50],[-12,44]],
  // Brazil
  [[4,-52],[4,-34],[-5,-36],[-10,-38],[-20,-40],[-30,-50],[-34,-52],[-30,-60],[-20,-58],[-10,-68],[-4,-60],[0,-50],[4,-52]],
  // Argentina + Chile
  [[-22,-70],[-40,-72],[-56,-68],[-50,-68],[-40,-62],[-30,-58],[-22,-58],[-22,-70]],
  // Colombia + Venezuela
  [[12,-72],[0,-76],[4,-60],[10,-60],[12,-72]],
  // Peru + Bolivia + Ecuador
  [[0,-76],[-20,-70],[-20,-58],[-10,-58],[0,-60],[0,-76]],
  // Siberia / Far East stub
  [[74,130],[70,160],[68,180],[70,170],[74,160],[74,130]],
];

interface GlobeViewProps {
  flights: Flight[];
  size?: number;
}

export function GlobeView({ flights, size = GLOBE_SIZE }: GlobeViewProps) {
  const R = size / 2;
  const [rotation, setRotation] = useState(0.3);
  const rotRef = useRef(0.3);

  useEffect(() => {
    const SPEED = (2 * Math.PI) / (30 * 30); // full rotation in 30 s at 30 fps
    const id = setInterval(() => {
      rotRef.current = (rotRef.current + SPEED) % (2 * Math.PI);
      setRotation(rotRef.current);
    }, 1000 / 30);
    return () => clearInterval(id);
  }, []);

  // ── Grid lines ──────────────────────────────────────────────────────────────
  const gridLines = useMemo(() => {
    const lines: React.ReactNode[] = [];
    // Latitude
    for (const lat of [-60, -30, 0, 30, 60]) {
      const pts: string[] = [];
      for (let lng = -180; lng <= 180; lng += 4) {
        const p3 = latLngTo3D(lat, lng, R * 0.995);
        const p = project(p3.x, p3.y, p3.z, rotation);
        if (p.visible) pts.push(`${p.sx + R},${-p.sy + R}`);
        else if (pts.length) { lines.push(<Path key={`la${lat}${lng}`} d={`M${pts.join("L")}`} fill="none" stroke={Colors.border} strokeWidth="0.5" opacity={0.7} />); pts.length = 0; }
      }
      if (pts.length > 1) lines.push(<Path key={`la${lat}e`} d={`M${pts.join("L")}`} fill="none" stroke={Colors.border} strokeWidth="0.5" opacity={0.7} />);
    }
    // Longitude
    for (const lng of [0,30,60,90,120,150,180,210,240,270,300,330]) {
      const pts: string[] = [];
      for (let lat = -90; lat <= 90; lat += 4) {
        const p3 = latLngTo3D(lat, lng, R * 0.995);
        const p = project(p3.x, p3.y, p3.z, rotation);
        if (p.visible) pts.push(`${p.sx + R},${-p.sy + R}`);
        else if (pts.length) { lines.push(<Path key={`ln${lng}${lat}`} d={`M${pts.join("L")}`} fill="none" stroke={Colors.border} strokeWidth="0.5" opacity={0.7} />); pts.length = 0; }
      }
      if (pts.length > 1) lines.push(<Path key={`ln${lng}e`} d={`M${pts.join("L")}`} fill="none" stroke={Colors.border} strokeWidth="0.5" opacity={0.7} />);
    }
    return lines;
  }, [rotation, R]);

  // ── Country borders ─────────────────────────────────────────────────────────
  const countryPaths = useMemo(() => {
    return COUNTRIES.flatMap((polygon, ci) => {
      const paths: React.ReactNode[] = [];
      let seg: string[] = [];
      polygon.forEach(([lat, lng], i) => {
        const p3 = latLngTo3D(lat, lng, R * 0.997);
        const p = project(p3.x, p3.y, p3.z, rotation);
        if (p.visible) {
          seg.push(`${p.sx + R},${-p.sy + R}`);
        } else {
          if (seg.length > 1) paths.push(<Path key={`c${ci}-${i}`} d={`M${seg.join("L")}`} fill="none" stroke="#5A8FC8" strokeWidth="0.9" opacity={0.55} />);
          seg = [];
        }
      });
      if (seg.length > 1) paths.push(<Path key={`c${ci}-e`} d={`M${seg.join("L")}`} fill="none" stroke="#5A8FC8" strokeWidth="0.9" opacity={0.55} />);
      return paths;
    });
  }, [rotation, R]);

  // ── Flight arcs ─────────────────────────────────────────────────────────────
  const flightArcs = useMemo(() => {
    return flights.slice(0, 20).map((f, idx) => {
      const from = getCoord(f.departureAirport);
      const to = getCoord(f.arrivalAirport);

      const fp = latLngTo3D(from.lat, from.lng, R * 0.97);
      const tp = latLngTo3D(to.lat, to.lng, R * 0.97);
      const f2 = project(fp.x, fp.y, fp.z, rotation);
      const t2 = project(tp.x, tp.y, tp.z, rotation);

      if (!f2.visible && !t2.visible) return null;

      // Great-circle midpoint lifted above surface
      const mid = {
        x: (fp.x + tp.x) / 2,
        y: (fp.y + tp.y) / 2,
        z: (fp.z + tp.z) / 2,
      };
      const dist = Math.sqrt(mid.x ** 2 + mid.y ** 2 + mid.z ** 2) || 1;
      const lift = R * 1.2;
      const cp3 = { x: (mid.x / dist) * lift, y: (mid.y / dist) * lift, z: (mid.z / dist) * lift };
      const c2 = project(cp3.x, cp3.y, cp3.z, rotation);

      const opacity = f2.visible && t2.visible ? 0.85 : 0.3;
      const d = `M${f2.sx + R},${-f2.sy + R} Q${c2.sx + R},${-c2.sy + R} ${t2.sx + R},${-t2.sy + R}`;

      return (
        <G key={`arc-${idx}`}>
          {/* Shadow / glow */}
          <Path d={d} stroke={Colors.accent} strokeWidth="4" fill="none" opacity={0.12} strokeLinecap="round" />
          {/* Main arc */}
          <Path d={d} stroke={Colors.accent} strokeWidth="1.8" fill="none" opacity={opacity} strokeLinecap="round" />
        </G>
      );
    });
  }, [flights, rotation, R]);

  // ── Airport dots ────────────────────────────────────────────────────────────
  const airportDots = useMemo(() => {
    const iatas = new Set<string>();
    flights.forEach((f) => { iatas.add(f.departureAirport); iatas.add(f.arrivalAirport); });
    return Array.from(iatas).slice(0, 40).map((iata) => {
      const coord = getCoord(iata);
      const p3 = latLngTo3D(coord.lat, coord.lng, R * 0.978);
      const p = project(p3.x, p3.y, p3.z, rotation);
      if (!p.visible) return null;
      const cx = p.sx + R;
      const cy = -p.sy + R;
      return (
        <G key={`dot-${iata}`}>
          {/* Pulse ring */}
          <Circle cx={cx} cy={cy} r={5} fill={Colors.accent} opacity={0.15} />
          {/* Solid dot */}
          <Circle cx={cx} cy={cy} r={2.8} fill={Colors.accent} opacity={0.95} />
          <Circle cx={cx} cy={cy} r={1.2} fill="#fff" opacity={0.9} />
        </G>
      );
    });
  }, [flights, rotation, R]);

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <Defs>
          <RadialGradient id="globeGrad" cx="38%" cy="32%">
            <Stop offset="0%" stopColor="#EEF4FF" stopOpacity="1" />
            <Stop offset="55%" stopColor="#D6E8FF" stopOpacity="1" />
            <Stop offset="100%" stopColor="#BDD4F5" stopOpacity="1" />
          </RadialGradient>
          <RadialGradient id="shine" cx="32%" cy="28%">
            <Stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.55" />
            <Stop offset="60%" stopColor="#FFFFFF" stopOpacity="0" />
          </RadialGradient>
        </Defs>

        {/* Base sphere */}
        <Circle cx={R} cy={R} r={R * 0.985} fill="url(#globeGrad)" stroke={Colors.border} strokeWidth="1" />

        {/* Grid */}
        <G>{gridLines}</G>

        {/* Country outlines */}
        <G>{countryPaths}</G>

        {/* Flight arcs */}
        <G>{flightArcs}</G>

        {/* Airport dots */}
        <G>{airportDots}</G>

        {/* Shine */}
        <Circle cx={R * 0.76} cy={R * 0.60} r={R * 0.42} fill="url(#shine)" />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: "center", justifyContent: "center" },
});

export default GlobeView;
