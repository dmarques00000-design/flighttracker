import React, { useEffect, useRef, useState, useCallback } from "react";
import { View, StyleSheet, Dimensions, Platform } from "react-native";
import Svg, {
  Circle,
  Path,
  G,
  Defs,
  RadialGradient,
  Stop,
} from "react-native-svg";
import { Colors } from "@/constants/colors";
import { Flight } from "@/context/flights";

const { width: screenWidth } = Dimensions.get("window");
const GLOBE_SIZE = Math.min(screenWidth * 0.85, 400);

interface Coordinate {
  lat: number;
  lng: number;
}

// Convert lat/lng to 3D sphere coordinates
function latLngTo3D(lat: number, lng: number, radius: number) {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lng + 180) * (Math.PI / 180);
  const x = -(radius * Math.sin(phi) * Math.cos(theta));
  const y = radius * Math.cos(phi);
  const z = radius * Math.sin(phi) * Math.sin(theta);
  return { x, y, z };
}

// Project 3D coordinates to 2D (orthographic projection with Y-axis rotation)
function project3DTo2D(x: number, y: number, z: number, rotation: number) {
  const cosR = Math.cos(rotation);
  const sinR = Math.sin(rotation);
  const rotatedX = x * cosR - z * sinR;
  const rotatedZ = x * sinR + z * cosR;
  return {
    x: rotatedX,
    y,
    visible: rotatedZ > 0,
  };
}

// Airport coordinates
const airportCoordinates: { [key: string]: Coordinate } = {
  LIS: { lat: 38.7813, lng: -9.1359 },
  GVA: { lat: 46.2381, lng: 6.109 },
  ATL: { lat: 33.6407, lng: -84.4277 },
  MIA: { lat: 25.7959, lng: -80.287 },
  JFK: { lat: 40.
  // Draw country borders on the globe
  function drawCountryBorders(rotation: number) {
    return WORLD_BORDERS.map((border, idx) => {
      const pathSegments = border
        .map((coord) => {
          const [lat, lng] = coord;
          const pos3d = latLngTo3D(lat, lng, radius);
          const pos2d = project3DTo2D(pos3d.x, pos3d.y, pos3d.z, rotation);
          return pos2d.visible ? `${pos2d.x},${pos2d.y}` : null;
        })
        .filter((seg) => seg !== null);
      
      if (pathSegments.length < 2) return null;
      
      return (
        <Path
          key={`country-${idx}`}
          d={`M${pathSegments.join(' L')}`}
          stroke="#B0C4DE"
          strokeWidth="0.8"
          fill="none"
          opacity={0.4}
        />
      );
    }).filter(Boolean);
  }

6413, lng: -73.7781 },
  LAX: { lat: 33.9416, lng: -118.4085 },
  LHR: { lat: 51.47, lng: -0.4543 },
  CDG: { lat: 49.0097, lng: 2.5479 },
  DXB: { lat: 25.2532, lng: 55.3657 },
  HKG: { lat: 22.308, lng: 113.9185 },
  SYD: { lat: -33.9399, lng: 151.1753 },
  SIN: { lat: 1.3644, lng: 103.9915 },
  NRT: { lat: 35.772, lng: 140.3929 },
  FRA: { lat: 50.0379, lng: 8.5622 },
  AMS: { lat: 52.3086, lng: 4.7639 },
  MAD: { lat: 40.4936, lng: -3.5668 },
  BCN: { lat: 41.2971, lng: 2.0785 },
  FCO: { lat: 41.8003, lng: 12.2389 },
  MUC: { lat: 48.3537, lng: 11.775 },
  ZRH: { lat: 47.4647, lng: 8.5492 },
  ORD: { lat: 41.9742, lng: -87.9073 },
  SFO: { lat: 37.6213, lng: -122.379 },
  BOS: { lat: 42.3656, lng: -71.0096 },
  IAD: { lat: 38.9531, lng: -77.4565 },
  EWR: { lat: 40.6895, lng: -74.1745 },
};
const WORLD_BORDERS = [
  // North America outline
  [[70,-130],[65,-140],[60,-165],[55,-170],[50,-130],[45,-125],[40,-124],[35,-118],[32,-117],[28,-110],[25,-105],[22,-105],[19,-90],[15,-88],[10,-85],[8,-80],[9,-79],[10,-75],[15,-70],[20,-70],[25,-80],[30,-85],[35,-90],[40,-75],[45,-65],[50,-55],[55,-60],[60,-65],[70,-70],[75,-80],[75,-100],[70,-130]],
  // Europe outline  
  [[70,25],[65,20],[60,5],[55,0],[50,5],[45,10],[40,10],[35,15],[35,25],[40,40],[45,45],[50,50],[55,60],[60,70],[65,80],[68,90],[70,70],[70,40],[70,25]],
  // Asia outline
  [[70,90],[65,70],[60,60],[55,75],[50,80],[45,90],[40,100],[35,100],[25,70],[20,70],[15,75],[10,100],[0,105],[-10,110],[-5,120],[5,135],[15,145],[25,140],[35,140],[45,145],[55,160],[60,170],[65,175],[70,170],[72,150],[70,120],[70,90]],
  // Africa outline
  [[35,10],[30,15],[25,20],[20,30],[15,40],[10,45],[0,40],[-10,35],[-20,30],[-25,25],[-30,20],[-35,18],[-35,30],[-30,35],[-25,40],[-20,50],[-10,50],[0,45],[10,40],[15,35],[20,30],[25,25],[30,15],[35,10]],
  // South America outline
  [[10,-75],[5,-80],[0,-78],[-5,-75],[-10,-70],[-15,-70],[-20,-65],[-25,-70],[-30,-70],[-35,-72],[-40,-73],[-45,-72],[-50,-70],[-55,-68],[-55,-65],[-50,-60],[-45,-62],[-40,-65],[-35,-60],[-30,-55],[-25,-50],[-20,-50],[-15,-55],[-10,-60],[-5,-65],[0,-70],[5,-72],[10,-75]],
  // Australia outline
  [[-10,130],[-15,125],[-20,115],[-25,115],[-30,120],[-35,135],[-40,145],[-42,148],[-40,150],[-35,150],[-30,145],[-25,145],[-20,140],[-15,140],[-10,135],[-10,130]]
];


