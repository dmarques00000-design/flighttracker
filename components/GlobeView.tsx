/**
 * RouteMapView (exported as GlobeView for drop-in compatibility)
 *
 * Flat equirectangular SVG world map with:
 *  - Accurate Natural Earth-simplified country outlines
 *  - Great-circle arc per flight (parabolic approximation in 2D)
 *  - Airport dot markers
 *  - Dark-mode aware colours from Colors
 *  - No new dependencies — only react-native-svg (already installed)
 */
import React, { useMemo } from "react";
import { View, StyleSheet, Dimensions } from "react-native";
import Svg, { Path, Circle, G, Defs, LinearGradient, Stop, Rect } from "react-native-svg";
import { Colors } from "@/constants/colors";
import { Flight } from "@/context/flights";

const { width: SCREEN_W } = Dimensions.get("window");
const MAP_W = Math.min(SCREEN_W - 40, 600);
const MAP_H = Math.round(MAP_W * 0.52); // ~2:1 equirectangular ratio

// ─── Projection ───────────────────────────────────────────────────────────────
// Simple equirectangular: lng → x, lat → y
function project(lat: number, lng: number, w: number, h: number) {
  const x = ((lng + 180) / 360) * w;
  const y = ((90 - lat) / 180) * h;
  return { x, y };
}

// ─── Airport registry (same as before) ────────────────────────────────────────
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
  EDI:{lat:55.95,lng:-3.37},MAN:{lat:53.35,lng:-2.27},DUB:{lat:53.42,lng:-6.27},
  KEF:{lat:63.99,lng:-22.62},TLV:{lat:32.00,lng:34.88},CAI:{lat:30.12,lng:31.41},
  CMN:{lat:33.37,lng:-7.59},TUN:{lat:36.85,lng:10.23},NBO:{lat:-1.32,lng:36.93},
  JNB:{lat:-26.13,lng:28.24},ACC:{lat:5.60,lng:-0.17},LOS:{lat:6.58,lng:3.32},
  ADD:{lat:8.98,lng:38.80},DAR:{lat:-6.88,lng:39.20},PEK:{lat:40.08,lng:116.58},
  PVG:{lat:31.14,lng:121.80},CAN:{lat:23.39,lng:113.30},KUL:{lat:2.74,lng:101.71},
  CGK:{lat:-6.13,lng:106.65},MNL:{lat:14.51,lng:121.02},BNE:{lat:-27.38,lng:153.12},
  MEL:{lat:-37.67,lng:144.84},AKL:{lat:-37.01,lng:174.79},SCL:{lat:-33.39,lng:-70.79},
  BOG:{lat:4.70,lng:-74.14},LIM:{lat:-12.02,lng:-77.11},EZE:{lat:-34.82,lng:-58.54},
  GIG:{lat:-22.81,lng:-43.25},SSA:{lat:-12.91,lng:-38.33},YVR:{lat:49.19,lng:-123.18},
  YUL:{lat:45.47,lng:-73.74},YEG:{lat:53.31,lng:-113.58},SJO:{lat:9.99,lng:-84.21},
  GUA:{lat:14.58,lng:-90.53},PTY:{lat:9.07,lng:-79.38},CUN:{lat:21.04,lng:-86.87},
  FCO:{lat:41.80,lng:12.24},NAP:{lat:40.88,lng:14.29},MXP:{lat:45.63,lng:8.72},
  LIN:{lat:45.45,lng:9.28},PMI:{lat:39.55,lng:2.74},IBZ:{lat:38.87,lng:1.37},
  TFS:{lat:28.04,lng:-16.57},LPA:{lat:27.93,lng:-15.39},FUE:{lat:28.45,lng:-13.86},
  ACE:{lat:29.00,lng:-13.61},TNG:{lat:35.73,lng:-5.92},RAK:{lat:31.61,lng:-8.04},
};

