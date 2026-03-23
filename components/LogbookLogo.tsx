/**
 * LogbookLogo
 * -----------
 * Inline SVG logo for the Logbook app.
 *
 * Design language: matches the app's dark card (#16161E) / accent blue (#4F8EF7)
 * colour palette and the DM Sans typeface used throughout the UI.
 *
 * The mark is a stylised open book whose right page shows a miniature
 * flight-arc — a direct visual link between "logbook" and aviation.
 *
 * Usage:
 *   <LogbookLogo size={48} />           — icon only (square)
 *   <LogbookLogo size={36} showName />  — icon + "Logbook" wordmark beside it
 */
import React from "react";
import Svg, {
  G, Path, Circle, Rect, Defs,
  LinearGradient, Stop, ClipPath,
} from "react-native-svg";
import { View, Text, StyleSheet } from "react-native";
import { Colors } from "@/constants/colors";

interface Props {
  /** Height (and width) of the icon mark in logical pixels. Default 40. */
  size?: number;
  /** When true renders the "Logbook" wordmark to the right of the mark. */
  showName?: boolean;
  /** Override text colour (defaults to Colors.text). */
  textColor?: string;
}

export function LogbookLogo({ size = 40, showName = false, textColor }: Props) {
  const s   = size;
  const pad = s * 0.10;   // inner padding
  const bw  = s - pad * 2; // book width
  const bh  = bw * 0.72;  // book height
  const bx  = pad;        // book origin x
  const by  = (s - bh) / 2; // vertically centred

  // Spine x (centre of book)
  const spX = bx + bw / 2;

  // Book corners (left cover)
  const lx1 = bx,      ly1 = by + bh * 0.06;
  const lx2 = spX - 1, ly2 = by;
  const lx3 = spX - 1, ly3 = by + bh;
  const lx4 = bx,      ly4 = by + bh * 0.94;

  // Book corners (right cover)
  const rx1 = spX + 1, ry1 = by;
  const rx2 = bx + bw, ry2 = by + bh * 0.06;
  const rx3 = bx + bw, ry3 = by + bh * 0.94;
  const rx4 = spX + 1, ry4 = by + bh;

  // Flight arc control points on right page
  const arcPad = bw * 0.08;
  const arcY   = by + bh * 0.5;
  const arcX0  = spX + arcPad + 2;
  const arcX3  = bx + bw - arcPad;
  const arcCX  = (arcX0 + arcX3) / 2;
  const arcCY  = arcY - bh * 0.22;

  // Runway dots on right page
  const dotY  = by + bh * 0.74;
  const dotR  = s * 0.028;
  const dotGap = (arcX3 - arcX0) / 3;

  const accentBlue  = Colors.accent  ?? "#4F8EF7";
  const accentDim   = Colors.accentDim ?? "#4F8EF722";
  const cardBg      = Colors.card    ?? "#16161E";
  const borderColor = Colors.border  ?? "#2A2A3A";
  const textCol     = textColor ?? Colors.text ?? "#F0F0F5";
  const textSecCol  = Colors.textSec ?? "#8888AA";

  return (
    <View style={styles.root}>
      <Svg width={s} height={s} viewBox={`0 0 ${s} ${s}`}>
        <Defs>
          {/* Book background gradient */}
          <LinearGradient id="bgGrad" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%"  stopColor={cardBg}  stopOpacity="1" />
            <Stop offset="100%" stopColor="#0E0E18" stopOpacity="1" />
          </LinearGradient>

          {/* Accent gradient for arc */}
          <LinearGradient id="arcGrad" x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0%"   stopColor={accentBlue} stopOpacity="0.5" />
            <Stop offset="50%"  stopColor={accentBlue} stopOpacity="1" />
            <Stop offset="100%" stopColor={accentBlue} stopOpacity="0.5" />
          </LinearGradient>

          {/* Clip to rounded square */}
          <ClipPath id="roundClip">
            <Rect x="0" y="0" width={s} height={s} rx={s * 0.22} ry={s * 0.22} />
          </ClipPath>
        </Defs>

        {/* ── App-icon background ── */}
        <Rect
          x="0" y="0" width={s} height={s}
          rx={s * 0.22} ry={s * 0.22}
          fill="url(#bgGrad)"
        />

        <G clipPath="url(#roundClip)">
          {/* ── Left page ── */}
          <Path
            d={`M${lx1},${ly1} L${lx2},${ly2} L${lx3},${ly3} L${lx4},${ly4} Z`}
            fill={cardBg}
            stroke={borderColor}
            strokeWidth={s * 0.025}
          />

          {/* Left page lines (ruled lines effect) */}
          {[0.28, 0.44, 0.60, 0.76].map((t, i) => {
            const lineY = by + bh * t;
            const xOff  = bw * 0.07;
            return (
              <Path
                key={i}
                d={`M${bx + xOff},${lineY} L${spX - xOff * 0.5},${lineY}`}
                stroke={borderColor}
                strokeWidth={s * 0.018}
                strokeLinecap="round"
              />
            );
          })}

          {/* ── Right page ── */}
          <Path
            d={`M${rx1},${ry1} L${rx2},${ry2} L${rx3},${ry3} L${rx4},${ry4} Z`}
            fill={cardBg}
            stroke={borderColor}
            strokeWidth={s * 0.025}
          />

          {/* ── Spine shadow ── */}
          <Rect
            x={spX - s * 0.03}
            y={by}
            width={s * 0.06}
            height={bh}
            fill={"#000000"}
            opacity={0.35}
          />

          {/* ── Spine highlight line ── */}
          <Path
            d={`M${spX},${by + bh * 0.04} L${spX},${by + bh * 0.96}`}
            stroke={accentBlue}
            strokeWidth={s * 0.022}
            strokeLinecap="round"
            opacity={0.7}
          />

          {/* ── Flight arc on right page ── */}
          {/* Glow */}
          <Path
            d={`M${arcX0},${arcY} Q${arcCX},${arcCY} ${arcX3},${arcY}`}
            fill="none"
            stroke={accentBlue}
            strokeWidth={s * 0.1}
            strokeLinecap="round"
            opacity={0.08}
          />
          {/* Arc line */}
          <Path
            d={`M${arcX0},${arcY} Q${arcCX},${arcCY} ${arcX3},${arcY}`}
            fill="none"
            stroke="url(#arcGrad)"
            strokeWidth={s * 0.038}
            strokeLinecap="round"
          />

          {/* Departure dot */}
          <Circle cx={arcX0} cy={arcY} r={s * 0.042} fill={accentBlue} />
          <Circle cx={arcX0} cy={arcY} r={s * 0.018} fill="#FFFFFF" opacity={0.9} />

          {/* Arrival dot */}
          <Circle cx={arcX3} cy={arcY} r={s * 0.042} fill={accentBlue} />
          <Circle cx={arcX3} cy={arcY} r={s * 0.018} fill="#FFFFFF" opacity={0.9} />

          {/* Tiny runway dots below arc */}
          {[0, 1, 2, 3].map((i) => (
            <Circle
              key={i}
              cx={arcX0 + i * dotGap}
              cy={dotY}
              r={dotR}
              fill={accentBlue}
              opacity={0.25 + i * 0.08}
            />
          ))}
        </G>

        {/* ── Outer border ring ── */}
        <Rect
          x={s * 0.015} y={s * 0.015}
          width={s * 0.97} height={s * 0.97}
          rx={s * 0.21} ry={s * 0.21}
          fill="none"
          stroke={borderColor}
          strokeWidth={s * 0.02}
          opacity={0.6}
        />
      </Svg>

      {showName && (
        <View style={styles.nameWrap}>
          <Text style={[styles.name, { color: textCol, fontSize: s * 0.72 }]}>
            Logbook
          </Text>
          <Text style={[styles.sub, { color: textSecCol, fontSize: s * 0.30 }]}>
            Flight Journal
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root:     { flexDirection: "row", alignItems: "center" },
  nameWrap: { marginLeft: 10, justifyContent: "center" },
  name:     { fontFamily: "DMSans_700Bold",    lineHeight: undefined },
  sub:      { fontFamily: "DMSans_400Regular", marginTop: 1 },
});

export default LogbookLogo;
