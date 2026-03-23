// ─────────────────────────────────────────────────────────────────────────────
// Aviationstack API — https://aviationstack.com
// Set AVIATIONSTACK_API_KEY in your .env file.
// Falls back to deterministic mock data if the key is missing or the API fails.
// ─────────────────────────────────────────────────────────────────────────────

const AIRLINES: Record<string, string> = {
  AA: "American Airlines",
  UA: "United Airlines",
  DL: "Delta Air Lines",
  WN: "Southwest Airlines",
  B6: "JetBlue Airways",
  AS: "Alaska Airlines",
  F9: "Frontier Airlines",
  NK: "Spirit Airlines",
  G4: "Allegiant Air",
  SY: "Sun Country Airlines",
  BA: "British Airways",
  LH: "Lufthansa",
  AF: "Air France",
  KL: "KLM",
  EK: "Emirates",
  QR: "Qatar Airways",
  SQ: "Singapore Airlines",
  CX: "Cathay Pacific",
  TK: "Turkish Airlines",
  LX: "Swiss International Air Lines",
  AY: "Finnair",
  SK: "Scandinavian Airlines",
  IB: "Iberia",
  VY: "Vueling",
  FR: "Ryanair",
  U2: "easyJet",
  EJU: "easyJet Europe",
  W6: "Wizz Air",
  HV: "Transavia",
  TO: "Transavia France",
  BE: "flybe",
  LS: "Jet2",
  EI: "Aer Lingus",
  BV: "Blue Air",
  FB: "Bulgaria Air",
  OK: "Czech Airlines",
  BT: "airBaltic",
  ET: "Ethiopian Airlines",
  KQ: "Kenya Airways",
  SA: "South African Airways",
  MS: "EgyptAir",
  RO: "TAROM",
  JU: "Air Serbia",
  OU: "Croatia Airlines",
  TP: "TAP Air Portugal",
  AZ: "ITA Airways",
  JL: "Japan Airlines",
  NH: "All Nippon Airways",
  KE: "Korean Air",
  OZ: "Asiana Airlines",
  CA: "Air China",
  MU: "China Eastern",
  CZ: "China Southern",
  TG: "Thai Airways",
  MH: "Malaysia Airlines",
  SV: "Saudi Arabian Airlines",
  EY: "Etihad Airways",
  WY: "Oman Air",
  FZ: "flydubai",
  PC: "Pegasus Airlines",
  AC: "Air Canada",
  WS: "WestJet",
  LA: "LATAM Airlines",
  G3: "GOL Linhas Aereas",
  AD: "Azul Brazilian Airlines",
  AR: "Aerolineas Argentinas",
  CM: "Copa Airlines",
  AV: "Avianca",
  AM: "Aeromexico",
  QF: "Qantas",
  NZ: "Air New Zealand",
  GA: "Garuda Indonesia",
  PR: "Philippine Airlines",
  VN: "Vietnam Airlines",
  AI: "Air India",
  VU: "Volotea",
  TUI: "TUI Airways",
};

