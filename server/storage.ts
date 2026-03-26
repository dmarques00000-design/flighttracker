// ─────────────────────────────────────────────────────────────────────────────
// AeroDataBox API (via RapidAPI) — https://rapidapi.com/aedbx-aedbx/api/aerodatabox
//
// Endpoints used:
//   GET /flights/number/{flightNumber}/{dateLocal}
//   e.g. /flights/number/LX19/2026-03-25
//
//   GET /flights/airports/iata/{iataCode}/{fromDateTime}/{toDateTime}
//   e.g. /flights/airports/iata/ZRH/2026-03-25T00:00/2026-03-25T23:59?withLeg=true&direction=Departure
//
// Required env var:
//   AERODATABOX_API_KEY  — your RapidAPI key
//
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

export const AIRPORTS: Record<string, { city: string; lat: number; lon: number }> = {
  // ─ North America ──────────────────────────────────────────────────────────────
  JFK: { city: "New York", lat: 40.6413, lon: -73.7781 },
  LGA: { city: "New York", lat: 40.7769, lon: -73.874 },
  EWR: { city: "Newark", lat: 40.6895, lon: -74.1745 },
  LAX: { city: "Los Angeles", lat: 33.9425, lon: -118.4081 },
  ORD: { city: "Chicago", lat: 41.9742, lon: -87.9073 },
  MDW: { city: "Chicago", lat: 41.7868, lon: -87.7522 },
  ATL: { city: "Atlanta", lat: 33.6407, lon: -84.4277 },
  DFW: { city: "Dallas", lat: 32.8998, lon: -97.0403 },
  DAL: { city: "Dallas", lat: 32.8471, lon: -96.8518 },
  DEN: { city: "Denver", lat: 39.8561, lon: -104.6737 },
  SFO: { city: "San Francisco", lat: 37.6213, lon: -122.379 },
  SJC: { city: "San Jose", lat: 37.3626, lon: -121.9290 },
  OAK: { city: "Oakland", lat: 37.7213, lon: -122.2208 },
  SEA: { city: "Seattle", lat: 47.4502, lon: -122.3088 },
  MIA: { city: "Miami", lat: 25.7959, lon: -80.287 },
  FLL: { city: "Fort Lauderdale", lat: 26.0726, lon: -80.1527 },
  BOS: { city: "Boston", lat: 42.3656, lon: -71.0096 },
  PHX: { city: "Phoenix", lat: 33.4373, lon: -112.0078 },
  MCO: { city: "Orlando", lat: 28.4294, lon: -81.3089 },
  TPA: { city: "Tampa", lat: 27.9755, lon: -82.5332 },
  IAH: { city: "Houston", lat: 29.9902, lon: -95.3368 },
  HOU: { city: "Houston", lat: 29.6454, lon: -95.2789 },
  MSP: { city: "Minneapolis", lat: 44.8848, lon: -93.2223 },
  DTW: { city: "Detroit", lat: 42.2162, lon: -83.3554 },
  PHL: { city: "Philadelphia", lat: 39.8719, lon: -75.2411 },
  CLT: { city: "Charlotte", lat: 35.2141, lon: -80.9431 },
  LAS: { city: "Las Vegas", lat: 36.084, lon: -115.1537 },
  BWI: { city: "Baltimore", lat: 39.1754, lon: -76.6683 },
  DCA: { city: "Washington", lat: 38.8521, lon: -77.0377 },
  IAD: { city: "Washington", lat: 38.9531, lon: -77.4565 },
  SLC: { city: "Salt Lake City", lat: 40.7899, lon: -111.9791 },
  PDX: { city: "Portland", lat: 45.5898, lon: -122.5951 },
  SAN: { city: "San Diego", lat: 32.7338, lon: -117.1933 },
  AUS: { city: "Austin", lat: 30.1975, lon: -97.6664 },
  MSY: { city: "New Orleans", lat: 29.9934, lon: -90.258 },
  RDU: { city: "Raleigh-Durham", lat: 35.8776, lon: -78.7875 },
  BNA: { city: "Nashville", lat: 36.1245, lon: -86.6782 },
  STL: { city: "St. Louis", lat: 38.7487, lon: -90.37 },
  MCI: { city: "Kansas City", lat: 39.2976, lon: -94.7139 },
  CLE: { city: "Cleveland", lat: 41.4117, lon: -81.8498 },
  PIT: { city: "Pittsburgh", lat: 40.4915, lon: -80.2329 },
  IND: { city: "Indianapolis", lat: 39.7173, lon: -86.2944 },
  CMH: { city: "Columbus", lat: 39.9980, lon: -82.8919 },
  MKE: { city: "Milwaukee", lat: 42.9472, lon: -87.8966 },
  OMA: { city: "Omaha", lat: 41.3032, lon: -95.8941 },
  ABQ: { city: "Albuquerque", lat: 35.0402, lon: -106.6090 },
  BUR: { city: "Burbank", lat: 34.2007, lon: -118.3585 },
  LGB: { city: "Long Beach", lat: 33.8177, lon: -118.1516 },
  ONT: { city: "Ontario", lat: 34.0560, lon: -117.6012 },
  SMF: { city: "Sacramento", lat: 38.6954, lon: -121.5908 },
  SNA: { city: "Orange County", lat: 33.6757, lon: -117.8682 },
  YYZ: { city: "Toronto", lat: 43.6777, lon: -79.6248 },
  YUL: { city: "Montreal", lat: 45.4706, lon: -73.7408 },
  YVR: { city: "Vancouver", lat: 49.1967, lon: -123.1815 },
  YYC: { city: "Calgary", lat: 51.1314, lon: -114.0108 },
  YEG: { city: "Edmonton", lat: 53.3097, lon: -113.5797 },
  YOW: { city: "Ottawa", lat: 45.3225, lon: -75.6692 },
  YHZ: { city: "Halifax", lat: 44.8808, lon: -63.5086 },
  GRU: { city: "Sao Paulo", lat: -23.4356, lon: -46.4731 },
  CGH: { city: "Sao Paulo", lat: -23.6261, lon: -46.6564 },
  GIG: { city: "Rio de Janeiro", lat: -22.81, lon: -43.2506 },
  SDU: { city: "Rio de Janeiro", lat: -22.9105, lon: -43.1631 },
  BSB: { city: "Brasilia", lat: -15.8711, lon: -47.9186 },
  SSA: { city: "Salvador", lat: -12.9086, lon: -38.3225 },
  FOR: { city: "Fortaleza", lat: -3.7763, lon: -38.5326 },
  REC: { city: "Recife", lat: -8.1265, lon: -34.9237 },
  POA: { city: "Porto Alegre", lat: -29.9944, lon: -51.1714 },
  EZE: { city: "Buenos Aires", lat: -34.8222, lon: -58.5358 },
  AEP: { city: "Buenos Aires", lat: -34.5592, lon: -58.4156 },
  SCL: { city: "Santiago", lat: -33.393, lon: -70.7858 },
  BOG: { city: "Bogota", lat: 4.7016, lon: -74.1469 },
  LIM: { city: "Lima", lat: -12.0219, lon: -77.1143 },
  UIO: { city: "Quito", lat: -0.1292, lon: -78.3575 },
  GYE: { city: "Guayaquil", lat: -2.1574, lon: -79.8836 },
  CCS: { city: "Caracas", lat: 10.6031, lon: -66.9913 },
  PTY: { city: "Panama City", lat: 9.0714, lon: -79.3835 },
  SJO: { city: "San Jose", lat: 9.9939, lon: -84.2088 },
  MEX: { city: "Mexico City", lat: 19.4361, lon: -99.0719 },
  CUN: { city: "Cancun", lat: 21.0365, lon: -86.8771 },
  GDL: { city: "Guadalajara", lat: 20.5218, lon: -103.3110 },
  MTY: { city: "Monterrey", lat: 25.7785, lon: -100.1069 },
  HAV: { city: "Havana", lat: 22.9892, lon: -82.4091 },
  SDQ: { city: "Santo Domingo", lat: 18.4297, lon: -69.6689 },
  SJU: { city: "San Juan", lat: 18.4394, lon: -66.0018 },
  // ─ Europe ───────────────────────────────────────────────────────────────────
  LHR: { city: "London", lat: 51.47, lon: -0.4543 },
  LGW: { city: "London", lat: 51.1537, lon: -0.1821 },
  STN: { city: "London", lat: 51.886, lon: 0.2389 },
  LTN: { city: "London", lat: 51.8763, lon: -0.3717 },
  LCY: { city: "London", lat: 51.5048, lon: 0.0553 },
  SEN: { city: "London", lat: 51.5714, lon: 0.6956 },
  CDG: { city: "Paris", lat: 49.0097, lon: 2.5479 },
  ORY: { city: "Paris", lat: 48.7233, lon: 2.3794 },
  FRA: { city: "Frankfurt", lat: 50.0379, lon: 8.5622 },
  AMS: { city: "Amsterdam", lat: 52.3105, lon: 4.7683 },
  MAD: { city: "Madrid", lat: 40.4936, lon: -3.5668 },
  BCN: { city: "Barcelona", lat: 41.2971, lon: 2.0785 },
  FCO: { city: "Rome", lat: 41.8003, lon: 12.2389 },
  MUC: { city: "Munich", lat: 48.3538, lon: 11.7861 },
  GVA: { city: "Geneva", lat: 46.2381, lon: 6.1089 },
  ZRH: { city: "Zurich", lat: 47.4647, lon: 8.5492 },
  BSL: { city: "Basel", lat: 47.5896, lon: 7.5299 },
  VIE: { city: "Vienna", lat: 48.1103, lon: 16.5697 },
  BRU: { city: "Brussels", lat: 50.9014, lon: 4.4844 },
  CRL: { city: "Brussels", lat: 50.4592, lon: 4.4529 },
  CPH: { city: "Copenhagen", lat: 55.618, lon: 12.656 },
  OSL: { city: "Oslo", lat: 60.1939, lon: 11.1004 },
  TRF: { city: "Oslo", lat: 59.1867, lon: 10.2586 },
  ARN: { city: "Stockholm", lat: 59.6519, lon: 17.9186 },
  NYO: { city: "Stockholm", lat: 58.7886, lon: 16.9122 },
  HEL: { city: "Helsinki", lat: 60.3183, lon: 24.9497 },
  DUB: { city: "Dublin", lat: 53.4264, lon: -6.2499 },
  MAN: { city: "Manchester", lat: 53.3619, lon: -2.2728 },
  BHX: { city: "Birmingham", lat: 52.4539, lon: -1.748 },
  EDI: { city: "Edinburgh", lat: 55.9508, lon: -3.3728 },
  GLA: { city: "Glasgow", lat: 55.8719, lon: -4.433 },
  BRS: { city: "Bristol", lat: 51.3827, lon: -2.7191 },
  LPL: { city: "Liverpool", lat: 53.3336, lon: -2.8497 },
  NCE: { city: "Nice", lat: 43.6584, lon: 7.2159 },
  MRS: { city: "Marseille", lat: 43.4365, lon: 5.2214 },
  LYS: { city: "Lyon", lat: 45.7256, lon: 5.0811 },
  TLS: { city: "Toulouse", lat: 43.6293, lon: 1.3638 },
  BOD: { city: "Bordeaux", lat: 44.8283, lon: -0.7156 },
  NTE: { city: "Nantes", lat: 47.1532, lon: -1.6108 },
  LIL: { city: "Lille", lat: 50.5620, lon: 3.0894 },
  SXB: { city: "Strasbourg", lat: 48.5383, lon: 7.6283 },
  BER: { city: "Berlin", lat: 52.3667, lon: 13.5033 },
  HAM: { city: "Hamburg", lat: 53.6304, lon: 9.9882 },
  DUS: { city: "Dusseldorf", lat: 51.2895, lon: 6.7668 },
  CGN: { city: "Cologne", lat: 50.8659, lon: 7.1427 },
  STR: { city: "Stuttgart", lat: 48.69, lon: 9.222 },
  NUE: { city: "Nuremberg", lat: 49.4987, lon: 11.0669 },
  LEJ: { city: "Leipzig", lat: 51.4324, lon: 12.2416 },
  HAJ: { city: "Hanover", lat: 52.4611, lon: 9.6850 },
  BRE: { city: "Bremen", lat: 53.0475, lon: 8.7867 },
  MXP: { city: "Milan", lat: 45.6306, lon: 8.7231 },
  LIN: { city: "Milan", lat: 45.4451, lon: 9.2768 },
  BGY: { city: "Milan", lat: 45.6739, lon: 9.7042 },
  VCE: { city: "Venice", lat: 45.5053, lon: 12.3519 },
  NAP: { city: "Naples", lat: 40.886, lon: 14.2908 },
  PMO: { city: "Palermo", lat: 38.1796, lon: 13.091 },
  CTA: { city: "Catania", lat: 37.4668, lon: 15.0664 },
  BRI: { city: "Bari", lat: 41.1389, lon: 16.7606 },
  BLQ: { city: "Bologna", lat: 44.5354, lon: 11.2887 },
  PSA: { city: "Pisa", lat: 43.6839, lon: 10.3927 },
  FLR: { city: "Florence", lat: 43.8100, lon: 11.2051 },
  TRN: { city: "Turin", lat: 45.2008, lon: 7.6497 },
  GEN: { city: "Genoa", lat: 44.4133, lon: 8.8375 },
  ATH: { city: "Athens", lat: 37.9364, lon: 23.9445 },
  SKG: { city: "Thessaloniki", lat: 40.5197, lon: 22.9709 },
  HER: { city: "Heraklion", lat: 35.3397, lon: 25.1803 },
  RHO: { city: "Rhodes", lat: 36.4054, lon: 28.0862 },
  CFU: { city: "Corfu", lat: 39.6019, lon: 19.9117 },
  SOF: { city: "Sofia", lat: 42.6967, lon: 23.4116 },
  OTP: { city: "Bucharest", lat: 44.5723, lon: 26.102 },
  PRG: { city: "Prague", lat: 50.1008, lon: 14.26 },
  BUD: { city: "Budapest", lat: 47.4298, lon: 19.2611 },
  WAW: { city: "Warsaw", lat: 52.1657, lon: 20.9671 },
  KRK: { city: "Krakow", lat: 50.0777, lon: 19.7848 },
  KTW: { city: "Katowice", lat: 50.4743, lon: 19.0800 },
  GDN: { city: "Gdansk", lat: 54.3776, lon: 18.4662 },
  WRO: { city: "Wroclaw", lat: 51.1027, lon: 16.8858 },
  POZ: { city: "Poznan", lat: 52.4211, lon: 16.8263 },
  RIX: { city: "Riga", lat: 56.9236, lon: 23.9711 },
  TLL: { city: "Tallinn", lat: 59.4133, lon: 24.8328 },
  VNO: { city: "Vilnius", lat: 54.6341, lon: 25.2858 },
  SVQ: { city: "Seville", lat: 37.418, lon: -5.8931 },
  AGP: { city: "Malaga", lat: 36.6749, lon: -4.4991 },
  PMI: { city: "Palma de Mallorca", lat: 39.5517, lon: 2.7388 },
  ALC: { city: "Alicante", lat: 38.2822, lon: -0.5582 },
  VLC: { city: "Valencia", lat: 39.4893, lon: -0.4816 },
  BIO: { city: "Bilbao", lat: 43.3011, lon: -2.9106 },
  LPA: { city: "Gran Canaria", lat: 27.9319, lon: -15.3866 },
  TFS: { city: "Tenerife", lat: 28.0444, lon: -16.5725 },
  TFN: { city: "Tenerife", lat: 28.4827, lon: -16.3415 },
  ACE: { city: "Lanzarote", lat: 28.9455, lon: -13.6052 },
  FUE: { city: "Fuerteventura", lat: 28.4527, lon: -13.8638 },
  LIS: { city: "Lisbon", lat: 38.7756, lon: -9.1354 },
  OPO: { city: "Porto", lat: 41.2481, lon: -8.6814 },
  FAO: { city: "Faro", lat: 37.0144, lon: -7.9659 },
  FNC: { city: "Funchal", lat: 32.6979, lon: -16.7745 },
  PDL: { city: "Ponta Delgada", lat: 37.7412, lon: -25.6979 },
  MLA: { city: "Malta", lat: 35.8574, lon: 14.4775 },
  BEG: { city: "Belgrade", lat: 44.8184, lon: 20.3091 },
  ZAG: { city: "Zagreb", lat: 45.7429, lon: 16.0688 },
  SPU: { city: "Split", lat: 43.5389, lon: 16.2980 },
  DBV: { city: "Dubrovnik", lat: 42.5614, lon: 18.2682 },
  LJU: { city: "Ljubljana", lat: 46.2237, lon: 14.4576 },
  TIA: { city: "Tirana", lat: 41.4147, lon: 19.7206 },
  SKP: { city: "Skopje", lat: 41.9614, lon: 21.6214 },
  SJJ: { city: "Sarajevo", lat: 43.8246, lon: 18.3315 },
  KBP: { city: "Kyiv", lat: 50.345, lon: 30.8947 },
  ODS: { city: "Odesa", lat: 46.4268, lon: 30.6765 },
  LWO: { city: "Lviv", lat: 49.8125, lon: 23.9561 },
  KHI: { city: "Karachi", lat: 24.9065, lon: 67.1608 },
  IST: { city: "Istanbul", lat: 41.2753, lon: 28.7519 },
  SAW: { city: "Istanbul", lat: 40.8986, lon: 29.3092 },
  ADB: { city: "Izmir", lat: 38.2924, lon: 27.1570 },
  ESB: { city: "Ankara", lat: 40.1281, lon: 32.9951 },
  ANK: { city: "Ankara", lat: 39.9455, lon: 32.6888 },
  AYT: { city: "Antalya", lat: 36.8987, lon: 30.8005 },
  BJV: { city: "Bodrum", lat: 37.2506, lon: 27.6643 },
  DLM: { city: "Dalaman", lat: 36.7131, lon: 28.7925 },
  TZX: { city: "Trabzon", lat: 40.9951, lon: 39.7897 },
  // ─ Middle East ──────────────────────────────────────────────────────────────
  DXB: { city: "Dubai", lat: 25.2532, lon: 55.3657 },
  DWC: { city: "Dubai", lat: 24.8963, lon: 55.1614 },
  AUH: { city: "Abu Dhabi", lat: 24.433, lon: 54.6511 },
  SHJ: { city: "Sharjah", lat: 25.3286, lon: 55.5172 },
  DOH: { city: "Doha", lat: 25.2731, lon: 51.608 },
  RUH: { city: "Riyadh", lat: 24.9578, lon: 46.6989 },
  JED: { city: "Jeddah", lat: 21.6796, lon: 39.1565 },
  MED: { city: "Medina", lat: 24.5534, lon: 39.7051 },
  DMM: { city: "Dammam", lat: 26.4712, lon: 49.7979 },
  MCT: { city: "Muscat", lat: 23.5933, lon: 58.2844 },
  KWI: { city: "Kuwait City", lat: 29.2267, lon: 47.9689 },
  BAH: { city: "Bahrain", lat: 26.2708, lon: 50.6336 },
  AMM: { city: "Amman", lat: 31.7226, lon: 35.9932 },
  BEY: { city: "Beirut", lat: 33.8209, lon: 35.4884 },
  TLV: { city: "Tel Aviv", lat: 32.0055, lon: 34.8854 },
  BGW: { city: "Baghdad", lat: 33.2625, lon: 44.2346 },
  IKA: { city: "Tehran", lat: 35.4161, lon: 51.1522 },
  THR: { city: "Tehran", lat: 35.6892, lon: 51.3134 },
  MHD: { city: "Mashhad", lat: 36.2352, lon: 59.6400 },
  // ─ Africa ───────────────────────────────────────────────────────────────────
  CAI: { city: "Cairo", lat: 30.1219, lon: 31.4056 },
  HRG: { city: "Hurghada", lat: 27.1783, lon: 33.7994 },
  SSH: { city: "Sharm el-Sheikh", lat: 27.9773, lon: 34.3950 },
  LXR: { city: "Luxor", lat: 25.6710, lon: 32.7066 },
  CMN: { city: "Casablanca", lat: 33.3675, lon: -7.5897 },
  RAK: { city: "Marrakech", lat: 31.6069, lon: -8.0363 },
  AGA: { city: "Agadir", lat: 30.3250, lon: -9.4131 },
  TNG: { city: "Tangier", lat: 35.7269, lon: -5.9169 },
  TUN: { city: "Tunis", lat: 36.851, lon: 10.2272 },
  ALG: { city: "Algiers", lat: 36.691, lon: 3.2154 },
  ORN: { city: "Oran", lat: 35.6239, lon: -0.6212 },
  TIP: { city: "Tripoli", lat: 32.6635, lon: 13.1590 },
  ADD: { city: "Addis Ababa", lat: 8.9779, lon: 38.7993 },
  NBO: { city: "Nairobi", lat: -1.3192, lon: 36.9275 },
  MBA: { city: "Mombasa", lat: -4.0348, lon: 39.5942 },
  DAR: { city: "Dar es Salaam", lat: -6.8781, lon: 39.2026 },
  EBB: { city: "Kampala", lat: 0.0424, lon: 32.4435 },
  JNB: { city: "Johannesburg", lat: -26.1367, lon: 28.2411 },
  CPT: { city: "Cape Town", lat: -33.9649, lon: 18.6017 },
  DUR: { city: "Durban", lat: -29.6144, lon: 31.1197 },
  PLZ: { city: "Port Elizabeth", lat: -33.9849, lon: 25.6173 },
  LUN: { city: "Lusaka", lat: -15.3308, lon: 28.4526 },
  HRE: { city: "Harare", lat: -17.9318, lon: 31.0929 },
  LAD: { city: "Luanda", lat: -8.8583, lon: 13.2312 },
  DKR: { city: "Dakar", lat: 14.6704, lon: -17.0726 },
  ABJ: { city: "Abidjan", lat: 5.2613, lon: -3.9263 },
  ACC: { city: "Accra", lat: 5.6052, lon: -0.1668 },
  LOS: { city: "Lagos", lat: 6.5774, lon: 3.3212 },
  ABV: { city: "Abuja", lat: 9.0068, lon: 7.2632 },
  NIM: { city: "Niamey", lat: 13.4815, lon: 2.1836 },
  CMR: { city: "Yaounde", lat: 3.8362, lon: 11.5232 },
  NSI: { city: "Yaounde", lat: 3.7223, lon: 11.5532 },
  DLA: { city: "Douala", lat: 4.0061, lon: 9.7197 },
  TNR: { city: "Antananarivo", lat: -18.7969, lon: 47.4788 },
  MRU: { city: "Mauritius", lat: -20.4302, lon: 57.6836 },
  RUN: { city: "Reunion", lat: -20.8871, lon: 55.5103 },
  // ─ South Asia ─────────────────────────────────────────────────────────────
  BOM: { city: "Mumbai", lat: 19.0896, lon: 72.8656 },
  DEL: { city: "Delhi", lat: 28.5665, lon: 77.1031 },
  MAA: { city: "Chennai", lat: 12.9941, lon: 80.1709 },
  CCU: { city: "Kolkata", lat: 22.6547, lon: 88.4467 },
  HYD: { city: "Hyderabad", lat: 17.2403, lon: 78.4294 },
  BLR: { city: "Bangalore", lat: 13.1986, lon: 77.7066 },
  COK: { city: "Kochi", lat: 10.1520, lon: 76.3919 },
  AMD: { city: "Ahmedabad", lat: 23.0772, lon: 72.6347 },
  PNQ: { city: "Pune", lat: 18.5822, lon: 73.9197 },
  GOI: { city: "Goa", lat: 15.3808, lon: 73.8314 },
  JAI: { city: "Jaipur", lat: 26.8242, lon: 75.8122 },
  LKO: { city: "Lucknow", lat: 26.7606, lon: 80.8893 },
  CMB: { city: "Colombo", lat: 7.1808, lon: 79.8841 },
  DAC: { city: "Dhaka", lat: 23.8433, lon: 90.3978 },
  KTM: { city: "Kathmandu", lat: 27.6966, lon: 85.3591 },
  // ─ East & South-East Asia ────────────────────────────────────────────────
  SIN: { city: "Singapore", lat: 1.3644, lon: 103.9915 },
  HKG: { city: "Hong Kong", lat: 22.308, lon: 113.9185 },
  NRT: { city: "Tokyo", lat: 35.772, lon: 140.3929 },
  HND: { city: "Tokyo", lat: 35.5494, lon: 139.7798 },
  ICN: { city: "Seoul", lat: 37.4602, lon: 126.4407 },
  GMP: { city: "Seoul", lat: 37.5583, lon: 126.7906 },
  PEK: { city: "Beijing", lat: 40.0801, lon: 116.5846 },
  PKX: { city: "Beijing", lat: 39.5097, lon: 116.4105 },
  PVG: { city: "Shanghai", lat: 31.1443, lon: 121.8083 },
  SHA: { city: "Shanghai", lat: 31.1979, lon: 121.3368 },
  CAN: { city: "Guangzhou", lat: 23.3924, lon: 113.299 },
  SZX: { city: "Shenzhen", lat: 22.6393, lon: 113.8107 },
  CTU: { city: "Chengdu", lat: 30.5786, lon: 103.9478 },
  TFU: { city: "Chengdu", lat: 30.3128, lon: 103.9467 },
  XIY: { city: "Xi'an", lat: 34.4471, lon: 108.7517 },
  WUH: { city: "Wuhan", lat: 30.7838, lon: 114.2081 },
  CSX: { city: "Changsha", lat: 28.1892, lon: 113.2200 },
  HAK: { city: "Haikou", lat: 19.9349, lon: 110.4590 },
  SYX: { city: "Sanya", lat: 18.3029, lon: 109.4122 },
  KMG: { city: "Kunming", lat: 24.9924, lon: 102.7433 },
  TSN: { city: "Tianjin", lat: 39.1244, lon: 117.3464 },
  NKG: { city: "Nanjing", lat: 31.7420, lon: 118.8620 },
  CKG: { city: "Chongqing", lat: 29.7192, lon: 106.6417 },
  TAO: { city: "Qingdao", lat: 36.2661, lon: 120.3747 },
  XMN: { city: "Xiamen", lat: 24.5440, lon: 118.1277 },
  TPE: { city: "Taipei", lat: 25.0777, lon: 121.2328 },
  TSA: { city: "Taipei", lat: 25.0633, lon: 121.5522 },
  BKK: { city: "Bangkok", lat: 13.6811, lon: 100.7475 },
  DMK: { city: "Bangkok", lat: 13.9126, lon: 100.6070 },
  HKT: { city: "Phuket", lat: 8.1132, lon: 98.3169 },
  CNX: { city: "Chiang Mai", lat: 18.7668, lon: 98.9627 },
  KUL: { city: "Kuala Lumpur", lat: 2.7456, lon: 101.7072 },
  KBR: { city: "Kota Bharu", lat: 6.1669, lon: 102.2932 },
  CGK: { city: "Jakarta", lat: -6.1256, lon: 106.6559 },
  SUB: { city: "Surabaya", lat: -7.3798, lon: 112.7867 },
  DPS: { city: "Bali", lat: -8.7482, lon: 115.1668 },
  MNL: { city: "Manila", lat: 14.5086, lon: 121.0197 },
  CEB: { city: "Cebu", lat: 10.3075, lon: 123.9790 },
  SGN: { city: "Ho Chi Minh City", lat: 10.8188, lon: 106.6520 },
  HAN: { city: "Hanoi", lat: 21.2212, lon: 105.8072 },
  DAD: { city: "Da Nang", lat: 16.0439, lon: 108.1992 },
  PNH: { city: "Phnom Penh", lat: 11.5466, lon: 104.8440 },
  REP: { city: "Siem Reap", lat: 13.4107, lon: 103.8130 },
  VTE: { city: "Vientiane", lat: 17.9883, lon: 102.5633 },
  RGN: { city: "Yangon", lat: 16.9073, lon: 96.1332 },
  // ─ Oceania ───────────────────────────────────────────────────────────────────
  SYD: { city: "Sydney", lat: -33.9399, lon: 151.1753 },
  MEL: { city: "Melbourne", lat: -37.6733, lon: 144.843 },
  BNE: { city: "Brisbane", lat: -27.3842, lon: 153.1175 },
  PER: { city: "Perth", lat: -31.9403, lon: 115.9669 },
  ADL: { city: "Adelaide", lat: -34.9450, lon: 138.5306 },
  OOL: { city: "Gold Coast", lat: -28.1644, lon: 153.5046 },
  CBR: { city: "Canberra", lat: -35.3069, lon: 149.1950 },
  AKL: { city: "Auckland", lat: -37.0082, lon: 174.7850 },
  WLG: { city: "Wellington", lat: -41.3272, lon: 174.8051 },
  CHC: { city: "Christchurch", lat: -43.4894, lon: 172.5322 },
  NAN: { city: "Nadi", lat: -17.7554, lon: 177.4430 },
  PPT: { city: "Papeete", lat: -17.5537, lon: -149.6067 },
};

