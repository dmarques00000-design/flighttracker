/**
 * Maps IATA airline codes to a representative emoji flag + short brand colour.
 * Used on the flight detail page next to the airline name.
 */
export interface AirlineInfo {
  emoji: string;   // flag or brand emoji
  color: string;   // brand accent colour (hex)
}

const AIRLINE_MAP: Record<string, AirlineInfo> = {
  // European carriers
  LX: { emoji: "🇨🇭", color: "#CC0000" }, // SWISS
  LH: { emoji: "🇩🇪", color: "#05164D" }, // Lufthansa
  BA: { emoji: "🇬🇧", color: "#075AAA" }, // British Airways
  FR: { emoji: "🇮🇪", color: "#073590" }, // Ryanair
  U2: { emoji: "🇬🇧", color: "#FF6600" }, // easyJet
  AF: { emoji: "🇫🇷", color: "#002157" }, // Air France
  KL: { emoji: "🇳🇱", color: "#00A1DE" }, // KLM
  IB: { emoji: "🇪🇸", color: "#CC0000" }, // Iberia
  VY: { emoji: "🇪🇸", color: "#FD9912" }, // Vueling
  AZ: { emoji: "🇮🇹", color: "#009246" }, // ITA Airways
  OS: { emoji: "🇦🇹", color: "#CC0000" }, // Austrian
  SK: { emoji: "🇸🇪", color: "#00457C" }, // SAS
  AY: { emoji: "🇫🇮", color: "#00AEEF" }, // Finnair
  TP: { emoji: "🇵🇹", color: "#006633" }, // TAP Air Portugal
  SN: { emoji: "🇧🇪", color: "#003082" }, // Brussels Airlines
  EI: { emoji: "🇮🇪", color: "#169B62" }, // Aer Lingus
  TK: { emoji: "🇹🇷", color: "#CC0001" }, // Turkish Airlines
  W6: { emoji: "🇭🇺", color: "#C8102E" }, // Wizz Air
  // Middle East
  EK: { emoji: "🇦🇪", color: "#D71921" }, // Emirates
  QR: { emoji: "🇶🇦", color: "#5C0E30" }, // Qatar Airways
  EY: { emoji: "🇦🇪", color: "#BD8B13" }, // Etihad
  GF: { emoji: "🇧🇭", color: "#CC2229" }, // Gulf Air
  // Asian carriers
  SQ: { emoji: "🇸🇬", color: "#F0A500" }, // Singapore Airlines
  CX: { emoji: "🇭🇰", color: "#006564" }, // Cathay Pacific
  JL: { emoji: "🇯🇵", color: "#CC0000" }, // JAL
  NH: { emoji: "🇯🇵", color: "#12559A" }, // ANA
  OZ: { emoji: "🇰🇷", color: "#00418D" }, // Asiana
  KE: { emoji: "🇰🇷", color: "#00256C" }, // Korean Air
  TG: { emoji: "🇹🇭", color: "#51247A" }, // Thai Airways
  MH: { emoji: "🇲🇾", color: "#CC0001" }, // Malaysia Airlines
  GA: { emoji: "🇮🇩", color: "#00529B" }, // Garuda
  AI: { emoji: "🇮🇳", color: "#D4222A" }, // Air India
  // North America
  AA: { emoji: "🇺🇸", color: "#0078D2" }, // American Airlines
  UA: { emoji: "🇺🇸", color: "#005DAA" }, // United
  DL: { emoji: "🇺🇸", color: "#003366" }, // Delta
  WN: { emoji: "🇺🇸", color: "#304CB2" }, // Southwest
  B6: { emoji: "🇺🇸", color: "#003876" }, // JetBlue
  AS: { emoji: "🇺🇸", color: "#01426A" }, // Alaska
  F9: { emoji: "🇺🇸", color: "#006747" }, // Frontier
  NK: { emoji: "🇺🇸", color: "#FFCD41" }, // Spirit
  AC: { emoji: "🇨🇦", color: "#CC0000" }, // Air Canada
  WS: { emoji: "🇨🇦", color: "#1B3D6F" }, // WestJet
  AM: { emoji: "🇲🇽", color: "#006400" }, // Aeromexico
  // Latin America
  LA: { emoji: "🇨🇱", color: "#D4001A" }, // LATAM
  G3: { emoji: "🇧🇷", color: "#F7941E" }, // GOL
  AD: { emoji: "🇧🇷", color: "#009B3A" }, // Azul
  // Oceania
  QF: { emoji: "🇦🇺", color: "#E40000" }, // Qantas
  VA: { emoji: "🇦🇺", color: "#CC0000" }, // Virgin Australia
  NZ: { emoji: "🇳🇿", color: "#000000" }, // Air New Zealand
  // Africa
  ET: { emoji: "🇪🇹", color: "#009A44" }, // Ethiopian
  SA: { emoji: "🇿🇦", color: "#005C97" }, // SAA
  MS: { emoji: "🇪🇬", color: "#C8102E" }, // EgyptAir
  AT: { emoji: "🇲🇦", color: "#CC0000" }, // Royal Air Maroc
  KQ: { emoji: "🇰🇪", color: "#8B1A1A" }, // Kenya Airways
};

const DEFAULT: AirlineInfo = { emoji: "✈️", color: "#4F8EF0" };

export function getAirlineInfo(airlineCode: string): AirlineInfo {
  return AIRLINE_MAP[airlineCode?.toUpperCase()] ?? DEFAULT;
}
