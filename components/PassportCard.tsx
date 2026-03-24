/**
 * PassportCard.tsx
 * Shareable 9:16 story card — dark edition.
 * Exported with PASSPORT_CARD_WIDTH / PASSPORT_CARD_HEIGHT for ViewShot.
 */
import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { PassportStats, CONTINENT_COLORS, ContinentKey } from "@/utils/passport";

export const PASSPORT_CARD_WIDTH  = 1080;
export const PASSPORT_CARD_HEIGHT = 1920;

const BG       = "#08111F"; // near-black navy
const ACCENT   = "#4F8EF0";
const GOLD     = "#F5C842";
const SURFACE  = "rgba(255,255,255,0.06)";
const BORDER   = "rgba(255,255,255,0.10)";
const TEXT     = "#FFFFFF";
const TEXT_SEC = "rgba(255,255,255,0.55)";

interface Props {
  stats: PassportStats;
  username?: string;
}

function StatPill({ value, label, color }: { value: string | number; label: string; color: string }) {
  return (
    <View style={[pill.wrap, { borderColor: color + "55" }]}>
      <Text style={[pill.value, { color }]}>{value}</Text>
      <Text style={pill.label}>{label}</Text>
    </View>
  );
}

function ContinentBar({ continent, count, total }: { continent: ContinentKey; count: number; total: number }) {
  const color = CONTINENT_COLORS[continent];
  const pct   = total > 0 ? (count / total) * 100 : 0;
  return (
    <View style={bar.row}>
      <Text style={bar.label} numberOfLines={1}>{continent}</Text>
      <View style={bar.track}>
        <View style={[bar.fill, { width: `${pct}%` as any, backgroundColor: color }]} />
      </View>
      <Text style={[bar.count, { color }]}>{count}</Text>
    </View>
  );
}