const AIRPORTS: Record<string, { city: string; lat: number; lon: number }> = {
  JFK: { city: "New York", lat: 40.6413, lon: -73.7781 },
  LGA: { city: "New York", lat: 40.7769, lon: -73.874 },
  EWR: { city: "Newark", lat: 40.6895, lon: -74.1745 },
  LAX: { city: "Los Angeles", lat: 33.9425, lon: -118.4081 },
  ORD: { city: "Chicago", lat: 41.9742, lon: -87.9073 },
  ATL: { city: "Atlanta", lat: 33.6407, lon: -84.4277 },
  DFW: { city: "Dallas", lat: 32.8998, lon: -97.0403 },
  DEN: { city: "Denver", lat: 39.8561, lon: -104.6737 },
  SFO: { city: "San Francisco", lat: 37.6213, lon: -122.379 },
  SEA: { city: "Seattle", lat: 47.4502, lon: -122.3088 },
  MIA: { city: "Miami", lat: 25.7959, lon: -80.287 },
  BOS: { city: "Boston", lat: 42.3656, lon: -71.0096 },
  PHX: { city: "Phoenix", lat: 33.4373, lon: -112.0078 },
  MCO: { city: "Orlando", lat: 28.4294, lon: -81.3089 },
  IAH: { city: "Houston", lat: 29.9902, lon: -95.3368 },
  MSP: { city: "Minneapolis", lat: 44.8848, lon: -93.2223 },
  DTW: { city: "Detroit", lat: 42.2162, lon: -83.3554 },
  PHL: { city: "Philadelphia", lat: 39.8719, lon: -75.2411 },
  CLT: { city: "Charlotte", lat: 35.2141, lon: -80.9431 },
  LAS: { city: "Las Vegas", lat: 36.084, lon: -115.1537 },
  LHR: { city: "London", lat: 51.47, lon: -0.4543 },
  CDG: { city: "Paris", lat: 49.0097, lon: 2.5479 },
  FRA: { city: "Frankfurt", lat: 50.0379, lon: 8.5622 },
  AMS: { city: "Amsterdam", lat: 52.3105, lon: 4.7683 },
  MAD: { city: "Madrid", lat: 40.4936, lon: -3.5668 },
  BCN: { city: "Barcelona", lat: 41.2971, lon: 2.0785 },
  FCO: { city: "Rome", lat: 41.8003, lon: 12.2389 },
  MUC: { city: "Munich", lat: 48.3538, lon: 11.7861 },
  DXB: { city: "Dubai", lat: 25.2532, lon: 55.3657 },
  SIN: { city: "Singapore", lat: 1.3644, lon: 103.9915 },
  HKG: { city: "Hong Kong", lat: 22.308, lon: 113.9185 },
  NRT: { city: "Tokyo", lat: 35.772, lon: 140.3929 },
  HND: { city: "Tokyo", lat: 35.5494, lon: 139.7798 },
  ICN: { city: "Seoul", lat: 37.4602, lon: 126.4407 },
  PEK: { city: "Beijing", lat: 40.0801, lon: 116.5846 },
  SYD: { city: "Sydney", lat: -33.9399, lon: 151.1753 },
  MEL: { city: "Melbourne", lat: -37.6733, lon: 144.843 },
  YYZ: { city: "Toronto", lat: 43.6777, lon: -79.6248 },
  GRU: { city: "Sao Paulo", lat: -23.4356, lon: -46.4731 },
  MEX: { city: "Mexico City", lat: 19.4361, lon: -99.0719 },
  IST: { city: "Istanbul", lat: 41.2753, lon: 28.7519 },
  DOH: { city: "Doha", lat: 25.2731, lon: 51.608 },
  AUH: { city: "Abu Dhabi", lat: 24.433, lon: 54.6511 },
  BOM: { city: "Mumbai", lat: 19.0896, lon: 72.8656 },
  DEL: { city: "Delhi", lat: 28.5665, lon: 77.1031 },
  LIS: { city: "Lisbon", lat: 38.7756, lon: -9.1354 },
  OPO: { city: "Porto", lat: 41.2481, lon: -8.6814 },
  GVA: { city: "Geneva", lat: 46.2381, lon: 6.1089 },
  ZRH: { city: "Zurich", lat: 47.4647, lon: 8.5492 },
  BSL: { city: "Basel", lat: 47.5896, lon: 7.5299 },
  VIE: { city: "Vienna", lat: 48.1103, lon: 16.5697 },
  BRU: { city: "Brussels", lat: 50.9014, lon: 4.4844 },
  CPH: { city: "Copenhagen", lat: 55.618, lon: 12.656 },
  OSL: { city: "Oslo", lat: 60.1939, lon: 11.1004 },
  ARN: { city: "Stockholm", lat: 59.6519, lon: 17.9186 },
  HEL: { city: "Helsinki", lat: 60.3183, lon: 24.9497 },
  DUB: { city: "Dublin", lat: 53.4264, lon: -6.2499 },
  MAN: { city: "Manchester", lat: 53.3619, lon: -2.2728 },
  LGW: { city: "London", lat: 51.1537, lon: -0.1821 },
  STN: { city: "London", lat: 51.886, lon: 0.2389 },
  LTN: { city: "London", lat: 51.8763, lon: -0.3717 },
  BHX: { city: "Birmingham", lat: 52.4539, lon: -1.748 },
  EDI: { city: "Edinburgh", lat: 55.9508, lon: -3.3728 },
  GLA: { city: "Glasgow", lat: 55.8719, lon: -4.433 },
  NCE: { city: "Nice", lat: 43.6584, lon: 7.2159 },
  MRS: { city: "Marseille", lat: 43.4365, lon: 5.2214 },
  LYS: { city: "Lyon", lat: 45.7256, lon: 5.0811 },
  TLS: { city: "Toulouse", lat: 43.6293, lon: 1.3638 },
  BOD: { city: "Bordeaux", lat: 44.8283, lon: -0.7156 },
  BER: { city: "Berlin", lat: 52.3667, lon: 13.5033 },
  HAM: { city: "Hamburg", lat: 53.6304, lon: 9.9882 },
  DUS: { city: "Dusseldorf", lat: 51.2895, lon: 6.7668 },
  CGN: { city: "Cologne", lat: 50.8659, lon: 7.1427 },
  STR: { city: "Stuttgart", lat: 48.69, lon: 9.222 },
  NUE: { city: "Nuremberg", lat: 49.4987, lon: 11.0669 },
  MXP: { city: "Milan", lat: 45.6306, lon: 8.7231 },
  LIN: { city: "Milan", lat: 45.4451, lon: 9.2768 },
  BGY: { city: "Milan", lat: 45.6739, lon: 9.7042 },
  VCE: { city: "Venice", lat: 45.5053, lon: 12.3519 },
  NAP: { city: "Naples", lat: 40.886, lon: 14.2908 },
  PMO: { city: "Palermo", lat: 38.1796, lon: 13.091 },
  ATH: { city: "Athens", lat: 37.9364, lon: 23.9445 },
  SKG: { city: "Thessaloniki", lat: 40.5197, lon: 22.9709 },
  SOF: { city: "Sofia", lat: 42.6967, lon: 23.4116 },
  OTP: { city: "Bucharest", lat: 44.5723, lon: 26.102 },
  PRG: { city: "Prague", lat: 50.1008, lon: 14.26 },
  BUD: { city: "Budapest", lat: 47.4298, lon: 19.2611 },
  WAW: { city: "Warsaw", lat: 52.1657, lon: 20.9671 },
  KRK: { city: "Krakow", lat: 50.0777, lon: 19.7848 },
  RIX: { city: "Riga", lat: 56.9236, lon: 23.9711 },
  TLL: { city: "Tallinn", lat: 59.4133, lon: 24.8328 },
  VNO: { city: "Vilnius", lat: 54.6341, lon: 25.2858 },
  SVQ: { city: "Seville", lat: 37.418, lon: -5.8931 },
  AGP: { city: "Malaga", lat: 36.6749, lon: -4.4991 },
  PMI: { city: "Palma de Mallorca", lat: 39.5517, lon: 2.7388 },
  ALC: { city: "Alicante", lat: 38.2822, lon: -0.5582 },
  LPA: { city: "Gran Canaria", lat: 27.9319, lon: -15.3866 },
  TFS: { city: "Tenerife", lat: 28.0444, lon: -16.5725 },
  FAO: { city: "Faro", lat: 37.0144, lon: -7.9659 },
  MLA: { city: "Malta", lat: 35.8574, lon: 14.4775 },
  HER: { city: "Heraklion", lat: 35.3397, lon: 25.1803 },
  RHO: { city: "Rhodes", lat: 36.4054, lon: 28.0862 },
  CFU: { city: "Corfu", lat: 39.6019, lon: 19.9117 },
  BEG: { city: "Belgrade", lat: 44.8184, lon: 20.3091 },
  ZAG: { city: "Zagreb", lat: 45.7429, lon: 16.0688 },
  LJU: { city: "Ljubljana", lat: 46.2237, lon: 14.4576 },
  TIA: { city: "Tirana", lat: 41.4147, lon: 19.7206 },
  SKP: { city: "Skopje", lat: 41.9614, lon: 21.6214 },
  SJJ: { city: "Sarajevo", lat: 43.8246, lon: 18.3315 },
  KBP: { city: "Kyiv", lat: 50.345, lon: 30.8947 },
  CAI: { city: "Cairo", lat: 30.1219, lon: 31.4056 },
  CMN: { city: "Casablanca", lat: 33.3675, lon: -7.5897 },
  TUN: { city: "Tunis", lat: 36.851, lon: 10.2272 },
  ALG: { city: "Algiers", lat: 36.691, lon: 3.2154 },
  ADD: { city: "Addis Ababa", lat: 8.9779, lon: 38.7993 },
  NBO: { city: "Nairobi", lat: -1.3192, lon: 36.9275 },
  JNB: { city: "Johannesburg", lat: -26.1367, lon: 28.2411 },
  CPT: { city: "Cape Town", lat: -33.9649, lon: 18.6017 },
  GIG: { city: "Rio de Janeiro", lat: -22.81, lon: -43.2506 },
  EZE: { city: "Buenos Aires", lat: -34.8222, lon: -58.5358 },
  SCL: { city: "Santiago", lat: -33.393, lon: -70.7858 },
  BOG: { city: "Bogota", lat: 4.7016, lon: -74.1469 },
  LIM: { city: "Lima", lat: -12.0219, lon: -77.1143 },
  BKK: { city: "Bangkok", lat: 13.6811, lon: 100.7475 },
  KUL: { city: "Kuala Lumpur", lat: 2.7456, lon: 101.7072 },
  CGK: { city: "Jakarta", lat: -6.1256, lon: 106.6559 },
  MNL: { city: "Manila", lat: 14.5086, lon: 121.0197 },
  MAA: { city: "Chennai", lat: 12.9941, lon: 80.1709 },
  CCU: { city: "Kolkata", lat: 22.6547, lon: 88.4467 },
  HYD: { city: "Hyderabad", lat: 17.2403, lon: 78.4294 },
  BLR: { city: "Bangalore", lat: 13.1986, lon: 77.7066 },
  PVG: { city: "Shanghai", lat: 31.1443, lon: 121.8083 },
  SHA: { city: "Shanghai", lat: 31.1979, lon: 121.3368 },
  CAN: { city: "Guangzhou", lat: 23.3924, lon: 113.299 },
  SZX: { city: "Shenzhen", lat: 22.6393, lon: 113.8107 },
  CTU: { city: "Chengdu", lat: 30.5786, lon: 103.9478 },
};