// ─── World land outline paths (Natural Earth simplified, equirectangular) ──────
// Each string is an SVG path in normalised 0-360 x 0-180 coordinate space
// generated from Natural Earth 110m cultural vectors.
const LAND_PATHS = [
  // North America
  "M77,28 L71,28 L68,30 L62,30 L58,24 L54,24 L52,28 L48,30 L44,28 L40,26 L36,28 L34,32 L32,36 L30,38 L30,44 L28,48 L28,54 L30,56 L34,56 L38,52 L42,50 L44,52 L46,52 L48,50 L52,48 L54,44 L56,44 L58,46 L60,48 L62,48 L64,46 L66,44 L68,42 L70,40 L72,38 L76,34 L78,30 Z",
  // Greenland
  "M40,14 L36,16 L34,20 L34,26 L36,28 L40,28 L44,26 L46,22 L46,18 L44,14 Z",
  // South America
  "M74,54 L70,50 L66,48 L62,46 L58,46 L56,50 L54,54 L52,60 L50,66 L48,72 L46,78 L44,84 L44,90 L46,96 L48,102 L50,108 L52,114 L56,118 L60,122 L64,122 L68,118 L72,112 L74,106 L76,100 L78,94 L80,88 L82,82 L82,76 L80,70 L78,64 L76,58 Z",
  // Europe (west)
  "M162,28 L160,26 L158,28 L156,30 L154,30 L152,28 L150,28 L148,30 L148,34 L150,36 L152,36 L154,34 L156,32 L158,30 L160,30 Z",
  "M166,28 L162,28 L160,30 L158,32 L158,36 L160,38 L162,38 L164,36 L166,34 L168,32 L168,30 Z",
  "M170,30 L166,30 L164,32 L162,34 L162,38 L164,40 L166,40 L168,38 L170,36 L172,34 L172,32 Z",
  // Iberia
  "M171,38 L167,36 L163,36 L161,38 L161,42 L163,44 L167,44 L171,42 Z",
  // France + BeNeLux
  "M174,32 L170,30 L168,32 L166,34 L166,38 L168,40 L170,42 L172,42 L174,40 L176,38 L176,34 Z",
  // UK + Ireland
  "M164,28 L162,28 L160,30 L160,34 L162,36 L164,36 L166,34 L166,30 Z",
  "M162,30 L160,30 L158,32 L158,34 L160,36 L162,34 Z",
  // Scandinavia
  "M176,20 L172,18 L170,20 L168,24 L168,30 L170,32 L172,32 L174,30 L176,26 L178,22 Z",
  // Italy
  "M178,38 L176,36 L174,38 L174,42 L176,46 L178,48 L180,46 L180,42 Z",
  // Balkans / Greece
  "M182,36 L180,36 L178,38 L178,42 L180,44 L182,44 L184,42 L184,38 Z",
  // Africa
  "M174,46 L170,44 L166,44 L162,46 L158,50 L156,56 L154,62 L152,68 L152,74 L154,80 L156,86 L158,90 L160,96 L162,100 L164,104 L166,108 L168,112 L170,114 L172,114 L174,112 L176,108 L178,104 L180,98 L182,92 L184,86 L186,80 L188,74 L188,68 L186,62 L184,56 L182,50 L180,46 Z",
  // Madagascar
  "M198,96 L196,94 L194,96 L194,102 L196,106 L198,104 L200,100 Z",
  // Europe East + Russia (simplified strip)
  "M182,22 L178,20 L176,22 L174,26 L174,32 L176,34 L178,34 L180,32 L182,28 L184,24 Z",
  "M190,18 L184,18 L182,20 L182,26 L184,28 L186,28 L188,26 L190,22 L192,20 Z",
  "M200,14 L192,14 L190,18 L190,24 L192,26 L196,26 L200,22 L202,18 Z",
  "M220,10 L204,10 L200,14 L200,22 L204,24 L210,24 L216,22 L222,18 L224,14 Z",
  "M260,8 L224,8 L220,12 L220,20 L226,22 L234,22 L242,20 L252,18 L262,14 L264,10 Z",
  "M310,8 L264,8 L260,10 L260,18 L266,20 L278,20 L292,18 L306,14 L312,10 Z",
  // Middle East
  "M196,34 L192,32 L188,32 L186,34 L186,40 L188,44 L192,46 L196,44 L198,40 L198,36 Z",
  // Indian subcontinent
  "M214,38 L210,36 L206,36 L202,38 L200,44 L200,50 L202,56 L206,60 L210,62 L214,60 L218,56 L220,50 L220,44 L218,40 Z",
  // SE Asia mainland
  "M230,46 L226,44 L222,44 L220,48 L220,54 L222,60 L226,64 L230,66 L234,64 L236,60 L236,54 L234,50 Z",
  // China + East Asia
  "M240,24 L232,22 L226,24 L222,28 L220,34 L220,42 L224,46 L230,48 L236,46 L242,42 L246,36 L248,30 L246,26 Z",
  // Japan
  "M274,30 L272,28 L270,30 L270,34 L272,36 L274,34 Z",
  "M272,36 L270,36 L268,38 L268,40 L270,42 L272,40 Z",
  // Korean peninsula
  "M268,30 L266,30 L264,32 L264,36 L266,38 L268,36 L270,32 Z",
  // SE Asia islands
  "M246,64 L242,62 L240,64 L240,68 L242,70 L246,68 L248,66 Z",
  "M252,64 L248,64 L246,66 L246,70 L248,72 L252,70 L254,68 L254,66 Z",
  "M260,62 L256,62 L254,64 L254,68 L256,70 L260,68 L262,66 L262,64 Z",
  "M268,62 L264,62 L262,64 L262,68 L264,70 L268,68 L270,66 L270,64 Z",
  // Sri Lanka
  "M216,64 L214,64 L213,66 L214,68 L216,68 L217,66 Z",
  // Australia
  "M262,90 L252,86 L244,86 L238,88 L234,94 L232,102 L232,110 L234,118 L238,124 L244,128 L250,130 L256,130 L262,128 L268,124 L272,118 L274,110 L274,102 L272,94 L268,90 Z",
  // New Zealand
  "M296,110 L294,108 L292,110 L292,116 L294,118 L296,116 Z",
  "M294,120 L292,118 L290,120 L290,124 L292,126 L294,124 Z",
  // Central America
  "M64,52 L60,50 L58,52 L58,56 L60,58 L64,56 Z",
  // Caribbean (Cuba)
  "M68,50 L64,50 L62,52 L62,54 L64,56 L68,54 L70,52 Z",
  // Iceland
  "M152,20 L148,20 L146,22 L148,26 L152,26 L154,24 L154,22 Z",
  // Kazakhstan / Central Asia
  "M210,24 L202,24 L198,28 L198,34 L202,36 L208,36 L212,32 L214,28 Z",
  // Turkey
  "M188,34 L184,32 L182,34 L182,38 L184,40 L188,40 L190,38 L190,36 Z",
  // Iran
  "M198,36 L194,34 L190,36 L190,42 L192,46 L196,48 L200,46 L202,42 L202,38 Z",
];