export default function PassportCard({ stats, username }: Props) {
  const flagsToShow = stats.countries.slice(0, 30).map((c) => c.flag);
  const maxContinent = Math.max(...Object.values(stats.continentCounts), 1);

  const continentOrder: ContinentKey[] = [
    "Europe", "Asia", "North America", "Middle East",
    "South America", "Africa", "Oceania",
  ];

  return (
    <View style={card.container}>
      {/* ── decorative globe ring ── */}
      <View style={card.globeOuter}>
        <View style={card.globeInner} />
      </View>

      {/* ── header ── */}
      <View style={card.header}>
        <Text style={card.wordmark}>LOGBOOK</Text>
        <View style={card.headerDivider} />
        <Text style={card.subhead}>TRAVEL PASSPORT</Text>
      </View>

      {/* ── hero coverage ── */}
      <View style={card.hero}>
        <Text style={card.heroNum}>{stats.totalCountries}</Text>
        <Text style={card.heroLabel}>countries visited</Text>
        <Text style={card.heroCoverage}>
          {stats.worldCoveragePercent}% of the world
        </Text>
      </View>

      {/* ── stat pills ── */}
      <View style={card.pillRow}>
        <StatPill value={stats.totalAirports}   label="airports"   color={ACCENT} />
        <StatPill value={stats.totalContinents} label="continents" color={GOLD}  />
      </View>

      {/* ── flag mosaic ── */}
      {flagsToShow.length > 0 && (
        <View style={card.flagsSection}>
          <Text style={card.sectionTitle}>FLAGS COLLECTED</Text>
          <View style={card.flagGrid}>
            {flagsToShow.map((f, i) => (
              <View key={i} style={card.flagCell}>
                <Text style={card.flagEmoji}>{f}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* ── continent breakdown bars ── */}
      <View style={card.barsSection}>
        <Text style={card.sectionTitle}>BY CONTINENT</Text>
        {continentOrder
          .filter((c) => (stats.continentCounts[c] ?? 0) > 0)
          .map((c) => (
            <ContinentBar
              key={c}
              continent={c}
              count={stats.continentCounts[c] ?? 0}
              total={maxContinent}
            />
          ))}
      </View>

      {/* ── footer ── */}
      <View style={card.footer}>
        {username ? (
          <Text style={card.footerUser}>@{username}</Text>
        ) : null}
        <Text style={card.footerApp}>logbook.app</Text>
      </View>
    </View>
  );
}

const card = StyleSheet.create({
  container: {
    width: PASSPORT_CARD_WIDTH,
    height: PASSPORT_CARD_HEIGHT,
    backgroundColor: BG,
    padding: 80,
    justifyContent: "space-between",
    overflow: "hidden",
  },
  // decorative globe
  globeOuter: {
    position: "absolute",
    width: 900, height: 900,
    borderRadius: 450,
    borderWidth: 1.5,
    borderColor: "rgba(79,142,240,0.12)",
    top: -200, right: -260,
  },
  globeInner: {
    position: "absolute",
    width: 600, height: 600,
    borderRadius: 300,
    borderWidth: 1,
    borderColor: "rgba(79,142,240,0.08)",
    top: 150, left: 150,
  },
  // header
  header: { alignItems: "center", marginTop: 20, gap: 16 },
  wordmark: {
    fontSize: 52, color: TEXT, letterSpacing: 14,
    fontWeight: "700",
  },
  headerDivider: {
    width: 120, height: 2,
    backgroundColor: ACCENT,
    borderRadius: 1,
  },
  subhead: {
    fontSize: 24, color: TEXT_SEC, letterSpacing: 8,
    fontWeight: "400",
  },
  // hero
  hero: { alignItems: "center", marginTop: 40 },
  heroNum: {
    fontSize: 200, color: TEXT, lineHeight: 210,
    fontWeight: "800", letterSpacing: -4,
  },
  heroLabel: {
    fontSize: 38, color: TEXT_SEC,
    fontWeight: "300", letterSpacing: 4,
    textTransform: "uppercase", marginTop: -12,
  },
  heroCoverage: {
    fontSize: 28, color: ACCENT,
    fontWeight: "600", letterSpacing: 1,
    marginTop: 16,
  },
  // pills
  pillRow: {
    flexDirection: "row", justifyContent: "center",
    gap: 32, marginTop: 32,
  },
  // flags
  flagsSection: { marginTop: 40 },
  sectionTitle: {
    fontSize: 20, color: TEXT_SEC,
    letterSpacing: 6, fontWeight: "500",
    textTransform: "uppercase", marginBottom: 20,
  },
  flagGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  flagCell: {
    width: 76, height: 76,
    backgroundColor: SURFACE,
    borderRadius: 16,
    borderWidth: 1, borderColor: BORDER,
    alignItems: "center", justifyContent: "center",
  },
  flagEmoji: { fontSize: 38 },
  // bars
  barsSection: { marginTop: 40 },
  // footer
  footer: { alignItems: "center", gap: 8 },
  footerUser: { fontSize: 28, color: TEXT_SEC, fontWeight: "400" },
  footerApp: { fontSize: 22, color: ACCENT, letterSpacing: 2, fontWeight: "600" },
});

const pill = StyleSheet.create({
  wrap: {
    alignItems: "center",
    backgroundColor: SURFACE,
    borderRadius: 32,
    borderWidth: 1,
    paddingHorizontal: 56, paddingVertical: 28,
    minWidth: 220,
  },
  value: { fontSize: 72, fontWeight: "800", lineHeight: 80 },
  label: { fontSize: 24, color: TEXT_SEC, fontWeight: "400", letterSpacing: 3, textTransform: "uppercase", marginTop: 4 },
});

const bar = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 20, marginBottom: 18 },
  label: { fontSize: 24, color: TEXT_SEC, width: 240, fontWeight: "400" },
  track: { flex: 1, height: 8, backgroundColor: SURFACE, borderRadius: 4, overflow: "hidden" },
  fill:  { height: 8, borderRadius: 4 },
  count: { fontSize: 28, fontWeight: "700", width: 56, textAlign: "right" },
});
