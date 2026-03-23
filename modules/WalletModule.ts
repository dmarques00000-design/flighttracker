/**
 * WalletModule.ts
 * Abstraction layer for Apple Wallet (PassKit) integration.
 *
 * On a real device with a custom dev build, this would call a native module
 * registered via expo-modules-core (see WalletModule.native.ts).
 *
 * In Expo Go / web / Android: returns mocked data so the UI is fully functional
 * and can be tested end-to-end before the native build is wired up.
 *
 * To wire up the real native side:
 *  1. Run: npx expo install expo-modules-core
 *  2. Create ios/FlightTracker/WalletModule.swift (see comments below)
 *  3. Run: eas build --profile development --platform ios
 *
 * Native Swift note:
 *  To include expired passes, call PKPassLibrary().passes(of: .boardingPass)
 *  — PassKit returns ALL boarding passes regardless of expiry when you
 *  enumerate by type. Do NOT filter by relevantDate on the native side;
 *  let the JS layer decide what to show.
 */

import { Platform, NativeModules } from "react-native";

export interface WalletBoardingPass {
  /** Unique identifier from the pass */
  passTypeIdentifier: string;
  serialNumber: string;
  flightCode: string;        // e.g. "LX1234"
  airline: string;           // e.g. "Swiss International Air Lines"
  airlineCode: string;       // e.g. "LX"
  departureAirport: string;  // IATA code e.g. "ZRH"
  arrivalAirport: string;    // IATA code e.g. "LHR"
  departureCity: string;
  arrivalCity: string;
  departureTime: string;     // "HH:mm"
  arrivalTime: string;       // "HH:mm"
  date: string;              // "YYYY-MM-DD"
  aircraft: string;
  /** Raw pass fields for debugging */
  rawFields?: Record<string, string>;
}

export type WalletPermissionStatus = "granted" | "denied" | "unavailable" | "mock";

// ─── Native module bridge (only available in custom dev build) ───────────────
const NativeWallet = (NativeModules as any).FlightTrackerWallet;

async function requestNativePermission(): Promise<WalletPermissionStatus> {
  if (!NativeWallet) return Platform.OS === "ios" ? "mock" : "unavailable";
  try {
    const result: string = await NativeWallet.requestPermission();
    return result as WalletPermissionStatus;
  } catch {
    return "denied";
  }
}

async function fetchNativePasses(): Promise<WalletBoardingPass[]> {
  if (!NativeWallet) return [];
  try {
    // Pass { includeExpired: true } so the native side returns ALL boarding
    // passes from PKPassLibrary, not just currently relevant ones.
    const raw: any[] = await NativeWallet.getBoardingPasses({ includeExpired: true });
    return raw.map(parsePKPass);
  } catch {
    return [];
  }
}

/**
 * Parse a raw PKPass dictionary (as returned from native) into our typed structure.
 * PassKit boarding pass fields follow the PKBoardingPass spec:
 * https://developer.apple.com/library/archive/documentation/UserExperience/Reference/PassKit_Bundle/Chapters/LowerLevel.html
 */
function parsePKPass(raw: any): WalletBoardingPass {
  const fields: Record<string, string> = raw.fields ?? {};

  const flightNumber = fields["flightNumber"] ?? fields["flight"] ?? fields["flightCode"] ?? "";
  const carrier = fields["airlineCode"] ?? fields["carrier"] ?? flightNumber.replace(/\d/g, "").substring(0, 3).toUpperCase();
  const origin = (fields["origin"] ?? fields["departureAirport"] ?? fields["boardingGate"] ?? "").substring(0, 3).toUpperCase();
  const destination = (fields["destination"] ?? fields["arrivalAirport"] ?? "").substring(0, 3).toUpperCase();
  const depCity = fields["departureCity"] ?? fields["originName"] ?? origin;
  const arrCity = fields["arrivalCity"] ?? fields["destinationName"] ?? destination;
  const date = fields["date"] ?? fields["boardingDate"] ?? fields["departureDate"] ?? new Date().toISOString().substring(0, 10);
  const depTime = fields["departureTime"] ?? fields["boardingTime"] ?? "00:00";
  const arrTime = fields["arrivalTime"] ?? "00:00";

  return {
    passTypeIdentifier: raw.passTypeIdentifier ?? "",
    serialNumber: raw.serialNumber ?? Math.random().toString(36).substring(2),
    flightCode: flightNumber,
    airline: fields["airlineName"] ?? fields["organizationName"] ?? carrier,
    airlineCode: carrier,
    departureAirport: origin,
    arrivalAirport: destination,
    departureCity: depCity,
    arrivalCity: arrCity,
    departureTime: depTime,
    arrivalTime: arrTime,
    date: date.includes("T") ? date.substring(0, 10) : date,
    aircraft: fields["aircraft"] ?? fields["equipmentType"] ?? "Unknown",
    rawFields: fields,
  };
}