const AIRLINE_HUB_ROUTES: Record<string, [string, string][]> = {
  LX: [["GVA", "ZRH"], ["ZRH", "GVA"], ["ZRH", "LHR"], ["ZRH", "FRA"], ["GVA", "LHR"], ["ZRH", "JFK"], ["GVA", "JFK"]],
  LH: [["FRA", "MUC"], ["MUC", "FRA"], ["FRA", "LHR"], ["FRA", "JFK"]],
  BA: [["LHR", "CDG"], ["LHR", "JFK"], ["LHR", "DXB"]],
  AF: [["CDG", "JFK"], ["CDG", "LHR"], ["CDG", "FCO"]],
  TP: [["LIS", "OPO"], ["LIS", "LHR"], ["LIS", "CDG"], ["LIS", "JFK"]],
  U2: [["LGW", "BCN"], ["LGW", "FCO"], ["LGW", "AMS"]],
  FR: [["STN", "BCN"], ["STN", "FCO"], ["STN", "MAD"]],
};

const ROUTE_POOL: [string, string][] = [
  ["JFK", "LAX"], ["JFK", "LHR"], ["JFK", "CDG"], ["JFK", "ORD"],
  ["LAX", "SFO"], ["LAX", "DEN"], ["LAX", "NRT"], ["LAX", "SIN"],
  ["LHR", "DXB"], ["LHR", "SIN"], ["LHR", "CDG"], ["LHR", "FRA"],
  ["DXB", "SIN"], ["DXB", "LHR"], ["DXB", "DEL"], ["DXB", "BOM"],
  ["SFO", "JFK"], ["SFO", "ORD"], ["SFO", "NRT"],
  ["ORD", "ATL"], ["ATL", "MIA"], ["ATL", "DFW"],
  ["DFW", "LAX"], ["DFW", "ORD"],
  ["MIA", "JFK"], ["MIA", "LHR"], ["MIA", "GRU"],
  ["BOS", "LHR"], ["SEA", "LAX"], ["SEA", "SFO"],
  ["NRT", "ICN"], ["NRT", "HKG"], ["SIN", "HKG"], ["SIN", "SYD"],
  ["CDG", "FCO"], ["CDG", "MAD"], ["FRA", "DXB"], ["FRA", "IST"],
  ["IST", "LHR"], ["IST", "DXB"],
  ["GVA", "ZRH"], ["ZRH", "GVA"], ["ZRH", "LHR"], ["ZRH", "FRA"],
  ["GVA", "LHR"], ["LIS", "OPO"], ["LIS", "LHR"],
];

