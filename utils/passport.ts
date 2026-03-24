/**
 * passport.ts
 * Maps IATA airport codes → { city, country, countryCode, flag, continent }
 * and derives passport-style stats from a Flight[].
 */

export interface AirportInfo {
  city: string;
  country: string;
  countryCode: string; // ISO-3166-1 alpha-2
  flag: string;        // emoji flag
  continent: ContinentKey;
}

export type ContinentKey =
  | "Europe"
  | "North America"
  | "South America"
  | "Asia"
  | "Africa"
  | "Oceania"
  | "Middle East";

export const CONTINENT_COLORS: Record<ContinentKey, string> = {
  Europe:          "#4F8EF0",
  "North America": "#10B981",
  "South America": "#F59E0B",
  Asia:            "#8B5CF6",
  Africa:          "#EF4444",
  Oceania:         "#06B6D4",
  "Middle East":   "#F97316",
};

// ~300 busiest / most-traveled airports worldwide
const AIRPORT_DB: Record<string, AirportInfo> = {
  // ── Europe ──────────────────────────────────────────────────────────────
  LHR: { city: "London",       country: "United Kingdom", countryCode: "GB", flag: "🇬🇧", continent: "Europe" },
  LGW: { city: "London",       country: "United Kingdom", countryCode: "GB", flag: "🇬🇧", continent: "Europe" },
  STN: { city: "London",       country: "United Kingdom", countryCode: "GB", flag: "🇬🇧", continent: "Europe" },
  LTN: { city: "London",       country: "United Kingdom", countryCode: "GB", flag: "🇬🇧", continent: "Europe" },
  MAN: { city: "Manchester",   country: "United Kingdom", countryCode: "GB", flag: "🇬🇧", continent: "Europe" },
  EDI: { city: "Edinburgh",    country: "United Kingdom", countryCode: "GB", flag: "🇬🇧", continent: "Europe" },
  BHX: { city: "Birmingham",   country: "United Kingdom", countryCode: "GB", flag: "🇬🇧", continent: "Europe" },
  GLA: { city: "Glasgow",      country: "United Kingdom", countryCode: "GB", flag: "🇬🇧", continent: "Europe" },
  CDG: { city: "Paris",        country: "France",         countryCode: "FR", flag: "🇫🇷", continent: "Europe" },
  ORY: { city: "Paris",        country: "France",         countryCode: "FR", flag: "🇫🇷", continent: "Europe" },
  NCE: { city: "Nice",         country: "France",         countryCode: "FR", flag: "🇫🇷", continent: "Europe" },
  LYS: { city: "Lyon",         country: "France",         countryCode: "FR", flag: "🇫🇷", continent: "Europe" },
  MRS: { city: "Marseille",    country: "France",         countryCode: "FR", flag: "🇫🇷", continent: "Europe" },
  FRA: { city: "Frankfurt",    country: "Germany",        countryCode: "DE", flag: "🇩🇪", continent: "Europe" },
  MUC: { city: "Munich",       country: "Germany",        countryCode: "DE", flag: "🇩🇪", continent: "Europe" },
  BER: { city: "Berlin",       country: "Germany",        countryCode: "DE", flag: "🇩🇪", continent: "Europe" },
  DUS: { city: "Düsseldorf",   country: "Germany",        countryCode: "DE", flag: "🇩🇪", continent: "Europe" },
  HAM: { city: "Hamburg",      country: "Germany",        countryCode: "DE", flag: "🇩🇪", continent: "Europe" },
  STR: { city: "Stuttgart",    country: "Germany",        countryCode: "DE", flag: "🇩🇪", continent: "Europe" },
  CGN: { city: "Cologne",      country: "Germany",        countryCode: "DE", flag: "🇩🇪", continent: "Europe" },
  AMS: { city: "Amsterdam",    country: "Netherlands",    countryCode: "NL", flag: "🇳🇱", continent: "Europe" },
  EIN: { city: "Eindhoven",    country: "Netherlands",    countryCode: "NL", flag: "🇳🇱", continent: "Europe" },
  MAD: { city: "Madrid",       country: "Spain",          countryCode: "ES", flag: "🇪🇸", continent: "Europe" },
  BCN: { city: "Barcelona",    country: "Spain",          countryCode: "ES", flag: "🇪🇸", continent: "Europe" },
  AGP: { city: "Málaga",       country: "Spain",          countryCode: "ES", flag: "🇪🇸", continent: "Europe" },
  PMI: { city: "Palma",        country: "Spain",          countryCode: "ES", flag: "🇪🇸", continent: "Europe" },
  VLC: { city: "Valencia",     country: "Spain",          countryCode: "ES", flag: "🇪🇸", continent: "Europe" },
  SVQ: { city: "Seville",      country: "Spain",          countryCode: "ES", flag: "🇪🇸", continent: "Europe" },
  FCO: { city: "Rome",         country: "Italy",          countryCode: "IT", flag: "🇮🇹", continent: "Europe" },
  MXP: { city: "Milan",        country: "Italy",          countryCode: "IT", flag: "🇮🇹", continent: "Europe" },
  LIN: { city: "Milan",        country: "Italy",          countryCode: "IT", flag: "🇮🇹", continent: "Europe" },
  VCE: { city: "Venice",       country: "Italy",          countryCode: "IT", flag: "🇮🇹", continent: "Europe" },
  NAP: { city: "Naples",       country: "Italy",          countryCode: "IT", flag: "🇮🇹", continent: "Europe" },
  BLQ: { city: "Bologna",      country: "Italy",          countryCode: "IT", flag: "🇮🇹", continent: "Europe" },
  ZRH: { city: "Zurich",       country: "Switzerland",    countryCode: "CH", flag: "🇨🇭", continent: "Europe" },
  GVA: { city: "Geneva",       country: "Switzerland",    countryCode: "CH", flag: "🇨🇭", continent: "Europe" },
  BSL: { city: "Basel",        country: "Switzerland",    countryCode: "CH", flag: "🇨🇭", continent: "Europe" },
  VIE: { city: "Vienna",       country: "Austria",        countryCode: "AT", flag: "🇦🇹", continent: "Europe" },
  SZG: { city: "Salzburg",     country: "Austria",        countryCode: "AT", flag: "🇦🇹", continent: "Europe" },
  BRU: { city: "Brussels",     country: "Belgium",        countryCode: "BE", flag: "🇧🇪", continent: "Europe" },
  CRL: { city: "Brussels",     country: "Belgium",        countryCode: "BE", flag: "🇧🇪", continent: "Europe" },
  CPH: { city: "Copenhagen",   country: "Denmark",        countryCode: "DK", flag: "🇩🇰", continent: "Europe" },
  ARN: { city: "Stockholm",    country: "Sweden",         countryCode: "SE", flag: "🇸🇪", continent: "Europe" },
  GOT: { city: "Gothenburg",   country: "Sweden",         countryCode: "SE", flag: "🇸🇪", continent: "Europe" },
  OSL: { city: "Oslo",         country: "Norway",         countryCode: "NO", flag: "🇳🇴", continent: "Europe" },
  BGO: { city: "Bergen",       country: "Norway",         countryCode: "NO", flag: "🇳🇴", continent: "Europe" },
  HEL: { city: "Helsinki",     country: "Finland",        countryCode: "FI", flag: "🇫🇮", continent: "Europe" },
  RIX: { city: "Riga",         country: "Latvia",         countryCode: "LV", flag: "🇱🇻", continent: "Europe" },
  TLL: { city: "Tallinn",      country: "Estonia",        countryCode: "EE", flag: "🇪🇪", continent: "Europe" },
  VNO: { city: "Vilnius",      country: "Lithuania",      countryCode: "LT", flag: "🇱🇹", continent: "Europe" },
  WAW: { city: "Warsaw",       country: "Poland",         countryCode: "PL", flag: "🇵🇱", continent: "Europe" },
  KRK: { city: "Kraków",       country: "Poland",         countryCode: "PL", flag: "🇵🇱", continent: "Europe" },
  PRG: { city: "Prague",       country: "Czech Republic", countryCode: "CZ", flag: "🇨🇿", continent: "Europe" },
  BTS: { city: "Bratislava",   country: "Slovakia",       countryCode: "SK", flag: "🇸🇰", continent: "Europe" },
  BUD: { city: "Budapest",     country: "Hungary",        countryCode: "HU", flag: "🇭🇺", continent: "Europe" },
  OTP: { city: "Bucharest",    country: "Romania",        countryCode: "RO", flag: "🇷🇴", continent: "Europe" },
  SOF: { city: "Sofia",        country: "Bulgaria",       countryCode: "BG", flag: "🇧🇬", continent: "Europe" },
  ATH: { city: "Athens",       country: "Greece",         countryCode: "GR", flag: "🇬🇷", continent: "Europe" },
  SKG: { city: "Thessaloniki", country: "Greece",         countryCode: "GR", flag: "🇬🇷", continent: "Europe" },
  HER: { city: "Heraklion",    country: "Greece",         countryCode: "GR", flag: "🇬🇷", continent: "Europe" },
  LIS: { city: "Lisbon",       country: "Portugal",       countryCode: "PT", flag: "🇵🇹", continent: "Europe" },
  OPO: { city: "Porto",        country: "Portugal",       countryCode: "PT", flag: "🇵🇹", continent: "Europe" },
  FAO: { city: "Faro",         country: "Portugal",       countryCode: "PT", flag: "🇵🇹", continent: "Europe" },
  DUB: { city: "Dublin",       country: "Ireland",        countryCode: "IE", flag: "🇮🇪", continent: "Europe" },
  SNN: { city: "Shannon",      country: "Ireland",        countryCode: "IE", flag: "🇮🇪", continent: "Europe" },
  OST: { city: "Ostend",       country: "Belgium",        countryCode: "BE", flag: "🇧🇪", continent: "Europe" },
  LUX: { city: "Luxembourg",   country: "Luxembourg",     countryCode: "LU", flag: "🇱🇺", continent: "Europe" },
  GEN: { city: "Genoa",        country: "Italy",          countryCode: "IT", flag: "🇮🇹", continent: "Europe" },
  TRN: { city: "Turin",        country: "Italy",          countryCode: "IT", flag: "🇮🇹", continent: "Europe" },
  PSA: { city: "Pisa",         country: "Italy",          countryCode: "IT", flag: "🇮🇹", continent: "Europe" },
  BRI: { city: "Bari",         country: "Italy",          countryCode: "IT", flag: "🇮🇹", continent: "Europe" },
  CTA: { city: "Catania",      country: "Italy",          countryCode: "IT", flag: "🇮🇹", continent: "Europe" },
  PMO: { city: "Palermo",      country: "Italy",          countryCode: "IT", flag: "🇮🇹", continent: "Europe" },
  IST: { city: "Istanbul",     country: "Turkey",         countryCode: "TR", flag: "🇹🇷", continent: "Europe" },
  SAW: { city: "Istanbul",     country: "Turkey",         countryCode: "TR", flag: "🇹🇷", continent: "Europe" },
  AYT: { city: "Antalya",      country: "Turkey",         countryCode: "TR", flag: "🇹🇷", continent: "Europe" },
  ESB: { city: "Ankara",       country: "Turkey",         countryCode: "TR", flag: "🇹🇷", continent: "Europe" },
  ZAG: { city: "Zagreb",       country: "Croatia",        countryCode: "HR", flag: "🇭🇷", continent: "Europe" },
  SPU: { city: "Split",        country: "Croatia",        countryCode: "HR", flag: "🇭🇷", continent: "Europe" },
  DBV: { city: "Dubrovnik",    country: "Croatia",        countryCode: "HR", flag: "🇭🇷", continent: "Europe" },
  LJU: { city: "Ljubljana",    country: "Slovenia",       countryCode: "SI", flag: "🇸🇮", continent: "Europe" },
  SKP: { city: "Skopje",       country: "North Macedonia",countryCode: "MK", flag: "🇲🇰", continent: "Europe" },
  BEG: { city: "Belgrade",     country: "Serbia",         countryCode: "RS", flag: "🇷🇸", continent: "Europe" },
  TIV: { city: "Tivat",        country: "Montenegro",     countryCode: "ME", flag: "🇲🇪", continent: "Europe" },
  TIA: { city: "Tirana",       country: "Albania",        countryCode: "AL", flag: "🇦🇱", continent: "Europe" },
  SJJ: { city: "Sarajevo",     country: "Bosnia",         countryCode: "BA", flag: "🇧🇦", continent: "Europe" },
  KIV: { city: "Chișinău",     country: "Moldova",        countryCode: "MD", flag: "🇲🇩", continent: "Europe" },
  KBP: { city: "Kyiv",         country: "Ukraine",        countryCode: "UA", flag: "🇺🇦", continent: "Europe" },
  SVO: { city: "Moscow",       country: "Russia",         countryCode: "RU", flag: "🇷🇺", continent: "Europe" },
  DME: { city: "Moscow",       country: "Russia",         countryCode: "RU", flag: "🇷🇺", continent: "Europe" },
  LED: { city: "St Petersburg",country: "Russia",         countryCode: "RU", flag: "🇷🇺", continent: "Europe" },
  RKV: { city: "Reykjavik",    country: "Iceland",        countryCode: "IS", flag: "🇮🇸", continent: "Europe" },
  KEF: { city: "Reykjavik",    country: "Iceland",        countryCode: "IS", flag: "🇮🇸", continent: "Europe" },
  GRO: { city: "Girona",       country: "Spain",          countryCode: "ES", flag: "🇪🇸", continent: "Europe" },
  IBZ: { city: "Ibiza",        country: "Spain",          countryCode: "ES", flag: "🇪🇸", continent: "Europe" },
  TFS: { city: "Tenerife",     country: "Spain",          countryCode: "ES", flag: "🇪🇸", continent: "Europe" },
  LPA: { city: "Las Palmas",   country: "Spain",          countryCode: "ES", flag: "🇪🇸", continent: "Europe" },
  FUE: { city: "Fuerteventura",country: "Spain",          countryCode: "ES", flag: "🇪🇸", continent: "Europe" },
  ACE: { city: "Lanzarote",    country: "Spain",          countryCode: "ES", flag: "🇪🇸", continent: "Europe" },
  RHO: { city: "Rhodes",       country: "Greece",         countryCode: "GR", flag: "🇬🇷", continent: "Europe" },
  CFU: { city: "Corfu",        country: "Greece",         countryCode: "GR", flag: "🇬🇷", continent: "Europe" },
  MLA: { city: "Malta",        country: "Malta",          countryCode: "MT", flag: "🇲🇹", continent: "Europe" },
  NIC: { city: "Nicosia",      country: "Cyprus",         countryCode: "CY", flag: "🇨🇾", continent: "Europe" },
  LCA: { city: "Larnaca",      country: "Cyprus",         countryCode: "CY", flag: "🇨🇾", continent: "Europe" },
  // ── North America ─────────────────────────────────────────────────────
  JFK: { city: "New York",     country: "United States",  countryCode: "US", flag: "🇺🇸", continent: "North America" },
  LGA: { city: "New York",     country: "United States",  countryCode: "US", flag: "🇺🇸", continent: "North America" },
  EWR: { city: "New York",     country: "United States",  countryCode: "US", flag: "🇺🇸", continent: "North America" },
  LAX: { city: "Los Angeles",  country: "United States",  countryCode: "US", flag: "🇺🇸", continent: "North America" },
  SFO: { city: "San Francisco",country: "United States",  countryCode: "US", flag: "🇺🇸", continent: "North America" },
  ORD: { city: "Chicago",      country: "United States",  countryCode: "US", flag: "🇺🇸", continent: "North America" },
  MDW: { city: "Chicago",      country: "United States",  countryCode: "US", flag: "🇺🇸", continent: "North America" },
  ATL: { city: "Atlanta",      country: "United States",  countryCode: "US", flag: "🇺🇸", continent: "North America" },
  DFW: { city: "Dallas",       country: "United States",  countryCode: "US", flag: "🇺🇸", continent: "North America" },
  MIA: { city: "Miami",        country: "United States",  countryCode: "US", flag: "🇺🇸", continent: "North America" },
  SEA: { city: "Seattle",      country: "United States",  countryCode: "US", flag: "🇺🇸", continent: "North America" },
  BOS: { city: "Boston",       country: "United States",  countryCode: "US", flag: "🇺🇸", continent: "North America" },
  DEN: { city: "Denver",       country: "United States",  countryCode: "US", flag: "🇺🇸", continent: "North America" },
  LAS: { city: "Las Vegas",    country: "United States",  countryCode: "US", flag: "🇺🇸", continent: "North America" },
  PHX: { city: "Phoenix",      country: "United States",  countryCode: "US", flag: "🇺🇸", continent: "North America" },
  IAH: { city: "Houston",      country: "United States",  countryCode: "US", flag: "🇺🇸", continent: "North America" },
  IAD: { city: "Washington",   country: "United States",  countryCode: "US", flag: "🇺🇸", continent: "North America" },
  DCA: { city: "Washington",   country: "United States",  countryCode: "US", flag: "🇺🇸", continent: "North America" },
  MSP: { city: "Minneapolis",  country: "United States",  countryCode: "US", flag: "🇺🇸", continent: "North America" },
  DTW: { city: "Detroit",      country: "United States",  countryCode: "US", flag: "🇺🇸", continent: "North America" },
  PHL: { city: "Philadelphia", country: "United States",  countryCode: "US", flag: "🇺🇸", continent: "North America" },
  CLT: { city: "Charlotte",    country: "United States",  countryCode: "US", flag: "🇺🇸", continent: "North America" },
  SAN: { city: "San Diego",    country: "United States",  countryCode: "US", flag: "🇺🇸", continent: "North America" },
  PDX: { city: "Portland",     country: "United States",  countryCode: "US", flag: "🇺🇸", continent: "North America" },
  SLC: { city: "Salt Lake City",country: "United States", countryCode: "US", flag: "🇺🇸", continent: "North America" },
  AUS: { city: "Austin",       country: "United States",  countryCode: "US", flag: "🇺🇸", continent: "North America" },
  MCO: { city: "Orlando",      country: "United States",  countryCode: "US", flag: "🇺🇸", continent: "North America" },
  TPA: { city: "Tampa",        country: "United States",  countryCode: "US", flag: "🇺🇸", continent: "North America" },
  MSY: { city: "New Orleans",  country: "United States",  countryCode: "US", flag: "🇺🇸", continent: "North America" },
  HNL: { city: "Honolulu",     country: "United States",  countryCode: "US", flag: "🇺🇸", continent: "North America" },
  ANC: { city: "Anchorage",    country: "United States",  countryCode: "US", flag: "🇺🇸", continent: "North America" },
  YYZ: { city: "Toronto",      country: "Canada",         countryCode: "CA", flag: "🇨🇦", continent: "North America" },
  YVR: { city: "Vancouver",    country: "Canada",         countryCode: "CA", flag: "🇨🇦", continent: "North America" },
  YUL: { city: "Montreal",     country: "Canada",         countryCode: "CA", flag: "🇨🇦", continent: "North America" },
  YYC: { city: "Calgary",      country: "Canada",         countryCode: "CA", flag: "🇨🇦", continent: "North America" },
  YEG: { city: "Edmonton",     country: "Canada",         countryCode: "CA", flag: "🇨🇦", continent: "North America" },
  YOW: { city: "Ottawa",       country: "Canada",         countryCode: "CA", flag: "🇨🇦", continent: "North America" },
  MEX: { city: "Mexico City",  country: "Mexico",         countryCode: "MX", flag: "🇲🇽", continent: "North America" },
  CUN: { city: "Cancún",       country: "Mexico",         countryCode: "MX", flag: "🇲🇽", continent: "North America" },
  GDL: { city: "Guadalajara",  country: "Mexico",         countryCode: "MX", flag: "🇲🇽", continent: "North America" },
  MTY: { city: "Monterrey",    country: "Mexico",         countryCode: "MX", flag: "🇲🇽", continent: "North America" },
  // ── South America ─────────────────────────────────────────────────────
  GRU: { city: "São Paulo",    country: "Brazil",         countryCode: "BR", flag: "🇧🇷", continent: "South America" },
  GIG: { city: "Rio de Janeiro",country: "Brazil",        countryCode: "BR", flag: "🇧🇷", continent: "South America" },
  BSB: { city: "Brasília",     country: "Brazil",         countryCode: "BR", flag: "🇧🇷", continent: "South America" },
  EZE: { city: "Buenos Aires", country: "Argentina",      countryCode: "AR", flag: "🇦🇷", continent: "South America" },
  AEP: { city: "Buenos Aires", country: "Argentina",      countryCode: "AR", flag: "🇦🇷", continent: "South America" },
  SCL: { city: "Santiago",     country: "Chile",          countryCode: "CL", flag: "🇨🇱", continent: "South America" },
  BOG: { city: "Bogotá",       country: "Colombia",       countryCode: "CO", flag: "🇨🇴", continent: "South America" },
  LIM: { city: "Lima",         country: "Peru",           countryCode: "PE", flag: "🇵🇪", continent: "South America" },
  UIO: { city: "Quito",        country: "Ecuador",        countryCode: "EC", flag: "🇪🇨", continent: "South America" },
  GYE: { city: "Guayaquil",    country: "Ecuador",        countryCode: "EC", flag: "🇪🇨", continent: "South America" },
  CCS: { city: "Caracas",      country: "Venezuela",      countryCode: "VE", flag: "🇻🇪", continent: "South America" },
  MVD: { city: "Montevideo",   country: "Uruguay",        countryCode: "UY", flag: "🇺🇾", continent: "South America" },
  ASU: { city: "Asunción",     country: "Paraguay",       countryCode: "PY", flag: "🇵🇾", continent: "South America" },
  LPB: { city: "La Paz",       country: "Bolivia",        countryCode: "BO", flag: "🇧🇴", continent: "South America" },
  // ── Asia ──────────────────────────────────────────────────────────────
  PEK: { city: "Beijing",      country: "China",          countryCode: "CN", flag: "🇨🇳", continent: "Asia" },
  PKX: { city: "Beijing",      country: "China",          countryCode: "CN", flag: "🇨🇳", continent: "Asia" },
  PVG: { city: "Shanghai",     country: "China",          countryCode: "CN", flag: "🇨🇳", continent: "Asia" },
  SHA: { city: "Shanghai",     country: "China",          countryCode: "CN", flag: "🇨🇳", continent: "Asia" },
  CAN: { city: "Guangzhou",    country: "China",          countryCode: "CN", flag: "🇨🇳", continent: "Asia" },
  SZX: { city: "Shenzhen",     country: "China",          countryCode: "CN", flag: "🇨🇳", continent: "Asia" },
  CTU: { city: "Chengdu",      country: "China",          countryCode: "CN", flag: "🇨🇳", continent: "Asia" },
  HKG: { city: "Hong Kong",    country: "Hong Kong",      countryCode: "HK", flag: "🇭🇰", continent: "Asia" },
  TPE: { city: "Taipei",       country: "Taiwan",         countryCode: "TW", flag: "🇹🇼", continent: "Asia" },
  NRT: { city: "Tokyo",        country: "Japan",          countryCode: "JP", flag: "🇯🇵", continent: "Asia" },
  HND: { city: "Tokyo",        country: "Japan",          countryCode: "JP", flag: "🇯🇵", continent: "Asia" },
  KIX: { city: "Osaka",        country: "Japan",          countryCode: "JP", flag: "🇯🇵", continent: "Asia" },
  NGO: { city: "Nagoya",       country: "Japan",          countryCode: "JP", flag: "🇯🇵", continent: "Asia" },
  CTS: { city: "Sapporo",      country: "Japan",          countryCode: "JP", flag: "🇯🇵", continent: "Asia" },
  ICN: { city: "Seoul",        country: "South Korea",    countryCode: "KR", flag: "🇰🇷", continent: "Asia" },
  GMP: { city: "Seoul",        country: "South Korea",    countryCode: "KR", flag: "🇰🇷", continent: "Asia" },
  SIN: { city: "Singapore",    country: "Singapore",      countryCode: "SG", flag: "🇸🇬", continent: "Asia" },
  BKK: { city: "Bangkok",      country: "Thailand",       countryCode: "TH", flag: "🇹🇭", continent: "Asia" },
  DMK: { city: "Bangkok",      country: "Thailand",       countryCode: "TH", flag: "🇹🇭", continent: "Asia" },
  HKT: { city: "Phuket",       country: "Thailand",       countryCode: "TH", flag: "🇹🇭", continent: "Asia" },
  KUL: { city: "Kuala Lumpur", country: "Malaysia",       countryCode: "MY", flag: "🇲🇾", continent: "Asia" },
  CGK: { city: "Jakarta",      country: "Indonesia",      countryCode: "ID", flag: "🇮🇩", continent: "Asia" },
  DPS: { city: "Bali",         country: "Indonesia",      countryCode: "ID", flag: "🇮🇩", continent: "Asia" },
  MNL: { city: "Manila",       country: "Philippines",    countryCode: "PH", flag: "🇵🇭", continent: "Asia" },
  CEB: { city: "Cebu",         country: "Philippines",    countryCode: "PH", flag: "🇵🇭", continent: "Asia" },
  SGN: { city: "Ho Chi Minh",  country: "Vietnam",        countryCode: "VN", flag: "🇻🇳", continent: "Asia" },
  HAN: { city: "Hanoi",        country: "Vietnam",        countryCode: "VN", flag: "🇻🇳", continent: "Asia" },
  DAD: { city: "Da Nang",      country: "Vietnam",        countryCode: "VN", flag: "🇻🇳", continent: "Asia" },
  RGN: { city: "Yangon",       country: "Myanmar",        countryCode: "MM", flag: "🇲🇲", continent: "Asia" },
  PNH: { city: "Phnom Penh",   country: "Cambodia",       countryCode: "KH", flag: "🇰🇭", continent: "Asia" },
  REP: { city: "Siem Reap",    country: "Cambodia",       countryCode: "KH", flag: "🇰🇭", continent: "Asia" },
  VTE: { city: "Vientiane",    country: "Laos",           countryCode: "LA", flag: "🇱🇦", continent: "Asia" },
  DEL: { city: "New Delhi",    country: "India",          countryCode: "IN", flag: "🇮🇳", continent: "Asia" },
  BOM: { city: "Mumbai",       country: "India",          countryCode: "IN", flag: "🇮🇳", continent: "Asia" },
  BLR: { city: "Bangalore",    country: "India",          countryCode: "IN", flag: "🇮🇳", continent: "Asia" },
  MAA: { city: "Chennai",      country: "India",          countryCode: "IN", flag: "🇮🇳", continent: "Asia" },
  HYD: { city: "Hyderabad",    country: "India",          countryCode: "IN", flag: "🇮🇳", continent: "Asia" },
  CCU: { city: "Kolkata",      country: "India",          countryCode: "IN", flag: "🇮🇳", continent: "Asia" },
  CMB: { city: "Colombo",      country: "Sri Lanka",      countryCode: "LK", flag: "🇱🇰", continent: "Asia" },
  KTM: { city: "Kathmandu",    country: "Nepal",          countryCode: "NP", flag: "🇳🇵", continent: "Asia" },
  DAC: { city: "Dhaka",        country: "Bangladesh",     countryCode: "BD", flag: "🇧🇩", continent: "Asia" },
  KHI: { city: "Karachi",      country: "Pakistan",       countryCode: "PK", flag: "🇵🇰", continent: "Asia" },
  LHE: { city: "Lahore",       country: "Pakistan",       countryCode: "PK", flag: "🇵🇰", continent: "Asia" },
  ISB: { city: "Islamabad",    country: "Pakistan",       countryCode: "PK", flag: "🇵🇰", continent: "Asia" },
  IKA: { city: "Tehran",       country: "Iran",           countryCode: "IR", flag: "🇮🇷", continent: "Asia" },
  GYD: { city: "Baku",         country: "Azerbaijan",     countryCode: "AZ", flag: "🇦🇿", continent: "Asia" },
  TBS: { city: "Tbilisi",      country: "Georgia",        countryCode: "GE", flag: "🇬🇪", continent: "Asia" },
  EVN: { city: "Yerevan",      country: "Armenia",        countryCode: "AM", flag: "🇦🇲", continent: "Asia" },
  ALA: { city: "Almaty",       country: "Kazakhstan",     countryCode: "KZ", flag: "🇰🇿", continent: "Asia" },
  TAS: { city: "Tashkent",     country: "Uzbekistan",     countryCode: "UZ", flag: "🇺🇿", continent: "Asia" },
  ULN: { city: "Ulaanbaatar",  country: "Mongolia",       countryCode: "MN", flag: "🇲🇳", continent: "Asia" },
  // ── Middle East ────────────────────────────────────────────────────────
  DXB: { city: "Dubai",        country: "UAE",            countryCode: "AE", flag: "🇦🇪", continent: "Middle East" },
  AUH: { city: "Abu Dhabi",    country: "UAE",            countryCode: "AE", flag: "🇦🇪", continent: "Middle East" },
  SHJ: { city: "Sharjah",      country: "UAE",            countryCode: "AE", flag: "🇦🇪", continent: "Middle East" },
  DOH: { city: "Doha",         country: "Qatar",          countryCode: "QA", flag: "🇶🇦", continent: "Middle East" },
  BAH: { city: "Bahrain",      country: "Bahrain",        countryCode: "BH", flag: "🇧🇭", continent: "Middle East" },
  KWI: { city: "Kuwait City",  country: "Kuwait",         countryCode: "KW", flag: "🇰🇼", continent: "Middle East" },
  RUH: { city: "Riyadh",       country: "Saudi Arabia",   countryCode: "SA", flag: "🇸🇦", continent: "Middle East" },
  JED: { city: "Jeddah",       country: "Saudi Arabia",   countryCode: "SA", flag: "🇸🇦", continent: "Middle East" },
  MCT: { city: "Muscat",       country: "Oman",           countryCode: "OM", flag: "🇴🇲", continent: "Middle East" },
  AMM: { city: "Amman",        country: "Jordan",         countryCode: "JO", flag: "🇯🇴", continent: "Middle East" },
  BEY: { city: "Beirut",       country: "Lebanon",        countryCode: "LB", flag: "🇱🇧", continent: "Middle East" },
  TLV: { city: "Tel Aviv",     country: "Israel",         countryCode: "IL", flag: "🇮🇱", continent: "Middle East" },
  BGW: { city: "Baghdad",      country: "Iraq",           countryCode: "IQ", flag: "🇮🇶", continent: "Middle East" },
  // ── Africa ────────────────────────────────────────────────────────────
  CAI: { city: "Cairo",        country: "Egypt",          countryCode: "EG", flag: "🇪🇬", continent: "Africa" },
  HRG: { city: "Hurghada",     country: "Egypt",          countryCode: "EG", flag: "🇪🇬", continent: "Africa" },
  SSH: { city: "Sharm el-Sheikh",country:"Egypt",         countryCode: "EG", flag: "🇪🇬", continent: "Africa" },
  CMN: { city: "Casablanca",   country: "Morocco",        countryCode: "MA", flag: "🇲🇦", continent: "Africa" },
  RAK: { city: "Marrakech",    country: "Morocco",        countryCode: "MA", flag: "🇲🇦", continent: "Africa" },
  TNG: { city: "Tangier",      country: "Morocco",        countryCode: "MA", flag: "🇲🇦", continent: "Africa" },
  TUN: { city: "Tunis",        country: "Tunisia",        countryCode: "TN", flag: "🇹🇳", continent: "Africa" },
  ALG: { city: "Algiers",      country: "Algeria",        countryCode: "DZ", flag: "🇩🇿", continent: "Africa" },
  JNB: { city: "Johannesburg", country: "South Africa",   countryCode: "ZA", flag: "🇿🇦", continent: "Africa" },
  CPT: { city: "Cape Town",    country: "South Africa",   countryCode: "ZA", flag: "🇿🇦", continent: "Africa" },
  DUR: { city: "Durban",       country: "South Africa",   countryCode: "ZA", flag: "🇿🇦", continent: "Africa" },
  NBO: { city: "Nairobi",      country: "Kenya",          countryCode: "KE", flag: "🇰🇪", continent: "Africa" },
  ADD: { city: "Addis Ababa",  country: "Ethiopia",       countryCode: "ET", flag: "🇪🇹", continent: "Africa" },
  DAR: { city: "Dar es Salaam",country: "Tanzania",       countryCode: "TZ", flag: "🇹🇿", continent: "Africa" },
  LOS: { city: "Lagos",        country: "Nigeria",        countryCode: "NG", flag: "🇳🇬", continent: "Africa" },
  ABJ: { city: "Abidjan",      country: "Ivory Coast",    countryCode: "CI", flag: "🇨🇮", continent: "Africa" },
  ACC: { city: "Accra",        country: "Ghana",          countryCode: "GH", flag: "🇬🇭", continent: "Africa" },
  DKR: { city: "Dakar",        country: "Senegal",        countryCode: "SN", flag: "🇸🇳", continent: "Africa" },
  TNR: { city: "Antananarivo", country: "Madagascar",     countryCode: "MG", flag: "🇲🇬", continent: "Africa" },
  MRU: { city: "Mauritius",    country: "Mauritius",      countryCode: "MU", flag: "🇲🇺", continent: "Africa" },
  SEZ: { city: "Seychelles",   country: "Seychelles",     countryCode: "SC", flag: "🇸🇨", continent: "Africa" },
  RUN: { city: "Réunion",      country: "Réunion",        countryCode: "RE", flag: "🇷🇪", continent: "Africa" },
  // ── Oceania ───────────────────────────────────────────────────────────
  SYD: { city: "Sydney",       country: "Australia",      countryCode: "AU", flag: "🇦🇺", continent: "Oceania" },
  MEL: { city: "Melbourne",    country: "Australia",      countryCode: "AU", flag: "🇦🇺", continent: "Oceania" },
  BNE: { city: "Brisbane",     country: "Australia",      countryCode: "AU", flag: "🇦🇺", continent: "Oceania" },
  PER: { city: "Perth",        country: "Australia",      countryCode: "AU", flag: "🇦🇺", continent: "Oceania" },
  ADL: { city: "Adelaide",     country: "Australia",      countryCode: "AU", flag: "🇦🇺", continent: "Oceania" },
  CBR: { city: "Canberra",     country: "Australia",      countryCode: "AU", flag: "🇦🇺", continent: "Oceania" },
  AKL: { city: "Auckland",     country: "New Zealand",    countryCode: "NZ", flag: "🇳🇿", continent: "Oceania" },
  CHC: { city: "Christchurch", country: "New Zealand",    countryCode: "NZ", flag: "🇳🇿", continent: "Oceania" },
  WLG: { city: "Wellington",   country: "New Zealand",    countryCode: "NZ", flag: "🇳🇿", continent: "Oceania" },
  NAN: { city: "Nadi",         country: "Fiji",           countryCode: "FJ", flag: "🇫🇯", continent: "Oceania" },
  PPT: { city: "Papeete",      country: "French Polynesia",countryCode: "PF",flag: "🇵🇫", continent: "Oceania" },
  HIR: { city: "Honiara",      country: "Solomon Islands",countryCode: "SB", flag: "🇸🇧", continent: "Oceania" },
};

