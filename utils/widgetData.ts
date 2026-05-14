/**
 * widgetData.ts
 * Writes a compact JSON snapshot into the shared App Group UserDefaults
 * so the iOS WidgetKit extension can read it without launching the app.
 *
 * Keys written to "group.com.logbookapp.shared":
 *   logbook_next_flight   — NextFlightData | null (JSON string)
 *   logbook_month_recap   — MonthRecapData        (JSON string)
 *
 * Called from context/flights.tsx every time the flights array changes.
 */
import { NativeModules, Platform } from "react-native";
import type { Flight } from "@/context/flights";

const APP_GROUP = "group.com.logbookapp.shared";

// ---------------------------------------------------------------------------
// Public data shapes (mirrored in Swift)
// ---------------------------------------------------------------------------

export interface NextFlightData {
  flightCode: string;
  departureAirport: string;
  arrivalAirport: string;
  date: string;          // ISO yyyy-MM-dd
  departureTime: string; // "HH:mm"
  departureTerminal: string | null;
  departureGate: string | null;
  airline: string;
}

export interface MonthRecapData {
  monthLabel: string;   // e.g. "May 2026"
  flightCount: number;
  miles: number;
  topRoute: string | null; // e.g. "LIS → GVA" — most frequent this month
  co2Kg: number;
}

// ---------------------------------------------------------------------------
// Write helper — silently no-ops on Android / Expo Go
// ---------------------------------------------------------------------------

/**
 * Attempt to write a string value to App Group UserDefaults.
 * Uses the RCTSharedUserDefaults native module exposed by expo-apple-targets
 * (available only in dev-client / production builds).
 */
function writeToAppGroup(key: string, value: string): void {
  if (Platform.OS !== "ios") return;
  try {
    // expo-apple-targets exposes NativeModules.ExpoAppleTargets with a
    // setSharedUserDefault(key, value, suiteName) method.
    const mod = (NativeModules as any).ExpoAppleTargets;
    if (mod?.setSharedUserDefault) {
      mod.setSharedUserDefault(key, value, APP_GROUP);
      return;
    }
    // Fallback: some builds expose RCTSharedUserDefaults directly.
    const fallback = (NativeModules as any).RCTSharedUserDefaults;
    if (fallback?.set) {
      fallback.set(key, value, APP_GROUP);
    }
  } catch (e) {
    // Silently ignore — widget data is best-effort
    if (__DEV__) console.warn("[widgetData] Could not write to App Group:", e);
  }
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

/**
 * Compute widget payloads from the current flights array and write them
 * to the shared App Group. Safe to call on every render — skips on non-iOS.
 */
export function writeWidgetData(flights: Flight[]): void {
  if (Platform.OS !== "ios") return;

  const today = new Date();
  const todayStr = today.toISOString().substring(0, 10);

  // ── Next upcoming flight ─────────────────────────────────────────────────
  const upcoming = flights
    .filter((f) => f.date >= todayStr)
    .sort((a, b) => {
      const dateCompare = a.date.localeCompare(b.date);
      if (dateCompare !== 0) return dateCompare;
      return (a.departureTime ?? "00:00").localeCompare(b.departureTime ?? "00:00");
    });

  const next = upcoming[0] ?? null;
  const nextData: NextFlightData | null = next
    ? {
        flightCode:        next.flightCode,
        departureAirport:  next.departureAirport,
        arrivalAirport:    next.arrivalAirport,
        date:              next.date,
        departureTime:     next.departureTime ?? "00:00",
        departureTerminal: next.departureTerminal ?? null,
        departureGate:     next.departureGate    ?? null,
        airline:           next.airline,
      }
    : null;

  writeToAppGroup("logbook_next_flight", JSON.stringify(nextData));

  // ── Month recap ──────────────────────────────────────────────────────────
  const yearMonth = todayStr.substring(0, 7); // "2026-05"
  const monthFlights = flights.filter((f) => f.date.startsWith(yearMonth));

  // Top route this month
  const routeCounts: Record<string, number> = {};
  for (const f of monthFlights) {
    const route = `${f.departureAirport} → ${f.arrivalAirport}`;
    routeCounts[route] = (routeCounts[route] ?? 0) + 1;
  }
  const topRoute =
    Object.keys(routeCounts).sort((a, b) => routeCounts[b] - routeCounts[a])[0] ?? null;

  const monthLabel = today.toLocaleDateString("en-US", { month: "long", year: "numeric" });

  const recapData: MonthRecapData = {
    monthLabel,
    flightCount: monthFlights.length,
    miles:       Math.round(monthFlights.reduce((s, f) => s + (f.distanceMiles ?? 0), 0)),
    topRoute,
    co2Kg:       Math.round(monthFlights.reduce((s, f) => s + (f.co2Kg ?? 0), 0)),
  };

  writeToAppGroup("logbook_month_recap", JSON.stringify(recapData));
}
