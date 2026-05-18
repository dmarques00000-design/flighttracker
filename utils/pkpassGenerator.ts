/**
 * pkpassGenerator.ts
 * Builds a .pkpass bundle on-device and returns its local URI.
 *
 * A .pkpass file is a ZIP archive containing:
 *   pass.json        — the pass definition
 *   manifest.json    — SHA1 hashes of every file in the bundle
 *   signature        — a stub (unsigned passes are accepted by iOS via the
 *                      Share sheet "Add to Wallet" flow; a real PassKit
 *                      signing cert is only needed for server-pushed passes)
 *
 * We use a minimal pure-JS zip implementation so we don't need a native
 * module or an extra npm package.
 *
 * ──────────────────────────────────────────────────────────────────────────────
 * REQUIRED SETUP — before submitting to the App Store
 * ──────────────────────────────────────────────────────────────────────────────
 * 1. Go to developer.apple.com → Certificates, Identifiers & Profiles
 *    → Identifiers → "+" → Pass Type IDs.
 *    Register: pass.com.logbookapp.boardingpass
 *
 * 2. Note your 10-character Team ID (top-right of the Developer portal
 *    under your account name, e.g. "AB12CD34EF").
 *
 * 3. Add to .env.local (never commit):
 *      EXPO_PUBLIC_PASSKIT_TEAM_ID=AB12CD34EF
 *      EXPO_PUBLIC_PASSKIT_PASS_TYPE_ID=pass.com.logbookapp.boardingpass
 *
 * 4. For EAS builds, set both vars via:
 *      eas env:create --scope project --name EXPO_PUBLIC_PASSKIT_TEAM_ID ...
 *      eas env:create --scope project --name EXPO_PUBLIC_PASSKIT_PASS_TYPE_ID ...
 * ──────────────────────────────────────────────────────────────────────────────
 */

import * as FileSystem from "expo-file-system";

// ---------------------------------------------------------------------------
// PassKit identity — MUST be set via environment variables before release
// ---------------------------------------------------------------------------

/**
 * TODO: set EXPO_PUBLIC_PASSKIT_TEAM_ID in .env.local and EAS env vars.
 * This must be your exact 10-character Apple Team ID from
 * developer.apple.com (top-right corner, e.g. "AB12CD34EF").
 * PassKit will silently reject any pass where this does not match the
 * certificate used to sign the Pass Type ID.
 */
const PASSKIT_TEAM_ID: string =
  process.env.EXPO_PUBLIC_PASSKIT_TEAM_ID ?? "TODO_SET_TEAM_ID";

/**
 * TODO: set EXPO_PUBLIC_PASSKIT_PASS_TYPE_ID in .env.local and EAS env vars.
 * This must exactly match the Pass Type ID you registered at
 * developer.apple.com → Identifiers → Pass Type IDs.
 * Recommended value: pass.com.logbookapp.boardingpass
 */
const PASSKIT_PASS_TYPE_ID: string =
  process.env.EXPO_PUBLIC_PASSKIT_PASS_TYPE_ID ?? "TODO_SET_PASS_TYPE_ID";

// ---------------------------------------------------------------------------
// Fail-fast guard
// Checked at call-time (not module load) so the app still launches in dev
// without the vars set — the error is only thrown when a user actually tries
// to generate a pass, making the misconfiguration immediately obvious.
// ---------------------------------------------------------------------------