export function getAirportInfo(iata: string): AirportInfo | null {
  return AIRPORT_DB[iata.toUpperCase()] ?? null;
}

export interface PassportStats {
  countries: CountryEntry[];
  totalCountries: number;
  totalAirports: number;
  totalContinents: number;
  worldCoveragePercent: number; // of ~195 sovereign nations
  continentCounts: Record<ContinentKey, number>;
}

export interface CountryEntry {
  country: string;
  countryCode: string;
  flag: string;
  continent: ContinentKey;
  airports: string[];         // unique IATA codes visited in this country
  airportCities: string[];    // human names matching the codes
}

const WORLD_COUNTRY_COUNT = 195;

export function computePassportStats(flights: import("@/context/flights").Flight[]): PassportStats {
  const airportSet = new Set<string>();
  const countryMap = new Map<string, CountryEntry>();

  for (const flight of flights) {
    for (const code of [flight.departureAirport, flight.arrivalAirport]) {
      if (airportSet.has(code)) continue;
      const info = getAirportInfo(code);
      if (!info) continue;
      airportSet.add(code);

      if (!countryMap.has(info.country)) {
        countryMap.set(info.country, {
          country: info.country,
          countryCode: info.countryCode,
          flag: info.flag,
          continent: info.continent,
          airports: [],
          airportCities: [],
        });
      }
      const entry = countryMap.get(info.country)!;
      if (!entry.airports.includes(code)) {
        entry.airports.push(code);
        entry.airportCities.push(`${info.city} (${code})`);
      }
    }
  }

  const countries = Array.from(countryMap.values()).sort((a, b) =>
    a.continent.localeCompare(b.continent) || a.country.localeCompare(b.country)
  );

  const continentSet = new Set(countries.map((c) => c.continent));
  const continentCounts = {} as Record<ContinentKey, number>;
  for (const c of countries) {
    continentCounts[c.continent] = (continentCounts[c.continent] ?? 0) + 1;
  }

  return {
    countries,
    totalCountries: countryMap.size,
    totalAirports: airportSet.size,
    totalContinents: continentSet.size,
    worldCoveragePercent: Math.round((countryMap.size / WORLD_COUNTRY_COUNT) * 1000) / 10,
    continentCounts,
  };
}
