/**
 * calendarParser.ts
 * Scan the user's iOS Calendar (EventKit) for events that mention a
 * flight code in their title or notes and return structured candidates.
 *
 * Detection strategy
 * ──────────────────
 * IATA flight code regex: two uppercase letters (airline designator) followed
 * by 1-4 digits, optionally separated by a single space.
 *   Examples that match: LX19  TP027  LX 19  U2 8425  BA 123
 *   Examples that DON'T match: F-35  ISO8601  V2.0  HR123 (no leading alpha pair)
 *
 * We use a stricter anchored context check: the token must be preceded and
 * followed by a word boundary (\b) so "FLEX123" does not match as "LX123".
 *
 * Time window
 * ───────────
 * Past 365 days → today (inclusive).  Future events are excluded because
 * the user can only log a flight they've actually taken — the same rule as
 * the rest of the app.  (The API enrichment endpoint only has historic data.)
 *
 * Returns
 * ───────
 * CalendarFlight[] — one entry per unique flightCode+date pair, sorted
 * newest-first.  The caller is responsible for deduplication against the
 * existing logbook.
 */

import * as Calendar from "expo-calendar";

export interface CalendarFlight {
  /** Canonical IATA flight code, upper-cased, no space: "LX19" */
  flightCode: string;
  /** Airline IATA designator, e.g. "LX" */
  airlineCode: string;
  /** Date string YYYY-MM-DD derived from the event start */
  date: string;
  /** Human-readable title of the source calendar event */
  eventTitle: string;
  /** Calendar event start time as ISO string (for display) */
  eventStart: string;
  /** Internal dedup key */
  id: string;
}

/** Known non-airline two-letter prefixes to skip (country codes, etc.) */
const SKIP_PREFIXES = new Set([
  "AM", "PM", "UK", "US", "EU", "UN", "TV", "OK", "HI", "GO",
  "NO", "SO", "DO", "TO", "BY", "IN", "IT", "IS", "IF",
]);

/**
 * Extract all IATA flight codes from a text string.
 * The regex is instantiated fresh on every call so concurrent invocations
 * cannot corrupt each other's lastIndex state.
 */
function extractFlightCodes(text: string): { code: string; airlineCode: string }[] {
  // A new RegExp instance per call guarantees lastIndex starts at 0
  // and is never shared between concurrent scanCalendarForFlights() calls.
  const re = /\b([A-Z]{2})\s?(\d{1,4})\b/g;
  const upper = text.toUpperCase();
  const out: { code: string; airlineCode: string }[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(upper)) !== null) {
    const prefix = m[1];
    if (SKIP_PREFIXES.has(prefix)) continue;
    const code = prefix + m[2]; // normalise: no space
    out.push({ code, airlineCode: prefix });
  }
  return out;
}

function toDateString(d: Date): string {
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, "0");
  const da = String(d.getDate()).padStart(2, "0");
  return `${y}-${mo}-${da}`;
}

/**
 * Request calendar permission and scan the past 365 days.
 * Uses requestFullCalendarAccessAsync() (iOS 17+) so the correct
 * NSCalendarsFullAccessUsageDescription string is shown and the
 * legacy permission deprecation warning is avoided.
 * Throws if permission is denied.
 */
export async function scanCalendarForFlights(): Promise<CalendarFlight[]> {
  const { status } = await Calendar.requestFullCalendarAccessAsync();
  if (status !== "granted") {
    throw new Error("PERMISSION_DENIED");
  }

  const now   = new Date();
  const start = new Date(now);
  start.setDate(start.getDate() - 365);
  // End = end of today (not future)
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);

  const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
  const calendarIds = calendars.map((c) => c.id);

  const events = await Calendar.getEventsAsync(calendarIds, start, end);

  const seen = new Set<string>();
  const results: CalendarFlight[] = [];

  for (const event of events) {
    // Search both title and notes
    const haystack = `${event.title ?? ""} ${event.notes ?? ""}`;
    const codes = extractFlightCodes(haystack);
    if (codes.length === 0) continue;

    const eventDate = toDateString(new Date(event.startDate));

    for (const { code, airlineCode } of codes) {
      const key = `${code}-${eventDate}`;
      if (seen.has(key)) continue;
      seen.add(key);
      results.push({
        flightCode:  code,
        airlineCode,
        date:        eventDate,
        eventTitle:  event.title ?? "Untitled event",
        eventStart:  event.startDate instanceof Date
          ? event.startDate.toISOString()
          : String(event.startDate),
        id: key,
      });
    }
  }

  // Sort newest first
  results.sort((a, b) => b.date.localeCompare(a.date));
  return results;
}
