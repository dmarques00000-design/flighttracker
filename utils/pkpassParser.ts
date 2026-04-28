/**
 * pkpassParser.ts
 *
 * Parses a .pkpass file (which is a ZIP archive) and extracts boarding-pass
 * flight data from its pass.json.
 *
 * A .pkpass ZIP contains (among other files):
 *   pass.json        – the structured pass data
 *   manifest.json    – SHA1 hashes of included files
 *   signature        – CMS detached signature
 *   *.png            – images
 *
 * We only need pass.json.  We read the ZIP using a pure-JS approach:
 * expo-file-system gives us the raw base64 content, then we use a
 * lightweight JS ZIP reader to extract pass.json without native binaries.
 *
 * Dependencies (already managed by Expo SDK):
 *   expo-file-system   – read local file URI → base64
 *   expo-document-picker – caller responsibility; we just receive the URI
 *
 * No native modules needed – works in Expo Go and dev builds alike.
 */

import * as FileSystem from "expo-file-system";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface PkpassFlight {
  flightCode: string;      // e.g. "LX1234"
  airlineCode: string;     // IATA 2-letter, e.g. "LX"
  flightNumber: string;    // numeric part, e.g. "1234"
  departureAirport: string; // IATA 3-letter
  arrivalAirport: string;
  date: string;            // YYYY-MM-DD
  seat: string;
  boardingGroup: string;
  passengerName: string;
  bookingRef: string;
}

export interface PkpassParseResult {
  ok: true;
  flights: PkpassFlight[];
  rawPass: Record<string, unknown>;
}
export interface PkpassParseError {
  ok: false;
  error: string;
}
export type PkpassResult = PkpassParseResult | PkpassParseError;

// ─── ZIP reader (pure JS, no native) ─────────────────────────────────────────
// Minimal ZIP local-file-header parser.  We only need to extract pass.json.
// ZIP local file header layout (little-endian):
//   0  4  signature  0x04034b50
//   4  2  version needed
//   6  2  flags
//   8  2  compression  (0=store, 8=deflate)
//  10  2  mod time
//  12  2  mod date
//  14  4  crc32
//  18  4  compressed size
//  22  4  uncompressed size
//  26  2  file name length
//  28  2  extra field length
//  30  N  file name
//  30+N+M  file data

function readUint16LE(buf: Uint8Array, offset: number): number {
  return buf[offset] | (buf[offset + 1] << 8);
}
function readUint32LE(buf: Uint8Array, offset: number): number {
  return (buf[offset] | (buf[offset + 1] << 8) | (buf[offset + 2] << 16) | (buf[offset + 3] << 24)) >>> 0;
}