// ─── On-demand coordinate cache ─────────────────────────────────────────────────────────────
const runtimeAirportCache: Record<string, { city: string; lat: number; lon: number }> = {};

function resolveCoords(iata: string): { city: string; lat: number; lon: number } | undefined {
  return AIRPORTS[iata] ?? runtimeAirportCache[iata];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function cacheAirportFromApiResponse(iata: string, obj: any, city: string): void {
  if (!iata || resolveCoords(iata)) return;
  const loc =
    obj?.location ??
    obj?.airport?.location ??
    obj?.position ??
    obj?.airport?.position;
  const lat = loc?.lat ?? loc?.latitude ?? obj?.lat ?? obj?.latitude;
  const lon = loc?.lon ?? loc?.lng ?? loc?.longitude ?? obj?.lon ?? obj?.lng ?? obj?.longitude;
  if (typeof lat === "number" && typeof lon === "number") {
    runtimeAirportCache[iata] = { city: city || iata, lat, lon };
    console.log(`[AirportCache] Cached ${iata} from API response (${lat}, ${lon})`);
  }
}

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
  if (isoOrTime.length > 10 && isoOrTime[10] === " ") return isoOrTime.substring(11, 16);
  return isoOrTime.substring(0, 5);
}

function icaoToReadable(icao: string): string {
  const map: Record<string, string> = {
    B738: "Boeing 737-800", B739: "Boeing 737-900",
    B37M: "Boeing 737 MAX 7", B38M: "Boeing 737 MAX 8", B39M: "Boeing 737 MAX 9",
    B788: "Boeing 787-8 Dreamliner", B789: "Boeing 787-9 Dreamliner", B78X: "Boeing 787-10 Dreamliner",
    B77W: "Boeing 777-300ER", B772: "Boeing 777-200",
    B748: "Boeing 747-8", B744: "Boeing 747-400",
    B763: "Boeing 767-300ER", B752: "Boeing 757-200",
    A19N: "Airbus A319neo", A20N: "Airbus A320neo", A21N: "Airbus A321neo",
    A319: "Airbus A319", A320: "Airbus A320", A321: "Airbus A321",
    A332: "Airbus A330-200", A333: "Airbus A330-300", A339: "Airbus A330-900neo",
    A359: "Airbus A350-900", A35K: "Airbus A350-1000", A388: "Airbus A380-800",
    E170: "Embraer E170", E175: "Embraer E175", E190: "Embraer E190", E195: "Embraer E195",
    CRJ9: "Bombardier CRJ-900", AT75: "ATR 72-500", AT76: "ATR 72-600", DH8D: "Bombardier Q400",
  };
  return map[icao.toUpperCase()] || icao;
}

