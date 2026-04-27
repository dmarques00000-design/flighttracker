/**
 * bcbpParser.ts
 * Pure-JS IATA Bar Coded Boarding Pass (BCBP) decoder.
 * Spec: IATA Resolution 792 — Type M boarding pass barcode.
 *
 * Every airline boarding pass (Aztec / PDF417 / QR) encodes a fixed-format
 * string beginning with 'M' (mandatory chunk) followed by optional conditional
 * and airline-specific data. We extract all fields needed to pre-fill a flight.
 *
 * References:
 *  https://www.iata.org/contentassets/1dccc9ed041b4f3bbf8b28b3a7d8db72/bcbp-implementation-guide-5th-edition-june-2016.pdf
 */

export interface BCBPFlight {
  /** e.g. "LX317" */
  flightCode: string;
  /** IATA airline code e.g. "LX" */
  airlineCode: string;
  /** Origin IATA e.g. "ZRH" */
  departureAirport: string;
  /** Destination IATA e.g. "JFK" */
  arrivalAirport: string;
  /** "YYYY-MM-DD" derived from Julian day + year heuristic */
  date: string;
  /** Passenger name as on pass */
  passengerName: string;
  /** Seat number e.g. "14A" */
  seat: string;
  /** Booking reference / PNR */
  pnr: string;
}

export interface BCBPParseResult {
  ok: boolean;
  flights: BCBPFlight[];
  raw: string;
  error?: string;
}

/** Convert IATA Julian day (3-digit day-of-year) + current-year heuristic to ISO date. */
function julianToDate(julian: string): string {
  const day = parseInt(julian, 10);
  if (isNaN(day) || day < 1 || day > 366) return new Date().toISOString().substring(0, 10);

  const now = new Date();
  const year = now.getFullYear();

  // Try current year first; if the resulting date is more than 200 days in the
  // past, assume it belongs to next year (upcoming flight booked in advance).
  function fromYear(y: number) {
    const d = new Date(y, 0, 1);
    d.setDate(d.getDate() + day - 1);
    return d;
  }

  let date = fromYear(year);
  const diffDays = (now.getTime() - date.getTime()) / 86_400_000;
  if (diffDays > 200) date = fromYear(year + 1);
  // If still in the future by more than a year, fall back to last year
  const diffFuture = (date.getTime() - now.getTime()) / 86_400_000;
  if (diffFuture > 365) date = fromYear(year - 1);

  return date.toISOString().substring(0, 10);
}

/** Trim and clean a raw BCBP string field. */
function clean(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

/**
 * Parse an IATA BCBP barcode string.
 * Supports Type M (mandatory) multi-leg format.
 * Returns all legs found in the barcode.
 */
export function parseBCBP(raw: string): BCBPParseResult {
  const s = raw.trim();

  // Must start with 'M' for Type M boarding pass
  if (!s.startsWith("M")) {
    return { ok: false, flights: [], raw, error: "Not a BCBP boarding pass barcode" };
  }

  try {
    // Byte 1: Format Code = 'M'
    // Byte 2: Number of legs
    const numLegs = parseInt(s.charAt(1), 10);
    if (isNaN(numLegs) || numLegs < 1 || numLegs > 9) {
      return { ok: false, flights: [], raw, error: "Invalid leg count" };
    }

    // Bytes 3–22: Passenger name (20 chars), surname/firstname separated by '/'
    const rawName = s.substring(2, 22);
    const nameParts = rawName.split("/");
    const surname = clean(nameParts[0] ?? "");
    const firstname = clean(nameParts[1] ?? "");
    const passengerName = firstname ? `${firstname} ${surname}` : surname;

    // Byte 23: Electronic ticket indicator (1 char)
    // Bytes 24–30: Operating carrier PNR (7 chars)
    const pnr = clean(s.substring(23, 30));

    const flights: BCBPFlight[] = [];
    // Each leg starts at offset 0 of the "repeated" mandatory section.
    // First leg mandatory section starts at byte 30.
    let offset = 30;

    for (let leg = 0; leg < numLegs; leg++) {
      if (offset + 37 > s.length) break;

      // Bytes +0–2: From city (origin) IATA — 3 chars
      const depAirport = clean(s.substring(offset, offset + 3)).toUpperCase();
      // Bytes +3–5: To city (destination) IATA — 3 chars
      const arrAirport = clean(s.substring(offset + 3, offset + 6)).toUpperCase();
      // Byte +6: Operating carrier designator — 3 chars (2-letter IATA + space or 3-letter ICAO)
      const airlineRaw = clean(s.substring(offset + 6, offset + 9));
      const airlineCode = airlineRaw.replace(/\s/g, "").substring(0, 2).toUpperCase();
      // Bytes +9–12: Flight number — 5 chars (4 digits + suffix char)
      const flightNumRaw = clean(s.substring(offset + 9, offset + 14));
      const flightNumber = flightNumRaw.replace(/^0+/, "").replace(/\s/g, "");
      const flightCode = airlineCode + flightNumber;
      // Bytes +14–16: Date of flight — Julian day 3 chars
      const julianDay = s.substring(offset + 14, offset + 17);
      const date = julianToDate(julianDay);
      // Bytes +17: Compartment code (1 char) — cabin class
      // Bytes +18–21: Seat number — 4 chars
      const seatRaw = clean(s.substring(offset + 18, offset + 22));
      const seat = seatRaw.replace(/^0+/, "");
      // Bytes +22–27: Check-in sequence number (5 chars)
      // Byte +27: Passenger status (1 char)
      // Total mandatory per-leg = 37 bytes

      if (depAirport.length >= 3 && arrAirport.length >= 3) {
        flights.push({
          flightCode,
          airlineCode,
          departureAirport: depAirport,
          arrivalAirport: arrAirport,
          date,
          passengerName,
          seat,
          pnr,
        });
      }

      // Move past mandatory section (37 bytes) + any conditional data
      // Conditional section begins at offset+37: first byte is size of
      // conditional data in hex (2 chars) — skip that many bytes
      offset += 37;
      if (offset < s.length) {
        const condSizeHex = s.substring(offset, offset + 2);
        const condSize = parseInt(condSizeHex, 16);
        if (!isNaN(condSize)) offset += 2 + condSize;
      }
    }

    if (flights.length === 0) {
      return { ok: false, flights: [], raw, error: "No valid legs decoded" };
    }

    return { ok: true, flights, raw };
  } catch (e) {
    return { ok: false, flights: [], raw, error: String(e) };
  }
}