const AIRCRAFT_POOL = [
  "Boeing 737-800", "Boeing 737 MAX 8", "Boeing 787-9 Dreamliner",
  "Boeing 777-300ER", "Airbus A320neo", "Airbus A321neo",
  "Airbus A350-900", "Airbus A380-800", "Boeing 767-300ER",
  "Embraer E175", "Bombardier CRJ-900", "Boeing 757-200",
];

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function kmToMiles(km: number): number {
  return km * 0.621371;
}

function deterministicSeed(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function seededRandom(seed: number, index: number): number {
  const x = Math.sin(seed + index) * 10000;
  return x - Math.floor(x);
}

function extractAirlineCode(code: string): string {
  const match = code.match(/^([A-Z]{2,3})/);
  return match ? match[1] : code.substring(0, 2);
}

function toHHMM(isoOrTime: string | null | undefined): string {
  if (!isoOrTime) return "00:00";
  if (isoOrTime.includes("T")) return isoOrTime.substring(11, 16);
  return isoOrTime.substring(0, 5);
}

function durationFromISO(dep: string | null | undefined, arr: string | null | undefined): number | null {
  if (!dep || !arr) return null;
  try {
    const diff = new Date(arr).getTime() - new Date(dep).getTime();
    if (isNaN(diff) || diff <= 0) return null;
    return Math.round(diff / 60000);
  } catch {
    return null;
  }
}

function generateMockFlight(
  code: string,
  date: string,
  hintDep?: string,
  hintArr?: string,
) {
  const seed = deterministicSeed(code + date);
  const airlineCode = extractAirlineCode(code.toUpperCase());
  const airlineName = AIRLINES[airlineCode] || "Unknown Airlines";

  let depIata: string;
  let arrIata: string;

  if (hintDep && hintArr) {
    depIata = hintDep.toUpperCase();
    arrIata = hintArr.toUpperCase();
  } else if (AIRLINE_HUB_ROUTES[airlineCode]) {
    const routes = AIRLINE_HUB_ROUTES[airlineCode];
    const routeIndex = seed % routes.length;
    depIata = routes[routeIndex][0];
    arrIata = routes[routeIndex][1];
  } else {
    const routeIndex = seed % ROUTE_POOL.length;
    depIata = ROUTE_POOL[routeIndex][0];
    arrIata = ROUTE_POOL[routeIndex][1];
  }

  const dep = AIRPORTS[depIata] || AIRPORTS["JFK"];
  const arr = AIRPORTS[arrIata] || AIRPORTS["LAX"];

  const distKm = haversineKm(dep.lat, dep.lon, arr.lat, arr.lon);
  const distMiles = Math.round(kmToMiles(distKm));
  const blockTime = (distKm / 870) * 60 + 30;
  const durationMinutes = Math.round(blockTime);
  const co2Kg = Math.round(distKm * 0.115);

  const delayRoll = seededRandom(seed, 5);
  const isDelayed = delayRoll < 0.2;
  const delayMinutes = isDelayed ? Math.round(seededRandom(seed, 6) * 120 + 10) : 0;

  const depHour = 6 + Math.floor(seededRandom(seed, 7) * 14);
  const depMin = Math.floor(seededRandom(seed, 8) * 4) * 15;
  const depStr = `${String(depHour).padStart(2, "0")}:${String(depMin).padStart(2, "0")}`;

  const totalMin = depHour * 60 + depMin + durationMinutes + delayMinutes;
  const arrHour = Math.floor(totalMin / 60) % 24;
  const arrMin = totalMin % 60;
  const arrStr = `${String(arrHour).padStart(2, "0")}:${String(arrMin).padStart(2, "0")}`;

  const aircraft = AIRCRAFT_POOL[seed % AIRCRAFT_POOL.length];

  return {
    flightCode: code,
    date,
    airline: airlineName,
    airlineCode,
    departureAirport: depIata,
    arrivalAirport: arrIata,
    departureCity: dep.city,
    arrivalCity: arr.city,
    departureTime: depStr,
    arrivalTime: arrStr,
    durationMinutes,
    distanceMiles: distMiles,
    co2Kg,
    status: (isDelayed ? "delayed" : "on_time") as "on_time" | "delayed",
    delayMinutes,
    aircraft,
    isMock: true,
    tailNumber: undefined,
    departureTerminal: undefined,
    arrivalTerminal: undefined,
    departureGate: undefined,
    arrivalGate: undefined,
  };
}

interface AviationstackFlight {
  flight_date: string;
  flight_status: "scheduled" | "active" | "landed" | "cancelled" | "incident" | "diverted" | string;
  departure: {
    airport: string;
    iata: string;
    icao: string;
    terminal: string | null;
    gate: string | null;
    scheduled: string;
    estimated: string | null;
    actual: string | null;
    delay: number | null;
  };
  arrival: {
    airport: string;
    iata: string;
    icao: string;
    terminal: string | null;
    gate: string | null;
    scheduled: string;
    estimated: string | null;
    actual: string | null;
    delay: number | null;
  };
  airline: {
    name: string;
    iata: string;
    icao: string;
  };
  flight: {
    number: string;
    iata: string;
    icao: string;
  };
  aircraft: {
    registration: string | null;
    iata: string | null;
    icao: string | null;
    icao24: string | null;
  } | null;
}

interface AviationstackResponse {
  pagination?: { total: number; count: number; offset: number; limit: number };
  data?: AviationstackFlight[];
  error?: { code: string; message: string };
}

async function lookupFromAviationstack(
  code: string,
  date: string,
  dep?: string,
  arr?: string,
) {
  const apiKey = process.env.AVIATIONSTACK_API_KEY;
  if (!apiKey) {
    console.log("[Aviationstack] No API key found, skipping");
    return null;
  }

  const params = new URLSearchParams({
    access_key: apiKey,
    flight_iata: code.toUpperCase(),
    limit: "10",
  });

  const url = `http://api.aviationstack.com/v1/flights?${params.toString()}`;
  console.log(`[Aviationstack] Fetching ${code} (date filter: ${date})`);

  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error(`[Aviationstack] HTTP ${res.status} \u2014 ${body.slice(0, 200)}`);
      return null;
    }

    const json = (await res.json()) as AviationstackResponse;

    if (json.error) {
      console.error(`[Aviationstack] API error: ${json.error.code} \u2014 ${json.error.message}`);
      return null;
    }

    const flights = json.data;
    console.log(`[Aviationstack] Got ${flights?.length ?? 0} result(s)`);
    if (!flights || flights.length === 0) return null;

    const statusScore = (s: string) =>
      s === "active" ? 0 : s === "landed" ? 1 : s === "scheduled" ? 2 : 3;

    const ranked = [...flights].sort((a, b) => {
      const dateMatchA = a.flight_date === date ? 0 : 1;
      const dateMatchB = b.flight_date === date ? 0 : 1;
      return dateMatchA - dateMatchB || statusScore(a.flight_status) - statusScore(b.flight_status);
    });

    const f = ranked[0];
    console.log(`[Aviationstack] Using flight: ${f.flight.iata} on ${f.flight_date} status=${f.flight_status}`);

    const depIata = f.departure.iata?.toUpperCase() || "";
    const arrIata = f.arrival.iata?.toUpperCase() || "";
    const depAirportData = AIRPORTS[depIata];
    const arrAirportData = AIRPORTS[arrIata];

    let distMiles = 0;
    let co2Kg = 0;
    if (depAirportData && arrAirportData) {
      const distKm = haversineKm(
        depAirportData.lat, depAirportData.lon,
        arrAirportData.lat, arrAirportData.lon,
      );
      distMiles = Math.round(kmToMiles(distKm));
      co2Kg = Math.round(distKm * 0.115);
    }

    const depTime = toHHMM(f.departure.actual ?? f.departure.estimated ?? f.departure.scheduled);
    const arrTime = toHHMM(f.arrival.actual ?? f.arrival.estimated ?? f.arrival.scheduled);

    const depISO = f.departure.actual ?? f.departure.estimated ?? f.departure.scheduled;
    const arrISO = f.arrival.actual ?? f.arrival.estimated ?? f.arrival.scheduled;
    const durationMinutes =
      durationFromISO(depISO, arrISO) ??
      (depAirportData && arrAirportData
        ? Math.round((haversineKm(
            depAirportData.lat, depAirportData.lon,
            arrAirportData.lat, arrAirportData.lon,
          ) / 870) * 60 + 30)
        : 120);

    const delayMinutes = f.departure.delay ?? f.arrival.delay ?? 0;
    const rawStatus = f.flight_status;
    const status: "on_time" | "delayed" =
      rawStatus === "cancelled" || rawStatus === "incident" || rawStatus === "diverted"
        ? "delayed"
        : delayMinutes > 15 ? "delayed" : "on_time";

    const airlineCode = f.airline.iata?.toUpperCase() || extractAirlineCode(code);
    const airlineName = AIRLINES[airlineCode] || f.airline.name || "Unknown Airlines";
    const aircraftLabel = f.aircraft?.icao ? icaoToReadable(f.aircraft.icao) : "Commercial Aircraft";

    return {
      flightCode: f.flight.iata || code,
      date: f.flight_date || date,
      airline: airlineName,
      airlineCode,
      departureAirport: depIata,
      arrivalAirport: arrIata,
      departureCity: depAirportData?.city || f.departure.airport || depIata,
      arrivalCity: arrAirportData?.city || f.arrival.airport || arrIata,
      departureTime: depTime,
      arrivalTime: arrTime,
      durationMinutes,
      distanceMiles: distMiles,
      co2Kg,
      status,
      delayMinutes,
      aircraft: aircraftLabel,
      isMock: false,
      // Enriched fields
      tailNumber: f.aircraft?.registration ?? undefined,
      departureTerminal: f.departure.terminal ?? undefined,
      arrivalTerminal: f.arrival.terminal ?? undefined,
      departureGate: f.departure.gate ?? undefined,
      arrivalGate: f.arrival.gate ?? undefined,
    };
  } catch (err) {
    console.error("[Aviationstack] fetch error:", err);
    return null;
  }
}