function aircraftEfficiencyMultiplier(aircraftModel: string): number {
  const m = aircraftModel.toLowerCase();
  if (m.includes("787") || m.includes("dreamliner")) return 0.80;
  if (m.includes("a350")) return 0.80;
  if (m.includes("a330-900") || m.includes("a330neo") || m.includes("a339")) return 0.82;
  if (m.includes("747") || m.includes("a380")) return 1.10;
  if (m.includes("777") || m.includes("a330") || m.includes("a340") || m.includes("767")) return 1.00;
  if (m.includes("a320neo") || m.includes("a321neo") || m.includes("a319neo")) return 0.88;
  if (m.includes("737 max") || m.includes("737max")) return 0.88;
  if (m.includes("a320") || m.includes("a321") || m.includes("a319")) return 1.00;
  if (m.includes("737") || m.includes("757")) return 1.00;
  if (
    m.includes("embraer") || m.includes("e170") || m.includes("e175") ||
    m.includes("e190") || m.includes("e195") || m.includes("crj") ||
    m.includes("atr") || m.includes("q400") || m.includes("bombardier")
  ) return 1.20;
  return 1.00;
}

function calcCo2Kg(distKm: number, aircraftModel?: string): number {
  let kgPerKm: number;
  if (distKm < 500)       kgPerKm = 0.255;
  else if (distKm < 1500) kgPerKm = 0.195;
  else if (distKm < 4000) kgPerKm = 0.145;
  else                    kgPerKm = 0.113;
  const aircraftFactor = aircraftModel ? aircraftEfficiencyMultiplier(aircraftModel) : 1.00;
  const RFI = 2.0;
  return Math.round(distKm * kgPerKm * aircraftFactor * RFI);
}

