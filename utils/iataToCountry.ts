/**
 * IATA airport code → ISO 3166-1 alpha-2 country code
 * Used to render real country flags via react-native-country-flag.
 */
const IATA_TO_COUNTRY: Record<string, string> = {
  // United States
  JFK: "US", LGA: "US", EWR: "US", LAX: "US", ORD: "US", MDW: "US",
  ATL: "US", DFW: "US", DAL: "US", DEN: "US", SFO: "US", SJC: "US",
  OAK: "US", SEA: "US", MIA: "US", FLL: "US", BOS: "US", PHX: "US",
  MCO: "US", TPA: "US", IAH: "US", HOU: "US", MSP: "US", DTW: "US",
  PHL: "US", CLT: "US", LAS: "US", BWI: "US", DCA: "US", IAD: "US",
  SLC: "US", PDX: "US", SAN: "US", AUS: "US", MSY: "US", RDU: "US",
  BNA: "US", STL: "US", MCI: "US", CLE: "US", PIT: "US", IND: "US",
  CMH: "US", MKE: "US", OMA: "US", ABQ: "US", BUR: "US", LGB: "US",
  ONT: "US", SMF: "US", SNA: "US",
  // Canada
  YYZ: "CA", YUL: "CA", YVR: "CA", YYC: "CA", YEG: "CA", YOW: "CA", YHZ: "CA",
  // Brazil
  GRU: "BR", CGH: "BR", GIG: "BR", SDU: "BR", BSB: "BR",
  SSA: "BR", FOR: "BR", REC: "BR", POA: "BR",
  // Argentina
  EZE: "AR", AEP: "AR",
  // Chile
  SCL: "CL",
  // Colombia
  BOG: "CO",
  // Peru
  LIM: "PE",
  // Ecuador
  UIO: "EC", GYE: "EC",
  // Venezuela
  CCS: "VE",
  // Panama
  PTY: "PA",
  // Costa Rica
  SJO: "CR",
  // Mexico
  MEX: "MX", CUN: "MX", GDL: "MX", MTY: "MX",
  // Cuba
  HAV: "CU",
  // Dominican Republic
  SDQ: "DO",
  // Puerto Rico
  SJU: "PR",
  // United Kingdom
  LHR: "GB", LGW: "GB", STN: "GB", LTN: "GB", LCY: "GB", SEN: "GB",
  MAN: "GB", BHX: "GB", EDI: "GB", GLA: "GB", BRS: "GB", LPL: "GB",
  // France
  CDG: "FR", ORY: "FR", NCE: "FR", MRS: "FR", LYS: "FR",
  TLS: "FR", BOD: "FR", NTE: "FR", LIL: "FR", SXB: "FR",
  // Germany
  FRA: "DE", MUC: "DE", BER: "DE", HAM: "DE", DUS: "DE",
  CGN: "DE", STR: "DE", NUE: "DE", LEJ: "DE", HAJ: "DE", BRE: "DE",
  // Netherlands
  AMS: "NL",
  // Spain
  MAD: "ES", BCN: "ES", SVQ: "ES", AGP: "ES", PMI: "ES",
  ALC: "ES", VLC: "ES", BIO: "ES", LPA: "ES", TFS: "ES",
  TFN: "ES", ACE: "ES", FUE: "ES",
  // Portugal
  LIS: "PT", OPO: "PT", FAO: "PT", FNC: "PT", PDL: "PT",
  // Italy
  FCO: "IT", MXP: "IT", LIN: "IT", BGY: "IT", VCE: "IT",
  NAP: "IT", PMO: "IT", CTA: "IT", BRI: "IT", BLQ: "IT",
  PSA: "IT", FLR: "IT", TRN: "IT", GEN: "IT",
  // Switzerland
  GVA: "CH", ZRH: "CH", BSL: "CH",
  // Austria
  VIE: "AT",
  // Belgium
  BRU: "BE", CRL: "BE",
  // Denmark
  CPH: "DK",
  // Norway
  OSL: "NO", TRF: "NO",
  // Sweden
  ARN: "SE", NYO: "SE",
  // Finland
  HEL: "FI",
  // Ireland
  DUB: "IE",
  // Greece
  ATH: "GR", SKG: "GR", HER: "GR", RHO: "GR", CFU: "GR",
  // Bulgaria
  SOF: "BG",
  // Romania
  OTP: "RO",
  // Czech Republic
  PRG: "CZ",
  // Hungary
  BUD: "HU",
  // Poland
  WAW: "PL", KRK: "PL", KTW: "PL", GDN: "PL", WRO: "PL", POZ: "PL",
  // Latvia
  RIX: "LV",
  // Estonia
  TLL: "EE",
  // Lithuania
  VNO: "LT",
  // Malta
  MLA: "MT",
  // Serbia
  BEG: "RS",
  // Croatia
  ZAG: "HR", SPU: "HR", DBV: "HR",
  // Slovenia
  LJU: "SI",
  // Albania
  TIA: "AL",
  // North Macedonia
  SKP: "MK",
  // Bosnia and Herzegovina
  SJJ: "BA",
  // Ukraine
  KBP: "UA",
  // Turkey
  IST: "TR", SAW: "TR", ADB: "TR", ESB: "TR", AYT: "TR", BJV: "TR", DLM: "TR",
  // UAE
  DXB: "AE", DWC: "AE", AUH: "AE",
  // Qatar
  DOH: "QA",
  // Saudi Arabia
  RUH: "SA", JED: "SA",
  // Oman
  MCT: "OM",
  // Kuwait
  KWI: "KW",
  // Bahrain
  BAH: "BH",
  // Jordan
  AMM: "JO",
  // Lebanon
  BEY: "LB",
  // Israel
  TLV: "IL",
  // Egypt
  CAI: "EG", HRG: "EG", SSH: "EG",
  // Morocco
  CMN: "MA", RAK: "MA",
  // Tunisia
  TUN: "TN",
  // Algeria
  ALG: "DZ",
  // Ethiopia
  ADD: "ET",
  // Kenya
  NBO: "KE",
  // South Africa
  JNB: "ZA", CPT: "ZA",
  // Nigeria
  LOS: "NG",
  // Ghana
  ACC: "GH",
  // Senegal
  DKR: "SN",
  // India
  BOM: "IN", DEL: "IN", MAA: "IN", CCU: "IN", HYD: "IN", BLR: "IN", GOI: "IN",
  // Sri Lanka
  CMB: "LK",
  // Bangladesh
  DAC: "BD",
  // Nepal
  KTM: "NP",
  // Pakistan
  KHI: "PK",
  // Singapore
  SIN: "SG",
  // Hong Kong
  HKG: "HK",
  // Japan
  NRT: "JP", HND: "JP",
  // South Korea
  ICN: "KR", GMP: "KR",
  // China
  PEK: "CN", PKX: "CN", PVG: "CN", SHA: "CN", CAN: "CN", CTU: "CN",
  // Taiwan
  TPE: "TW",
  // Thailand
  BKK: "TH", DMK: "TH", HKT: "TH", CNX: "TH",
  // Malaysia
  KUL: "MY",
  // Indonesia
  CGK: "ID", DPS: "ID",
  // Philippines
  MNL: "PH",
  // Vietnam
  SGN: "VN", HAN: "VN",
  // Australia
  SYD: "AU", MEL: "AU", BNE: "AU", PER: "AU",
  // New Zealand
  AKL: "NZ", WLG: "NZ", CHC: "NZ",
};

/**
 * Returns the ISO 3166-1 alpha-2 country code for a given IATA airport code.
 * Falls back to undefined if unknown.
 */
export function iataToCountry(iata: string): string | undefined {
  return IATA_TO_COUNTRY[iata?.toUpperCase()];
}

export default IATA_TO_COUNTRY;