function getAirportCoordinate(iata: string): Coordinate {
  return airportCoordinates[iata] || { lat: 0, lng: 0 };
}

interface GlobeViewProps {
  flights: Flight[];
  size?: number;
}

export function GlobeView({ flights, size = GLOBE_SIZE }: GlobeViewProps) {
  const radius = size / 2;
  const [rotation, setRotation] = useState(0);
  const animRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const rotRef = useRef(0);

  useEffect(() => {
    // ~30fps smooth rotation — full rotation every 25 seconds
    const SPEED = (2 * Math.PI) / (25 * 30);
    animRef.current = setInterval(() => {
      rotRef.current = (rotRef.current + SPEED) % (2 * Math.PI);
      setRotation(rotRef.current);
    }, 1000 / 30);
    return () => {
      if (animRef.current) clearInterval(animRef.current);
    };
  }, []);

  // Draw a great-circle arc between two airports
  const drawFlightPath = useCallback(
    (from: Coordinate, to: Coordinate, rot: number, key: string) => {
      const fromPoint = latLngTo3D(from.lat, from.lng, radius * 0.95);
      const toPoint = latLngTo3D(to.lat, to.lng, radius * 0.95);

      const from2D = project3DTo2D(fromPoint.x, fromPoint.y, fromPoint.z, rot);
      const to2D = project3DTo2D(toPoint.x, toPoint.y, toPoint.z, rot);

      if (!from2D.visible && !to2D.visible) return null;

      // Control point elevated above globe surface for arc effect
      const midPoint3D = {
        x: (fromPoint.x + toPoint.x) / 2,
        y: (fromPoint.y + toPoint.y) / 2,
        z: (fromPoint.z + toPoint.z) / 2,
      };
      const dist = Math.sqrt(
        midPoint3D.x ** 2 + midPoint3D.y ** 2 + midPoint3D.z ** 2,
      );
      const height = radius * 1.18;
      const controlPoint3D = {
        x: (midPoint3D.x / dist) * height,
        y: (midPoint3D.y / dist) * height,
        z: (midPoint3D.z / dist) * height,
      };
      const control2D = project3DTo2D(
        controlPoint3D.x,
        controlPoint3D.y,
        controlPoint3D.z,
        rot,
      );

      const pathData = `M ${from2D.x + radius},${-from2D.y + radius} Q ${control2D.x + radius},${-control2D.y + radius} ${to2D.x + radius},${-to2D.y + radius}`;

      const opacity = from2D.visible && to2D.visible ? 0.75 : 0.35;

      return (
        <Path
          key={key}
          d={pathData}
          stroke={Colors.accent}
          strokeWidth="1.8"
          fill="none"
          opacity={opacity}
          strokeLinecap="round"
        />
      );
    },
    [radius],
  );

  // Draw airport dot
  const drawAirportDot = useCallback(
    (coord: Coordinate, rot: number, key: string) => {
      const p3D = latLngTo3D(coord.lat, coord.lng, radius * 0.97);
      const p2D = project3DTo2D(p3D.x, p3D.y, p3D.z, rot);
      if (!p2D.visible) return null;
      return (
        <Circle
          key={key}
          cx={p2D.x + radius}
          cy={-p2D.y + radius}
          r={2.5}
          fill={Colors.accent}
          opacity={0.9}
        />
      );
    },
    [radius],
  );

  // Latitude grid lines
  const latLines = [-60, -30, 0, 30, 60].map((lat) => {
    const y = radius - radius * Math.sin((lat * Math.PI) / 180);
    const r = radius * Math.cos((lat * Math.PI) / 180);
    // Project the equator circle accounting for rotation (simplified ellipse)
    // For lat lines we draw a simple circle in 2D (orthographic looks like ellipse for non-equator)
    const points: string[] = [];
    for (let lng = -180; lng <= 180; lng += 6) {
      const p3D = latLngTo3D(lat, lng, radius * 0.99);
      const p2D = project3DTo2D(p3D.x, p3D.y, p3D.z, rotation);
      if (p2D.visible) {
        points.push(`${p2D.x + radius},${-p2D.y + radius}`);
      }
    }
    if (points.length < 2) return null;
    // Build polyline path
    const d = "M " + points.join(" L ");
    return (
      <Path
        key={`lat-${lat}`}
        d={d}
        fill="none"
        stroke={Colors.textMuted}
        strokeWidth="0.4"
        opacity={0.5}
      />
    );
  });

  // Longitude grid lines
  const lngLines = [0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map(
    (lng) => {
      const points: string[] = [];
      for (let lat = -90; lat <= 90; lat += 6) {
        const p3D = latLngTo3D(lat, lng, radius * 0.99);
        const p2D = project3DTo2D(p3D.x, p3D.y, p3D.z, rotation);
        if (p2D.visible) {
          points.push(`${p2D.x + radius},${-p2D.y + radius}`);
        }
      }
      if (points.length < 2) return null;
      const d = "M " + points.join(" L ");
      return (
        <Path
          key={`lng-${lng}`}
          d={d}
          fill="none"
          stroke={Colors.textMuted}
          strokeWidth="0.4"
          opacity={0.5}
        />
      );
    },
  );

  // Collect unique airports from flights
  const airportSet = new Set<string>();
  flights.forEach((f) => {
    airportSet.add(f.departureAirport);
    airportSet.add(f.arrivalAirport);
  });

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <Defs>
          <RadialGradient id="globeGrad" cx="40%" cy="35%">
            <Stop offset="0%" stopColor="#E8F0FF" stopOpacity="1" />
            <Stop offset="60%" stopColor="#D0E4FF" stopOpacity="1" />
            <Stop offset="100%" stopColor="#B8D0F5" stopOpacity="1" />
          </RadialGradient>
          <RadialGradient id="globeShine" cx="35%" cy="30%">
            <Stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.6" />
            <Stop offset="50%" stopColor="#FFFFFF" stopOpacity="0" />
          </RadialGradient>
        </Defs>

        {/* Globe base sphere */}
        <Circle
          cx={radius}
          cy={radius}
          r={radius * 0.98}
          fill="url(#globeGrad)"
          stroke={Colors.border}
          strokeWidth="1"
        />

        {/* Grid lines */}
        <G opacity={1}>
          {latLines}
          {lngLines}
        </G>

       
      {/* Country borders */}
      <G opacity={0.5}>
        {drawCountryBorders(rotation)}
      </G>
 {/* Flight routes */}
        <G>
          {flights.slice(0, 15).map((flight, index) => {
            const from = getAirportCoordinate(flight.departureAirport);
            const to = getAirportCoordinate(flight.arrivalAirport);
            return drawFlightPath(
              from,
              to,
              rotation,
              `route-${index}-${flight.id}`,
            );
          })}
        </G>

        {/* Airport dots */}
        <G>
          {Array.from(airportSet)
            .slice(0, 30)
            .map((iata) => {
              const coord = getAirportCoordinate(iata);
              return drawAirportDot(coord, rotation, `dot-${iata}`);
            })}
        </G>

        {/* Specular shine overlay */}
        <Circle
          cx={radius * 0.78}
          cy={radius * 0.62}
          r={radius * 0.45}
          fill="url(#globeShine)"
        />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
  },
});

export default GlobeView;