function calcDistAndCo2(
  depIata: string,
  arrIata: string,
  aircraftModel?: string,
): { distMiles: number; co2Kg: number } {
  const dep = resolveCoords(depIata);
  const arr = resolveCoords(arrIata);
  if (!dep || !arr) return { distMiles: 0, co2Kg: 0 };
  const distKm = haversineKm(dep.lat, dep.lon, arr.lat, arr.lon);
  return {
    distMiles: Math.round(kmToMiles(distKm)),
    co2Kg: calcCo2Kg(distKm, aircraftModel),
  };
}

function resolveIata(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  airportObj: any,
  hint?: string,
): string {
  if (!airportObj) return hint?.toUpperCase() ?? "";
  const directIata = airportObj.iata ?? airportObj.IATA ?? "";
  if (directIata && directIata.length === 3) return directIata.toUpperCase();
  const nested = airportObj.airport ?? airportObj.Airport;
  if (nested) {
    const nestedIata = nested.iata ?? nested.IATA ?? "";
    if (nestedIata && nestedIata.length === 3) return nestedIata.toUpperCase();
    const icao = nested.icao ?? nested.ICAO ?? "";
    if (icao && icao.length === 4) {
      const candidate = icao.slice(1).toUpperCase();
      if (resolveCoords(candidate)) return candidate;
    }
  }
  const shortName = airportObj.shortName ?? "";
  if (shortName && shortName.length === 3 && /^[A-Z]{3}$/.test(shortName.toUpperCase())) {
    return shortName.toUpperCase();
  }
  const icao = airportObj.icao ?? airportObj.ICAO ?? "";
  if (icao && icao.length === 4) {
    const candidate = icao.slice(1).toUpperCase();
    if (resolveCoords(candidate)) return candidate;
  }
  return hint?.toUpperCase() ?? "";
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

  const dep = resolveCoords(depIata) ?? resolveCoords("JFK")!;
  const arr = resolveCoords(arrIata) ?? resolveCoords("LAX")!;
  const aircraft = AIRCRAFT_POOL[seed % AIRCRAFT_POOL.length];
  const distKm = haversineKm(dep.lat, dep.lon, arr.lat, arr.lon);
  const distMiles = Math.round(kmToMiles(distKm));
  const durationMinutes = Math.round((distKm / 870) * 60 + 30);
  const co2Kg = calcCo2Kg(distKm, aircraft);
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
    tailNumber: undefined as string | undefined,
    departureTerminal: undefined as string | undefined,
    arrivalTerminal: undefined as string | undefined,
    departureGate: undefined as string | undefined,
    arrivalGate: undefined as string | undefined,
  };
}

