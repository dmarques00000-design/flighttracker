/**
 * Returns the URL for an airline's logo from the pics.avs.io CDN,
 * which hosts airline logos by IATA code with broad LCC coverage.
 * Falls back to a brand accent colour for the airplane-icon fallback.
 */
export interface AirlineInfo {
  logoUrl: string;
  color: string; // brand accent colour (hex)
}

const BRAND_COLORS: Record<string, string> = {
  // European
  LX: "#CC0000", LH: "#05164D", BA: "#075AAA", FR: "#073590",
  U2: "#FF6600", EJU: "#FF6600",  // easyJet Europe = same brand as U2
  AF: "#002157", KL: "#00A1DE", IB: "#CC0000",
  VY: "#FD9912", AZ: "#009246", OS: "#CC0000", SK: "#00457C",
  AY: "#00AEEF", TP: "#006633", SN: "#003082", EI: "#169B62",
  TK: "#CC0001", W6: "#C8102E", HV: "#0099CC", TO: "#0099CC",
  BE: "#E2231A", PC: "#D0021B",
  // Middle East
  EK: "#D71921", QR: "#5C0E30", EY: "#BD8B13", GF: "#CC2229", FZ: "#E5002B",
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

/**
 * pics.avs.io only indexes 2-letter IATA codes.
 * Several operating carriers (mostly LCC subsidiaries) use 3-letter codes
 * that the CDN does not recognise — map them to their parent brand code.
 */
const LOGO_CODE_MAP: Record<string, string> = {
  EJU: "U2",   // easyJet Europe  → easyJet
  EZY: "U2",   // easyJet UK      → easyJet
  EZS: "U2",   // easyJet Switzerland → easyJet
  GWT: "U2",   // (legacy easyJet) → easyJet
  MAB: "FR",   // Ryanair DAC     → Ryanair
  RYS: "FR",   // Ryanair Sun     → Ryanair
  RUK: "FR",   // Ryanair UK      → Ryanair
  VLG: "VY",   // Vueling         → Vueling (sometimes filed as 3-letter)
  IBE: "IB",   // Iberia Express  → Iberia
  IBS: "IB",   // Iberia Regional → Iberia
  TAP: "TP",   // TAP Express     → TAP
  CLH: "LH",   // Lufthansa CityLine → Lufthansa
  EWG: "EW",   // Eurowings       (EW is 2-letter)
  DLH: "LH",   // (legacy Lufthansa ICAO-style)
  BEE: "BE",   // Flybe
  WZZ: "W6",   // Wizz Air (ICAO)
  TVS: "TO",   // Transavia France
  HVN: "HV",   // Transavia Netherlands
  TOM: "BY",   // TUI Airways
  AUI: "PS",   // Ukraine International Airlines
  SWR: "LX",   // Swiss (ICAO code)
  DLH2: "LH",  // Lufthansa regional
};

const DEFAULT_COLOR = "#4F8EF0";

/**
 * pics.avs.io provides airline logos by IATA code at:
 * https://pics.avs.io/200/200/<CODE>.png
 * Broader coverage than AirHex, including low-cost carriers (U2, FR, W6, etc.)
 *
 * For 3-letter sub-carrier codes (e.g. EJU for easyJet Europe),
 * we map to the parent 2-letter code so the CDN returns the correct logo.
 */
export function getAirlineInfo(airlineCode: string): AirlineInfo {
  const raw = airlineCode?.toUpperCase() ?? "";
  // Normalise to the CDN-indexable code (parent brand for sub-carriers)
  const cdnCode = LOGO_CODE_MAP[raw] ?? raw;
  return {
    logoUrl: `https://pics.avs.io/200/200/${cdnCode}.png`,
    color: BRAND_COLORS[raw] ?? BRAND_COLORS[cdnCode] ?? DEFAULT_COLOR,
  };
}