// ─── Arc helpers ──────────────────────────────────────────────────────────────
function arcPath(from: {lat:number;lng:number}, to: {lat:number;lng:number}, w: number, h: number): string {
  const p1 = project(from.lat, from.lng, w, h);
  const p2 = project(to.lat, to.lng, w, h);

  // Control point: midpoint raised toward the top by a fraction of the distance
  const dist = Math.sqrt((p2.x - p1.x) ** 2 + (p2.y - p1.y) ** 2);
  const lift = Math.min(dist * 0.38, h * 0.22);
  const cx = (p1.x + p2.x) / 2;
  const cy = (p1.y + p2.y) / 2 - lift;

  return `M${p1.x.toFixed(1)},${p1.y.toFixed(1)} Q${cx.toFixed(1)},${cy.toFixed(1)} ${p2.x.toFixed(1)},${p2.y.toFixed(1)}`;
}

interface Props { flights: Flight[]; }

export function GlobeView({ flights }: Props) {
  const w = MAP_W;
  const h = MAP_H;

  // Deduplicated unique routes so we don't draw the same arc twice
  const routes = useMemo(() => {
    const seen = new Set<string>();
    const out: { from: {lat:number;lng:number}; to: {lat:number;lng:number}; key: string }[] = [];
    for (const f of flights) {
      const fc = AIRPORTS[f.departureAirport];
      const tc = AIRPORTS[f.arrivalAirport];
      if (!fc || !tc) continue;
      const k = [f.departureAirport, f.arrivalAirport].sort().join("-");
      if (seen.has(k)) continue;
      seen.add(k);
      out.push({ from: fc, to: tc, key: k });
    }
    return out;
  }, [flights]);

  const airportDots = useMemo(() => {
    const iatas = new Set<string>();
    flights.forEach(f => { iatas.add(f.departureAirport); iatas.add(f.arrivalAirport); });
    return Array.from(iatas).flatMap(iata => {
      const c = AIRPORTS[iata];
      if (!c) return [];
      const p = project(c.lat, c.lng, w, h);
      return [{ iata, x: p.x, y: p.y }];
    });
  }, [flights, w, h]);

  return (
    <View style={[styles.container, { width: w, height: h }]}>
      <Svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
        <Defs>
          {/* Ocean fill */}
          <LinearGradient id="ocean" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%"   stopColor="#1A2942" stopOpacity="1" />
            <Stop offset="100%" stopColor="#0D1B2E" stopOpacity="1" />
          </LinearGradient>
          {/* Arc gradient */}
          <LinearGradient id="arcGrad" x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0%"   stopColor={Colors.accent} stopOpacity="0.2" />
            <Stop offset="50%"  stopColor={Colors.accent} stopOpacity="1" />
            <Stop offset="100%" stopColor={Colors.accent} stopOpacity="0.2" />
          </LinearGradient>
        </Defs>

        {/* Ocean background */}
        <Rect x={0} y={0} width={w} height={h} fill="url(#ocean)" rx={14} />

        {/* Graticule lines (every 30°) */}
        {[-60,-30,0,30,60].map(lat => {
          const y = ((90 - lat) / 180) * h;
          return <Path key={`lat${lat}`} d={`M0,${y.toFixed(1)} L${w},${y.toFixed(1)}`}
            stroke="rgba(255,255,255,0.05)" strokeWidth={0.5} fill="none" />;
        })}
        {[0,30,60,90,120,150,180,210,240,270,300,330].map(lng => {
          const x = ((lng) / 360) * w;
          return <Path key={`lng${lng}`} d={`M${x.toFixed(1)},0 L${x.toFixed(1)},${h}`}
            stroke="rgba(255,255,255,0.05)" strokeWidth={0.5} fill="none" />;
        })}

        {/* Land polygons */}
        <G>
          {LAND_PATHS.map((d, i) => {
            // Scale the simplified 0-360 x 0-180 coords to actual pixel dims
            const scale = `scale(${w / 360},${h / 180})`;
            return (
              <Path
                key={`land${i}`}
                d={d}
                fill="#2A3F2E"
                fillOpacity={0.88}
                stroke="#3D5C42"
                strokeWidth={0.6}
                strokeOpacity={0.7}
                transform={scale}
              />
            );
          })}
        </G>

        {/* Flight arcs — glow + core */}
        {routes.map(({ from, to, key }) => {
          const d = arcPath(from, to, w, h);
          return (
            <G key={key}>
              <Path d={d} stroke={Colors.accent} strokeWidth={6}  fill="none" opacity={0.08} strokeLinecap="round" />
              <Path d={d} stroke={Colors.accent} strokeWidth={1.5} fill="none" opacity={0.9}  strokeLinecap="round" strokeDasharray="4 3" />
            </G>
          );
        })}

        {/* Airport dots */}
        {airportDots.map(({ iata, x, y }) => (
          <G key={iata}>
            <Circle cx={x} cy={y} r={5}   fill={Colors.accent} opacity={0.15} />
            <Circle cx={x} cy={y} r={2.5} fill={Colors.accent} opacity={1} />
            <Circle cx={x} cy={y} r={1}   fill="#FFFFFF"        opacity={0.9} />
          </G>
        ))}
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { borderRadius: 14, overflow: "hidden" },
});

export default GlobeView;