// ─── AeroDataBox interfaces ───────────────────────────────────────────────────

interface AeroDataBoxAirport {
  iata?: string;
  icao?: string;
  name?: string;
  municipalityName?: string;
  shortName?: string;
  countryCode?: string;
  terminal?: string | null;
  gate?: string | null;
  scheduledTime?: { local?: string; utc?: string };
  actualTime?: { local?: string; utc?: string };
  runwayTime?: { local?: string; utc?: string };
  delay?: number | null;
  quality?: string[];
  location?: { lat?: number; lon?: number; lng?: number };
  airport?: {
    iata?: string;
    icao?: string;
    name?: string;
    municipalityName?: string;
    shortName?: string;
    location?: { lat?: number; lon?: number; lng?: number };
  };
}

interface AeroDataBoxAircraft {
  reg?: string | null;
  modeS?: string | null;
  model?: string | null;
  image?: { url?: string; webUrl?: string; author?: string; title?: string; license?: string; htmlAttributions?: string[] } | null;
}

interface AeroDataBoxFlight {
  greatCircleDistance?: { km?: number; mile?: number; nm?: number };
  departure?: AeroDataBoxAirport;
  arrival?: AeroDataBoxAirport;
  lastUpdatedUtc?: string;
  number?: string;
  callSign?: string | null;
  status?: string;
  codeshareStatus?: string;
  isCargo?: boolean;
  airline?: { name?: string; iata?: string; icao?: string };
  aircraft?: AeroDataBoxAircraft | null;
  duration?: { scheduledMs?: number; actualMs?: number } | null;
}