// ─── Mock passes (used in Expo Go & simulator for UI development) ─────────────
// Includes a spread of past (expired), recent, and future passes to simulate
// a real wallet history.
const MOCK_PASSES: WalletBoardingPass[] = [
  // ── Past / expired passes ──────────────────────────────────────────────────
  {
    passTypeIdentifier: "pass.com.swiss.boardingpass",
    serialNumber: "mock-001",
    flightCode: "LX317",
    airline: "Swiss International Air Lines",
    airlineCode: "LX",
    departureAirport: "ZRH",
    arrivalAirport: "JFK",
    departureCity: "Zurich",
    arrivalCity: "New York",
    departureTime: "10:20",
    arrivalTime: "13:40",
    date: "2025-11-14",
    aircraft: "Airbus A340",
  },
  {
    passTypeIdentifier: "pass.com.british.boardingpass",
    serialNumber: "mock-002",
    flightCode: "BA456",
    airline: "British Airways",
    airlineCode: "BA",
    departureAirport: "LHR",
    arrivalAirport: "DXB",
    departureCity: "London",
    arrivalCity: "Dubai",
    departureTime: "14:30",
    arrivalTime: "23:15",
    date: "2025-09-08",
    aircraft: "Boeing 777",
  },
  {
    passTypeIdentifier: "pass.com.easyjet.boardingpass",
    serialNumber: "mock-003",
    flightCode: "U2345",
    airline: "easyJet",
    airlineCode: "U2",
    departureAirport: "GVA",
    arrivalAirport: "LHR",
    departureCity: "Geneva",
    arrivalCity: "London",
    departureTime: "07:15",
    arrivalTime: "08:30",
    date: "2025-07-22",
    aircraft: "Airbus A320",
  },
  {
    passTypeIdentifier: "pass.com.lufthansa.boardingpass",
    serialNumber: "mock-004",
    flightCode: "LH1234",
    airline: "Lufthansa",
    airlineCode: "LH",
    departureAirport: "FRA",
    arrivalAirport: "SIN",
    departureCity: "Frankfurt",
    arrivalCity: "Singapore",
    departureTime: "22:00",
    arrivalTime: "15:30",
    date: "2025-03-05",
    aircraft: "Boeing 747",
  },
  {
    passTypeIdentifier: "pass.com.american.boardingpass",
    serialNumber: "mock-005",
    flightCode: "AA789",
    airline: "American Airlines",
    airlineCode: "AA",
    departureAirport: "JFK",
    arrivalAirport: "LAX",
    departureCity: "New York",
    arrivalCity: "Los Angeles",
    departureTime: "08:00",
    arrivalTime: "11:20",
    date: "2024-12-30",
    aircraft: "Boeing 737",
  },
  {
    passTypeIdentifier: "pass.com.tap.boardingpass",
    serialNumber: "mock-006",
    flightCode: "TP671",
    airline: "TAP Air Portugal",
    airlineCode: "TP",
    departureAirport: "LIS",
    arrivalAirport: "GVA",
    departureCity: "Lisbon",
    arrivalCity: "Geneva",
    departureTime: "11:00",
    arrivalTime: "14:25",
    date: "2024-08-15",
    aircraft: "Airbus A321neo",
  },
  // ── Recent / upcoming passes ───────────────────────────────────────────────
  {
    passTypeIdentifier: "pass.com.swiss.boardingpass",
    serialNumber: "mock-007",
    flightCode: "LX1623",
    airline: "Swiss International Air Lines",
    airlineCode: "LX",
    departureAirport: "ZRH",
    arrivalAirport: "GVA",
    departureCity: "Zurich",
    arrivalCity: "Geneva",
    departureTime: "09:10",
    arrivalTime: "09:55",
    date: "2026-03-22",
    aircraft: "Airbus A220",
  },
  {
    passTypeIdentifier: "pass.com.swiss.boardingpass",
    serialNumber: "mock-008",
    flightCode: "LX18",
    airline: "Swiss International Air Lines",
    airlineCode: "LX",
    departureAirport: "ZRH",
    arrivalAirport: "EWR",
    departureCity: "Zurich",
    arrivalCity: "Newark",
    departureTime: "17:15",
    arrivalTime: "21:30",
    date: "2026-03-23",
    aircraft: "Airbus A330",
  },
  {
    passTypeIdentifier: "pass.com.lufthansa.boardingpass",
    serialNumber: "mock-009",
    flightCode: "LH400",
    airline: "Lufthansa",
    airlineCode: "LH",
    departureAirport: "FRA",
    arrivalAirport: "JFK",
    departureCity: "Frankfurt",
    arrivalCity: "New York",
    departureTime: "10:35",
    arrivalTime: "13:25",
    date: "2026-04-10",
    aircraft: "Boeing 747-8",
  },
];

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Request access to Apple Wallet boarding passes.
 */
export async function requestWalletPermission(): Promise<WalletPermissionStatus> {
  if (Platform.OS !== "ios") return "unavailable";
  const status = await requestNativePermission();
  return status;
}

/**
 * Fetch ALL boarding passes from Apple Wallet, including expired ones.
 * Falls back to mock data in Expo Go / simulator.
 */
export async function fetchBoardingPasses(): Promise<{ passes: WalletBoardingPass[]; isMock: boolean }> {
  if (Platform.OS !== "ios") {
    return { passes: [], isMock: false };
  }
  if (!NativeWallet) {
    // Expo Go / no native module — return mocks (includes expired) so UI can be fully tested
    return { passes: MOCK_PASSES, isMock: true };
  }
  const passes = await fetchNativePasses();
  return { passes, isMock: false };
}