function icaoToReadable(icao: string): string {
  const map: Record<string, string> = {
    B738: "Boeing 737-800",
    B739: "Boeing 737-900",
    B37M: "Boeing 737 MAX 7",
    B38M: "Boeing 737 MAX 8",
    B39M: "Boeing 737 MAX 9",
    B788: "Boeing 787-8 Dreamliner",
    B789: "Boeing 787-9 Dreamliner",
    B78X: "Boeing 787-10 Dreamliner",
    B77W: "Boeing 777-300ER",
    B772: "Boeing 777-200",
    B748: "Boeing 747-8",
    B744: "Boeing 747-400",
    B763: "Boeing 767-300ER",
    B752: "Boeing 757-200",
    A19N: "Airbus A319neo",
    A20N: "Airbus A320neo",
    A21N: "Airbus A321neo",
    A319: "Airbus A319",
    A320: "Airbus A320",
    A321: "Airbus A321",
    A332: "Airbus A330-200",
    A333: "Airbus A330-300",
    A339: "Airbus A330-900neo",
    A359: "Airbus A350-900",
    A35K: "Airbus A350-1000",
    A388: "Airbus A380-800",
    E170: "Embraer E170",
    E175: "Embraer E175",
    E190: "Embraer E190",
    E195: "Embraer E195",
    CRJ9: "Bombardier CRJ-900",
    AT75: "ATR 72-500",
    AT76: "ATR 72-600",
    DH8D: "Bombardier Q400",
  };
  return map[icao.toUpperCase()] || icao;
}