// ─── Airport schedule item (AeroDataBox /flights/airports/iata) ───────────────
interface AeroDataBoxScheduleItem {
  number?: string;
  callSign?: string | null;
  status?: string;
  codeshareStatus?: string;
  isCargo?: boolean;
  airline?: { name?: string; iata?: string; icao?: string };
  aircraft?: AeroDataBoxAircraft | null;
  departure?: AeroDataBoxAirport;
  arrival?: AeroDataBoxAirport;
  greatCircleDistance?: { km?: number; mile?: number; nm?: number };
  duration?: { scheduledMs?: number; actualMs?: number } | null;
}

type FlightResult = ReturnType<typeof generateMockFlight>;

// ─── AeroDataBox flight-number lookup ────────────────────────────────────────

async function lookupFromAeroDataBox(
  code: string,
  date: string,
  hintDep?: string,
  hintArr?: string,
): Promise<FlightResult | null> {
  const apiKey = process.env.AERODATABOX_API_KEY;
  if (!apiKey) {
    console.log("[AeroDataBox] No API key found — skipping");
    return null;
  }

  const flightNumber = code.replace(/\s+/g, "").toUpperCase();
  const url = `https://aerodatabox.p.rapidapi.com/flights/number/${flightNumber}/${date}`;
  console.log(`[AeroDataBox] GET ${url}`);

  try {
    const res = await fetch(url, {
      method: "GET",
      headers: {
        "x-rapidapi-host": "aerodatabox.p.rapidapi.com",
        "x-rapidapi-key": apiKey,
      },
      signal: AbortSignal.timeout(8000),
    });

    if (res.status === 404) {
      console.log(`[AeroDataBox] 404 — flight not found for ${flightNumber} on ${date}`);
      return null;
    }
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error(`[AeroDataBox] HTTP ${res.status} — ${body.slice(0, 200)}`);
      return null;
    }

    const data = (await res.json()) as AeroDataBoxFlight[];
    console.log(`[AeroDataBox] Got ${data?.length ?? 0} result(s)`);
    if (!Array.isArray(data) || data.length === 0) return null;

    console.log("[AeroDataBox] departure shape:", JSON.stringify(data[0]?.departure ?? null));
    console.log("[AeroDataBox] arrival shape:", JSON.stringify(data[0]?.arrival ?? null));

    const flight =
      data.find((f) => f.codeshareStatus === "IsOperatedAs" || f.codeshareStatus === "IsOperating") ??
      data[0];

    const depIata = resolveIata(flight.departure, hintDep);
    const arrIata = resolveIata(flight.arrival, hintArr);

    console.log(`[AeroDataBox] Resolved IATA: dep=${depIata || "(empty)"} arr=${arrIata || "(empty)"}`);

    if (!depIata || !arrIata) {
      console.warn(
        `[AeroDataBox] Could not resolve IATA codes (dep="${depIata}" arr="${arrIata}") — falling back to mock`,
      );
      return null;
    }

    const depCity =
      AIRPORTS[depIata]?.city ??
      flight.departure?.municipalityName ??
      flight.departure?.airport?.municipalityName ??
      flight.departure?.airport?.name ??
      depIata;
    const arrCity =
      AIRPORTS[arrIata]?.city ??
      flight.arrival?.municipalityName ??
      flight.arrival?.airport?.municipalityName ??
      flight.arrival?.airport?.name ??
      arrIata;

    cacheAirportFromApiResponse(depIata, flight.departure, depCity);
    cacheAirportFromApiResponse(arrIata, flight.arrival, arrCity);

    const depTimeRaw =
      flight.departure?.actualTime?.local ??
      flight.departure?.runwayTime?.local ??
      flight.departure?.scheduledTime?.local;
    const arrTimeRaw =
      flight.arrival?.actualTime?.local ??
      flight.arrival?.runwayTime?.local ??
      flight.arrival?.scheduledTime?.local;

    const departureTime = toHHMM(depTimeRaw);
    const arrivalTime = toHHMM(arrTimeRaw);

    let durationMinutes: number;
    if (flight.duration?.actualMs) {
      durationMinutes = Math.round(flight.duration.actualMs / 60000);
    } else if (flight.duration?.scheduledMs) {
      durationMinutes = Math.round(flight.duration.scheduledMs / 60000);
    } else {
      const depCoords = resolveCoords(depIata);
      const arrCoords = resolveCoords(arrIata);
      durationMinutes =
        depCoords && arrCoords
          ? Math.round((haversineKm(depCoords.lat, depCoords.lon, arrCoords.lat, arrCoords.lon) / 870) * 60 + 30)
          : 120;
    }

    const aircraftModel =
      flight.aircraft?.model
        ? (flight.aircraft.model.includes(" ") ? flight.aircraft.model : icaoToReadable(flight.aircraft.model))
        : "Commercial Aircraft";

    let distMiles: number;
    let co2Kg: number;
    if (flight.greatCircleDistance?.mile) {
      distMiles = Math.round(flight.greatCircleDistance.mile);
      const distKm = flight.greatCircleDistance.km ?? distMiles / 0.621371;
      co2Kg = calcCo2Kg(distKm, aircraftModel);
    } else {
      const calc = calcDistAndCo2(depIata, arrIata, aircraftModel);
      distMiles = calc.distMiles;
      co2Kg = calc.co2Kg;
    }

    if (distMiles === 0) {
      console.warn(
        `[AeroDataBox] Distance unknown for ${depIata}→${arrIata}: airport not in static table or runtime cache, ` +
        `and AeroDataBox did not supply greatCircleDistance. Displaying N/A in UI.`
      );
    }

    const delayMinutes = flight.departure?.delay ?? flight.arrival?.delay ?? 0;
    const rawStatus = (flight.status ?? "").toLowerCase();
    const status: "on_time" | "delayed" =
      rawStatus === "cancelled" || rawStatus === "diverted" || rawStatus === "incident"
        ? "delayed"
        : (delayMinutes ?? 0) > 15
        ? "delayed"
        : "on_time";

    const airlineCode = flight.airline?.iata?.toUpperCase() ?? extractAirlineCode(code);
    const airlineName = AIRLINES[airlineCode] ?? flight.airline?.name ?? "Unknown Airlines";

    console.log(
      `[AeroDataBox] Resolved: ${depIata}→${arrIata} | ${departureTime}-${arrivalTime} | ${
        distMiles > 0 ? distMiles + "mi" : "dist=N/A"
      } | co2=${co2Kg}kg | status=${status} | isMock=false`,
    );

    return {
      flightCode: flight.number ?? code,
      date,
      airline: airlineName,
      airlineCode,
      departureAirport: depIata,
      arrivalAirport: arrIata,
      departureCity: depCity,
      arrivalCity: arrCity,
      departureTime,
      arrivalTime,
      durationMinutes,
      distanceMiles: distMiles,
      co2Kg,
      status,
      delayMinutes: delayMinutes ?? 0,
      aircraft: aircraftModel,
      isMock: false,
      tailNumber: flight.aircraft?.reg ?? undefined,
      departureTerminal: flight.departure?.terminal || undefined,
      arrivalTerminal: flight.arrival?.terminal || undefined,
      departureGate: flight.departure?.gate || undefined,
      arrivalGate: flight.arrival?.gate || undefined,
    };
  } catch (err) {
    console.error("[AeroDataBox] fetch error:", err);
    return null;
  }
}