/** Decode base64 string → Uint8Array (works in Hermes / React Native) */
function base64ToUint8Array(b64: string): Uint8Array {
  const binary = atob(b64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/** Decode UTF-8 bytes → string */
function utf8Decode(bytes: Uint8Array): string {
  // TextDecoder is available in Hermes (React Native 0.73+)
  if (typeof TextDecoder !== "undefined") {
    return new TextDecoder("utf-8").decode(bytes);
  }
  // Fallback for older runtimes
  let str = "";
  for (let i = 0; i < bytes.length; i++) {
    const byte = bytes[i];
    if (byte < 0x80) { str += String.fromCharCode(byte); }
    else if ((byte & 0xe0) === 0xc0) { str += String.fromCharCode(((byte & 0x1f) << 6) | (bytes[++i] & 0x3f)); }
    else if ((byte & 0xf0) === 0xe0) { str += String.fromCharCode(((byte & 0x0f) << 12) | ((bytes[++i] & 0x3f) << 6) | (bytes[++i] & 0x3f)); }
    else i += 3; // skip 4-byte sequences (unlikely in JSON)
  }
  return str;
}

/** Minimal inflate for deflate-compressed entries using CompressionStream */
async function inflateDeflate(compressed: Uint8Array): Promise<Uint8Array> {
  if (typeof DecompressionStream !== "undefined") {
    // Add zlib wrapper (CMF + FLG bytes) so DecompressionStream("deflate") works
    const wrapped = new Uint8Array(compressed.length + 2);
    wrapped[0] = 0x78; wrapped[1] = 0x9c;
    wrapped.set(compressed, 2);
    const ds = new DecompressionStream("deflate");
    const writer = ds.writable.getWriter();
    const reader = ds.readable.getReader();
    writer.write(wrapped);
    writer.close();
    const chunks: Uint8Array[] = [];
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
    }
    const total = chunks.reduce((s, c) => s + c.length, 0);
    const out = new Uint8Array(total);
    let pos = 0;
    for (const c of chunks) { out.set(c, pos); pos += c.length; }
    return out;
  }
  // If DecompressionStream unavailable, return as-is (parse will likely fail gracefully)
  return compressed;
}

/** Extract a named file from a ZIP buffer. Returns null if not found. */
async function extractFileFromZip(zip: Uint8Array, targetName: string): Promise<string | null> {
  let offset = 0;
  while (offset < zip.length - 4) {
    const sig = readUint32LE(zip, offset);
    if (sig !== 0x04034b50) break; // not a local file header

    const compression  = readUint16LE(zip, offset + 8);
    const compSize     = readUint32LE(zip, offset + 18);
    const nameLen      = readUint16LE(zip, offset + 26);
    const extraLen     = readUint16LE(zip, offset + 28);
    const dataOffset   = offset + 30 + nameLen + extraLen;
    const fileName     = utf8Decode(zip.slice(offset + 30, offset + 30 + nameLen));

    if (fileName === targetName || fileName.endsWith("/" + targetName)) {
      const compressedData = zip.slice(dataOffset, dataOffset + compSize);
      let rawData: Uint8Array;
      if (compression === 0) {
        rawData = compressedData; // stored (uncompressed)
      } else if (compression === 8) {
        rawData = await inflateDeflate(compressedData);
      } else {
        return null; // unsupported compression
      }
      return utf8Decode(rawData);
    }

    offset = dataOffset + compSize;
  }
  return null;
}

// ─── pass.json field extraction helpers ──────────────────────────────────────

function findField(
  sections: Array<{ fields?: Array<{ key: string; value: unknown }> }>,
  ...keys: string[]
): string {
  for (const section of sections) {
    for (const field of section.fields ?? []) {
      if (keys.some((k) => field.key.toLowerCase().includes(k.toLowerCase()))) {
        return String(field.value ?? "").trim();
      }
    }
  }
  return "";
}

function normalizeDate(raw: string): string {
  if (!raw) return "";
  // ISO 8601 with offset: "2025-08-12T06:00+02:00" → "2025-08-12"
  const isoMatch = raw.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
  // "12 Aug 2025" style
  const months: Record<string, string> = {
    jan:"01",feb:"02",mar:"03",apr:"04",may:"05",jun:"06",
    jul:"07",aug:"08",sep:"09",oct:"10",nov:"11",dec:"12",
  };
  const mdy = raw.match(/(\d{1,2})\s+([A-Za-z]{3})\s+(\d{4})/);
  if (mdy) {
    const m = months[mdy[2].toLowerCase()];
    if (m) return `${mdy[3]}-${m}-${mdy[1].padStart(2, "0")}`;
  }
  return "";
}

function extractFlightCode(raw: string): { airline: string; number: string; code: string } {
  const m = raw.trim().match(/^([A-Z0-9]{2})\s*(\d{1,4}[A-Z]?)$/);
  if (m) return { airline: m[1], number: m[2], code: m[1] + m[2] };
  return { airline: "", number: raw, code: raw };
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Parse a .pkpass file at the given local URI and return extracted flight data.
 * The URI comes from expo-document-picker or expo-file-system.
 */
export async function parsePkpassFile(fileUri: string): Promise<PkpassResult> {
  try {
    // Read file as base64
    const b64 = await FileSystem.readAsStringAsync(fileUri, {
      encoding: FileSystem.EncodingType.Base64,
    });

    const zipBytes = base64ToUint8Array(b64);

    // Extract pass.json from the ZIP
    const passJsonStr = await extractFileFromZip(zipBytes, "pass.json");
    if (!passJsonStr) {
      return { ok: false, error: "pass.json not found inside .pkpass file" };
    }

    const pass = JSON.parse(passJsonStr) as Record<string, unknown>;

    // Verify it's a boarding pass
    const passType = pass.passTypeIdentifier as string ?? "";
    const boardingPass = pass.boardingPass as Record<string, unknown> | undefined;
    if (!boardingPass && !passType.toLowerCase().includes("boarding")) {
      return { ok: false, error: "This pass is not a boarding pass" };
    }

    const bp = boardingPass ?? pass;
    const allSections: Array<{ fields?: Array<{ key: string; value: unknown }> }> = [
      bp["headerFields"] as never ?? [],
      bp["primaryFields"] as never ?? [],
      bp["secondaryFields"] as never ?? [],
      bp["auxiliaryFields"] as never ?? [],
      bp["backFields"] as never ?? [],
    ];

    // ── Extract fields ────────────────────────────────────────────────────
    const rawFlight  = findField(allSections, "flight", "flightnum", "flightnumber", "flightno");
    const rawDep     = findField(allSections, "departure", "origin", "from", "depart");
    const rawArr     = findField(allSections, "destination", "arrival", "arrive", "to");
    const rawDate    = findField(allSections, "date", "depart", "boarding") ||
                       String(pass.relevantDate ?? "");
    const rawSeat    = findField(allSections, "seat");
    const rawGroup   = findField(allSections, "group", "boarding");
    const rawPax     = findField(allSections, "name", "passenger", "traveler");
    const rawRef     = findField(allSections, "confirmation", "booking", "pnr", "record", "locator");

    // Also try top-level description / logoText as airline hint
    const logoText   = String(pass.logoText ?? pass.organizationName ?? "").trim();

    const { airline, number, code } = extractFlightCode(rawFlight || logoText);

    // IATA airport codes: take first 3 uppercase letters
    const depCode = rawDep.replace(/[^A-Z]/g, "").substring(0, 3);
    const arrCode = rawArr.replace(/[^A-Z]/g, "").substring(0, 3);

    if (!depCode || !arrCode) {
      return { ok: false, error: "Could not extract airport codes from pass" };
    }

    const dateStr = normalizeDate(rawDate);
    if (!dateStr) {
      return { ok: false, error: "Could not extract flight date from pass" };
    }

    const flight: PkpassFlight = {
      flightCode:       code || `${airline}${number}`,
      airlineCode:      airline || logoText.substring(0, 2).toUpperCase(),
      flightNumber:     number,
      departureAirport: depCode,
      arrivalAirport:   arrCode,
      date:             dateStr,
      seat:             rawSeat,
      boardingGroup:    rawGroup,
      passengerName:    rawPax,
      bookingRef:       rawRef,
    };

    return { ok: true, flights: [flight], rawPass: pass };
  } catch (err: unknown) {
    return { ok: false, error: err instanceof Error ? err.message : "Unknown error parsing .pkpass" };
  }
}