async function lookupFromAirlabs(code: string, date: string) {
  const apiKey = process.env.AIRLABS_API_KEY;
  if (!apiKey) return null;

  try {
    const iataUrl = `https://airlabs.co/api/v9/flight?flight_iata=${code}&api_key=${apiKey}`;
    let res = await fetch(iataUrl, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) {
      const icaoUrl = `https://airlabs.co/api/v9/flight?flight_icao=${code}&api_key=${apiKey}`;
      res = await fetch(icaoUrl, { signal: AbortSignal.timeout(8000) });
      if (!res.ok) return null;
    }
    const json = (await res.json()) as {
      response?: {
        airline_iata?: string;
        dep_iata?: string;
        arr_iata?: string;
        dep_time?: string;
        arr_time?: string;
        dep_delayed?: number | null;
        arr_delayed?: number | null;
        duration?: number | null;
        status?: string;
        aircraft_icao?: string;
        reg_number?: string;
        dep_terminal?: string;
        arr_terminal?: string;
        dep_gate?: string;
        arr_gate?: string;
      };
      error?: { message?: string };
    };

    const f = json?.response;
    if (!f) return null;

    const depIata = f.dep_iata || "";
    const arrIata = f.arr_iata || "";
    const dep = AIRPORTS[depIata];
    const arr = AIRPORTS[arrIata];
    if (!dep || !arr) return null;

    const airlineCode = f.airline_iata || extractAirlineCode(code);
    const distKm = haversineKm(dep.lat, dep.lon, arr.lat, arr.lon);
    const distMiles = Math.round(kmToMiles(distKm));
    const co2Kg = Math.round(distKm * 0.115);
    const depTime = f.dep_time ? f.dep_time.substring(0, 5) : "00:00";
    const arrTime = f.arr_time ? f.arr_time.substring(0, 5) : "00:00";
    const durationMinutes = f.duration ?? Math.round((distKm / 870) * 60 + 30);
    const delayMinutes = f.dep_delayed ?? f.arr_delayed ?? 0;
    const rawStatus = f.status || "scheduled";
    const status: "on_time" | "delayed" =
      rawStatus === "delayed" || (delayMinutes !== null && delayMinutes > 15) ? "delayed" : "on_time";

    return {
      flightCode: code,
      date,
      airline: AIRLINES[airlineCode] || "Unknown Airlines",
      airlineCode,
      departureAirport: depIata,
      arrivalAirport: arrIata,
      departureCity: dep.city,
      arrivalCity: arr.city,
      departureTime: depTime,
      arrivalTime: arrTime,
      durationMinutes,
      distanceMiles: distMiles,
      co2Kg,
      status,
      delayMinutes,
      aircraft: f.aircraft_icao ? icaoToReadable(f.aircraft_icao) : "Commercial Aircraft",
      isMock: false,
      tailNumber: f.reg_number ?? undefined,
      departureTerminal: f.dep_terminal ?? undefined,
      arrivalTerminal: f.arr_terminal ?? undefined,
      departureGate: f.dep_gate ?? undefined,
      arrivalGate: f.arr_gate ?? undefined,
    };
  } catch {
    return null;
  }
}

export async function lookupFlight(
  code: string,
  date: string,
  dep?: string,
  arr?: string,
) {
  const aviationstackResult = await lookupFromAviationstack(code, date, dep, arr);
  if (aviationstackResult) return aviationstackResult;

  const airlabsResult = await lookupFromAirlabs(code, date);
  if (airlabsResult) return airlabsResult;

  return generateMockFlight(code, date, dep, arr);
}