// ─── AeroDataBox airport schedule lookup ─────────────────────────────────────
//
// Calls GET /flights/airports/iata/{iataCode}/{fromDateTime}/{toDateTime}
// Returns all (non-cargo) scheduled flights for that airport on the given date.
// If filterArrival is provided, results are filtered to that destination/origin.

async function lookupScheduleFromAeroDataBox(
  airport: string,
  date: string,
  direction: "Departure" | "Arrival",
  filterCounterpart?: string,
): Promise<FlightResult[]> {
  const apiKey = process.env.AERODATABOX_API_KEY;
  if (!apiKey) {
    console.log("[AeroDataBox/Schedule] No API key — returning empty list");
    return [];
  }

  const from = `${date}T00:00`;
  const to   = `${date}T23:59`;
  const url  =
    `https://aerodatabox.p.rapidapi.com/flights/airports/iata/${airport}/${from}/${to}` +
    `?withLeg=true&direction=${direction}&withCancelled=false&withCodeshared=false&withCargo=false&withPrivate=false`;

  console.log(`[AeroDataBox/Schedule] GET ${url}`);

  try {
    const res = await fetch(url, {
      method: "GET",
      headers: {
        "x-rapidapi-host": "aerodatabox.p.rapidapi.com",
        "x-rapidapi-key": apiKey,
      },
      signal: AbortSignal.timeout(12000),
    });

    if (res.status === 404) {
      console.log(`[AeroDataBox/Schedule] 404 for ${airport} on ${date}`);
      return [];
    }
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error(`[AeroDataBox/Schedule] HTTP ${res.status} — ${body.slice(0, 200)}`);
      return [];
    }

    const data = (await res.json()) as { departures?: AeroDataBoxScheduleItem[]; arrivals?: AeroDataBoxScheduleItem[] };
    const items: AeroDataBoxScheduleItem[] =
      (direction === "Departure" ? data.departures : data.arrivals) ?? [];

    console.log(`[AeroDataBox/Schedule] Got ${items.length} ${direction} item(s) for ${airport}`);

    const results: FlightResult[] = [];

    for (const item of items) {
      if (!item.number) continue;

      const depIata = direction === "Departure"
        ? airport.toUpperCase()
        : resolveIata(item.departure);
      const arrIata = direction === "Arrival"
        ? airport.toUpperCase()
        : resolveIata(item.arrival);

      if (!depIata || !arrIata) continue;

      // Apply counterpart filter when both airports are specified
      if (filterCounterpart) {
        const counterpart = filterCounterpart.toUpperCase();
        if (direction === "Departure" && arrIata !== counterpart) continue;
        if (direction === "Arrival"   && depIata !== counterpart) continue;
      }

      const depCity =
        AIRPORTS[depIata]?.city ??
        item.departure?.municipalityName ??
        item.departure?.airport?.municipalityName ??
        depIata;
      const arrCity =
        AIRPORTS[arrIata]?.city ??
        item.arrival?.municipalityName ??
        item.arrival?.airport?.municipalityName ??
        arrIata;

      cacheAirportFromApiResponse(depIata, item.departure, depCity);
      cacheAirportFromApiResponse(arrIata, item.arrival, arrCity);

      const depTimeRaw =
        item.departure?.actualTime?.local ??
        item.departure?.runwayTime?.local ??
        item.departure?.scheduledTime?.local;
      const arrTimeRaw =
        item.arrival?.actualTime?.local ??
        item.arrival?.runwayTime?.local ??
        item.arrival?.scheduledTime?.local;

      const departureTime = toHHMM(depTimeRaw);
      const arrivalTime   = toHHMM(arrTimeRaw);

      let durationMinutes: number;
      if (item.duration?.actualMs) {
        durationMinutes = Math.round(item.duration.actualMs / 60000);
      } else if (item.duration?.scheduledMs) {
        durationMinutes = Math.round(item.duration.scheduledMs / 60000);
      } else {
        const dC = resolveCoords(depIata);
        const aC = resolveCoords(arrIata);
        durationMinutes = dC && aC
          ? Math.round((haversineKm(dC.lat, dC.lon, aC.lat, aC.lon) / 870) * 60 + 30)
          : 120;
      }

      const aircraftModel = item.aircraft?.model
        ? (item.aircraft.model.includes(" ") ? item.aircraft.model : icaoToReadable(item.aircraft.model))
        : "Commercial Aircraft";

      let distMiles: number;
      let co2Kg: number;
      if (item.greatCircleDistance?.mile) {
        distMiles = Math.round(item.greatCircleDistance.mile);
        const distKm = item.greatCircleDistance.km ?? distMiles / 0.621371;
        co2Kg = calcCo2Kg(distKm, aircraftModel);
      } else {
        const calc = calcDistAndCo2(depIata, arrIata, aircraftModel);
        distMiles = calc.distMiles;
        co2Kg = calc.co2Kg;
      }

      const delayMinutes = item.departure?.delay ?? item.arrival?.delay ?? 0;
      const rawStatus = (item.status ?? "").toLowerCase();
      const status: "on_time" | "delayed" =
        rawStatus === "cancelled" || rawStatus === "diverted" || rawStatus === "incident"
          ? "delayed"
          : (delayMinutes ?? 0) > 15
          ? "delayed"
          : "on_time";

      const airlineCode = item.airline?.iata?.toUpperCase() ?? extractAirlineCode(item.number);
      const airlineName = AIRLINES[airlineCode] ?? item.airline?.name ?? "Unknown Airlines";

      results.push({
        flightCode: item.number,
        date,
        airline: airlineName,
        airlineCode,
        departureAirport: depIata,
        arrivalAirport: arrIata,
        departureCity: depCity,
        arrivalCity: arrCity,
        departureTime,
        arrivalTime,
        durationMinutes,
        distanceMiles: distMiles,
        co2Kg,
        status,
        delayMinutes: delayMinutes ?? 0,
        aircraft: aircraftModel,
        isMock: false,
        tailNumber: item.aircraft?.reg ?? undefined,
        departureTerminal: item.departure?.terminal || undefined,
        arrivalTerminal: item.arrival?.terminal || undefined,
        departureGate: item.departure?.gate || undefined,
        arrivalGate: item.arrival?.gate || undefined,
      });
    }

    return results;
  } catch (err) {
    console.error("[AeroDataBox/Schedule] fetch error:", err);
    return [];
  }
}