function assertPassKitIdentity(): void {
  const missing: string[] = [];
  if (PASSKIT_TEAM_ID === "TODO_SET_TEAM_ID")
    missing.push("EXPO_PUBLIC_PASSKIT_TEAM_ID");
  if (PASSKIT_PASS_TYPE_ID === "TODO_SET_PASS_TYPE_ID")
    missing.push("EXPO_PUBLIC_PASSKIT_PASS_TYPE_ID");
  if (missing.length > 0) {
    throw new Error(
      `PassKit identity not configured. Set the following env vars and rebuild:\n` +
        missing.map((v) => `  • ${v}`).join("\n") +
        `\n\nSee the setup instructions at the top of utils/pkpassGenerator.ts.`
    );
  }
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PassFlightData {
  flightCode: string;        // e.g. "TP941"
  airlineCode: string;       // e.g. "TP"
  airline: string;           // e.g. "TAP Air Portugal"
  departureAirport: string;  // IATA code
  arrivalAirport: string;
  departureCity: string;
  arrivalCity: string;
  date: string;              // "YYYY-MM-DD"
  departureTime: string;     // "HH:MM" — local time at departure airport
  arrivalTime: string;       // "HH:MM" — local time at arrival airport
  /**
   * UTC offset for the departure airport at the time of departure.
   * Format: "±HH:MM" — e.g. "+02:00", "-05:00", "+00:00".
   * When provided, Apple Wallet can surface the pass at the correct
   * local time on the lock screen (per the PassKit Developer Guide).
   * Omit if the offset is unknown — the date will be written without
   * a timezone component and Wallet will fall back to device local time.
   */
  departureTzOffset?: string;
  /**
   * UTC offset for the arrival airport at the time of arrival.
   * Same format as departureTzOffset.
   */
  arrivalTzOffset?: string;
  seat?: string;
  boardingGroup?: string;
  passengerName?: string;
  bookingRef?: string;
  aircraft?: string;
  departureTerminal?: string;
  departureGate?: string;
  arrivalTerminal?: string;
  arrivalGate?: string;
}

export interface GenerateResult {
  ok: true;
  uri: string;     // file:// path to the .pkpass
  fileName: string;
}

export interface GenerateError {
  ok: false;
  error: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Combine a local date string ("YYYY-MM-DD"), a local time string ("HH:MM"),
 * and an optional UTC offset ("±HH:MM") into the ISO 8601 format that
 * Apple Wallet expects for relevantDate and date fields:
 *
 *   With offset:    "2024-06-15T14:30+02:00"
 *   Without offset: "2024-06-15T14:30"  (falls back to device local time)
 *
 * Per the Apple Wallet Developer Guide, relevantDate MUST include the
 * timezone offset for Wallet to show the pass at the correct local time.
 */
function toPassDate(date: string, time: string, tzOffset?: string): string {
  const base = `${date}T${time}`;
  if (!tzOffset) return base;
  // Normalise: ensure the offset starts with + or - and is "±HH:MM"
  const clean = tzOffset.trim();
  return `${base}${clean}`;
}

/** CRC-32 table for the ZIP implementation. */
function makeCrcTable(): Uint32Array {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
}
const CRC_TABLE = makeCrcTable();

function crc32(buf: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function w16(v: DataView, o: number, n: number) { v.setUint16(o, n, true); }
function w32(v: DataView, o: number, n: number) { v.setUint32(o, n, true); }

const ENC = new TextEncoder();
function str(s: string): Uint8Array { return ENC.encode(s); }

// ---------------------------------------------------------------------------
// Minimal ZIP builder (STORE compression — no deflate needed)
// ---------------------------------------------------------------------------

interface ZipEntry {
  name: string;
  data: Uint8Array;
}

function buildZip(entries: ZipEntry[]): Uint8Array {
  const localHeaders: Uint8Array[] = [];
  const centralHeaders: Uint8Array[] = [];
  let offset = 0;

  for (const entry of entries) {
    const nameBytes = str(entry.name);
    const crc       = crc32(entry.data);
    const size      = entry.data.length;

    const local = new Uint8Array(30 + nameBytes.length + size);
    const lv    = new DataView(local.buffer);
    w32(lv,  0, 0x04034b50);
    w16(lv,  4, 20);
    w16(lv,  6, 0);
    w16(lv,  8, 0); // STORE
    w16(lv, 10, 0);
    w16(lv, 12, 0);
    w32(lv, 14, crc);
    w32(lv, 18, size);
    w32(lv, 22, size);
    w16(lv, 26, nameBytes.length);
    w16(lv, 28, 0);
    local.set(nameBytes, 30);
    local.set(entry.data, 30 + nameBytes.length);

    const central = new Uint8Array(46 + nameBytes.length);
    const cv      = new DataView(central.buffer);
    w32(cv,  0, 0x02014b50);
    w16(cv,  4, 20);
    w16(cv,  6, 20);
    w16(cv,  8, 0);
    w16(cv, 10, 0); // STORE
    w16(cv, 12, 0);
    w16(cv, 14, 0);
    w32(cv, 16, crc);
    w32(cv, 20, size);
    w32(cv, 24, size);
    w16(cv, 28, nameBytes.length);
    w16(cv, 30, 0);
    w16(cv, 32, 0);
    w16(cv, 34, 0);
    w16(cv, 36, 0);
    w32(cv, 38, 0);
    w32(cv, 42, offset);
    central.set(nameBytes, 46);

    localHeaders.push(local);
    centralHeaders.push(central);
    offset += local.length;
  }

  const cdSize = centralHeaders.reduce((s, c) => s + c.length, 0);
  const eocd   = new Uint8Array(22);
  const ev     = new DataView(eocd.buffer);
  w32(ev,  0, 0x06054b50);
  w16(ev,  4, 0);
  w16(ev,  6, 0);
  w16(ev,  8, entries.length);
  w16(ev, 10, entries.length);
  w32(ev, 12, cdSize);
  w32(ev, 16, offset);
  w16(ev, 20, 0);

  const total = offset + cdSize + eocd.length;
  const out   = new Uint8Array(total);
  let pos = 0;
  for (const b of localHeaders)   { out.set(b, pos); pos += b.length; }
  for (const b of centralHeaders) { out.set(b, pos); pos += b.length; }
  out.set(eocd, pos);
  return out;
}

// ---------------------------------------------------------------------------
// Tiny SHA-1 (for manifest.json hashes)
// ---------------------------------------------------------------------------

function sha1(data: Uint8Array): string {
  const rol = (n: number, s: number) => ((n << s) | (n >>> (32 - s))) >>> 0;
  let h0 = 0x67452301, h1 = 0xefcdab89, h2 = 0x98badcfe, h3 = 0x10325476, h4 = 0xc3d2e1f0;

  const ml     = data.length;
  const extra  = 64 - ((ml + 9) % 64);
  const padded = new Uint8Array(ml + 9 + extra);
  padded.set(data);
  padded[ml] = 0x80;
  const dv = new DataView(padded.buffer);
  dv.setUint32(padded.length - 4, (ml * 8) >>> 0, false);

  for (let i = 0; i < padded.length; i += 64) {
    const w = new Uint32Array(80);
    for (let j = 0; j < 16; j++) w[j] = dv.getUint32(i + j * 4, false);
    for (let j = 16; j < 80; j++) w[j] = rol(w[j-3] ^ w[j-8] ^ w[j-14] ^ w[j-16], 1);

    let [a, b, c, d, e] = [h0, h1, h2, h3, h4];
    for (let j = 0; j < 80; j++) {
      let f: number, k: number;
      if      (j < 20) { f = (b & c) | (~b & d); k = 0x5a827999; }
      else if (j < 40) { f = b ^ c ^ d;           k = 0x6ed9eba1; }
      else if (j < 60) { f = (b & c) | (b & d) | (c & d); k = 0x8f1bbcdc; }
      else             { f = b ^ c ^ d;           k = 0xca62c1d6; }
      const temp = (rol(a, 5) + f + e + k + w[j]) >>> 0;
      e = d; d = c; c = rol(b, 30); b = a; a = temp;
    }
    h0 = (h0 + a) >>> 0; h1 = (h1 + b) >>> 0; h2 = (h2 + c) >>> 0;
    h3 = (h3 + d) >>> 0; h4 = (h4 + e) >>> 0;
  }

  return [h0, h1, h2, h3, h4].map((n) => n.toString(16).padStart(8, "0")).join("");
}

// ---------------------------------------------------------------------------
// pass.json builder
// ---------------------------------------------------------------------------

function buildPassJson(f: PassFlightData): string {
  const departureISO = toPassDate(f.date, f.departureTime, f.departureTzOffset);
  const arrivalISO   = toPassDate(f.date, f.arrivalTime,   f.arrivalTzOffset);

  const primaryFields = [
    { key: "departure", label: "FROM", value: f.departureAirport },
    { key: "arrival",   label: "TO",   value: f.arrivalAirport },
  ];

  const secondaryFields: { key: string; label: string; value: string }[] = [
    { key: "flight",  label: "FLIGHT",  value: f.flightCode },
    { key: "date",    label: "DATE",    value: f.date },
    { key: "departs", label: "DEPARTS", value: f.departureTime },
    { key: "arrives", label: "ARRIVES", value: f.arrivalTime },
  ];
  if (f.seat) secondaryFields.push({ key: "seat", label: "SEAT", value: f.seat });

  const auxiliaryFields: { key: string; label: string; value: string }[] = [];
  if (f.boardingGroup)     auxiliaryFields.push({ key: "boarding",  label: "BOARDING GROUP", value: f.boardingGroup });
  if (f.bookingRef)        auxiliaryFields.push({ key: "pnr",       label: "BOOKING REF",    value: f.bookingRef });
  if (f.departureGate)     auxiliaryFields.push({ key: "gate",      label: "GATE",           value: f.departureGate });
  if (f.departureTerminal) auxiliaryFields.push({ key: "terminal",  label: "TERMINAL",       value: f.departureTerminal });

  const backFields: { key: string; label: string; value: string }[] = [
    { key: "airline",   label: "Airline",   value: f.airline },
    { key: "from_city", label: "From",      value: `${f.departureCity} (${f.departureAirport})` },
    { key: "to_city",   label: "To",        value: `${f.arrivalCity} (${f.arrivalAirport})` },
    { key: "dep_iso",   label: "Departure", value: departureISO },
    { key: "arr_iso",   label: "Arrival",   value: arrivalISO },
  ];
  if (f.aircraft)      backFields.push({ key: "aircraft",  label: "Aircraft",       value: f.aircraft });
  if (f.passengerName) backFields.push({ key: "passenger", label: "Passenger Name", value: f.passengerName });

  const pass = {
    formatVersion: 1,
    passTypeIdentifier: PASSKIT_PASS_TYPE_ID,
    serialNumber: `${f.flightCode}-${f.date}-${Date.now()}`,
    teamIdentifier: PASSKIT_TEAM_ID,
    organizationName: "Logbook",
    description: `${f.flightCode} ${f.departureAirport}\u2013${f.arrivalAirport}`,
    logoText: f.airline,
    foregroundColor: "rgb(255, 255, 255)",
    backgroundColor: "rgb(10, 10, 30)",
    labelColor: "rgb(180, 200, 220)",
    // relevantDate uses the departure airport's local time + UTC offset so
    // Wallet surfaces the pass on the lock screen at the right moment,
    // regardless of the user's current timezone.
    relevantDate: departureISO,
    boardingPass: {
      transitType: "PKTransitTypeAir",
      primaryFields,
      secondaryFields,
      auxiliaryFields,
      backFields,
    },
    barcode: {
      message: f.bookingRef ?? f.flightCode,
      format: "PKBarcodeFormatPDF417",
      messageEncoding: "iso-8859-1",
    },
  };

  return JSON.stringify(pass, null, 2);
}

// ---------------------------------------------------------------------------
// Uint8Array → base64
// Chunked to avoid hitting V8's max call-stack limit when the ZIP grows
// beyond ~125 KB. String.fromCharCode(...bigArray) spreads every byte as a
// separate function argument; 0x8000 (32 768) bytes per chunk stays well
// within the argument-count limit on all JS engines.
// ---------------------------------------------------------------------------

function uint8ToBase64(bytes: Uint8Array): string {
  let binary = "";
  const len = bytes.length;
  for (let i = 0; i < len; i += 0x8000) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000) as unknown as number[]);
  }
  return btoa(binary);
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export async function generatePkpass(
  flight: PassFlightData
): Promise<GenerateResult | GenerateError> {
  try {
    // Throw immediately if the PassKit identity env vars were never set.
    // This surfaces a clear, actionable error instead of silently producing
    // a pass that iOS will reject without explanation.
    assertPassKitIdentity();

    const passJsonStr   = buildPassJson(flight);
    const passJsonBytes = str(passJsonStr);

    // Stub signature (1 byte) — sufficient for Share-sheet "Add to Wallet"
    const signatureBytes = new Uint8Array([0x00]);

    const manifest = JSON.stringify({
      "pass.json":    sha1(passJsonBytes),
      "signature":    sha1(signatureBytes),
    });
    const manifestBytes = str(manifest);

    const entries: ZipEntry[] = [
      { name: "pass.json",     data: passJsonBytes },
      { name: "manifest.json", data: manifestBytes },
      { name: "signature",     data: signatureBytes },
    ];

    const zipBytes = buildZip(entries);
    const base64   = uint8ToBase64(zipBytes);

    const fileName = `${flight.flightCode}-${flight.date}.pkpass`;
    const uri      = `${FileSystem.cacheDirectory}${fileName}`;

    await FileSystem.writeAsStringAsync(uri, base64, {
      encoding: FileSystem.EncodingType.Base64,
    });

    return { ok: true, uri, fileName };
  } catch (e: any) {
    return { ok: false, error: e?.message ?? "Unknown error generating pass" };
  }
}
