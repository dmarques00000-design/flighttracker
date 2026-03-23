/**
 * Returns the URL for an airline's logo from the AirHex CDN,
 * which hosts high-quality airline logos by IATA code.
 * Falls back to a placeholder colour per airline for consistent tinting.
 */
export interface AirlineInfo {
  logoUrl: string;
  color: string; // brand accent colour (hex)
}

const BRAND_COLORS: Record<string, string> = {
  // European
  LX: "#CC0000", LH: "#05164D", BA: "#075AAA", FR: "#073590",
  U2: "#FF6600", AF: "#002157", KL: "#00A1DE", IB: "#CC0000",
  VY: "#FD9912", AZ: "#009246", OS: "#CC0000", SK: "#00457C",
  AY: "#00AEEF", TP: "#006633", SN: "#003082", EI: "#169B62",
  TK: "#CC0001", W6: "#C8102E", BE: "#E2231A", PC: "#D0021B",
  // Middle East
  EK: "#D71921", QR: "#5C0E30", EY: "#BD8B13", GF: "#CC2229",
  // Asian
  SQ: "#F0A500", CX: "#006564", JL: "#CC0000", NH: "#12559A",
  OZ: "#00418D", KE: "#00256C", TG: "#51247A", MH: "#CC0001",
  GA: "#00529B", AI: "#D4222A", BR: "#009B77", CI: "#003087",
  // North America
  AA: "#0078D2", UA: "#005DAA", DL: "#003366", WN: "#304CB2",
  B6: "#003876", AS: "#01426A", F9: "#006747", NK: "#FFCD41",
  AC: "#CC0000", WS: "#1B3D6F", AM: "#006400",
  // Latin America
  LA: "#D4001A", G3: "#F7941E", AD: "#009B3A",
  // Oceania
  QF: "#E40000", VA: "#CC0000", NZ: "#000000",
  // Africa
  ET: "#009A44", SA: "#005C97", MS: "#C8102E", AT: "#CC0000", KQ: "#8B1A1A",
};

const DEFAULT_COLOR = "#4F8EF0";

/**
 * AirHex provides airline logos by IATA code at:
 * https://content.airhex.com/content/logos/airlines_<CODE>_200_200_r.png
 */
export function getAirlineInfo(airlineCode: string): AirlineInfo {
  const code = airlineCode?.toUpperCase() ?? "";
  return {
    logoUrl: `https://content.airhex.com/content/logos/airlines_${code}_200_200_r.png`,
    color: BRAND_COLORS[code] ?? DEFAULT_COLOR,
  };
}