// ─── Public entrypoints ───────────────────────────────────────────────────────

export async function lookupFlight(
  code: string,
  date: string,
  dep?: string,
  arr?: string,
) {
  const aeroResult = await lookupFromAeroDataBox(code, date, dep, arr);
  if (aeroResult) return aeroResult;
  console.log(`[lookupFlight] AeroDataBox returned nothing — falling back to mock for ${code} ${date}`);
  return generateMockFlight(code, date, dep, arr);
}

/**
 * Look up all flights for a given airport + date.
 *
 * @param dep  Departure airport IATA (e.g. "ZRH"). Provide this to get departures.
 * @param arr  Arrival airport IATA (e.g. "LHR"). Provide this to get arrivals.
 * @param date Date in YYYY-MM-DD format.
 *
 * Logic:
 *  - Only dep given  → fetch departures from dep
 *  - Only arr given  → fetch arrivals at arr
 *  - Both given      → fetch departures from dep filtered to arr
 *
 * Returns empty array (never mock) if API key is absent or call fails.
 */
export async function lookupFlightsByAirport(
  dep: string | undefined,
  arr: string | undefined,
  date: string,
): Promise<FlightResult[]> {
  if (dep && arr) {
    return lookupScheduleFromAeroDataBox(dep.toUpperCase(), date, "Departure", arr.toUpperCase());
  }
  if (dep) {
    return lookupScheduleFromAeroDataBox(dep.toUpperCase(), date, "Departure");
  }
  if (arr) {
    return lookupScheduleFromAeroDataBox(arr.toUpperCase(), date, "Arrival");
  }
  return [];
}
