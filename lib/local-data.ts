import AsyncStorage from "@react-native-async-storage/async-storage";

export const LEGACY_FLIGHTS_KEY = "@logbook_flights";
export const LEGACY_TRIPS_KEY = "@logbook_trips";

export function flightsStorageKey(userId?: string): string {
  return userId ? LEGACY_FLIGHTS_KEY + ":" + userId : LEGACY_FLIGHTS_KEY;
}

export function tripsStorageKey(userId?: string): string {
  return userId ? LEGACY_TRIPS_KEY + ":" + userId : LEGACY_TRIPS_KEY;
}

export async function readLegacyGuestData(): Promise<{
  flights: unknown[];
  trips: unknown[];
}> {
  const pairs = await AsyncStorage.multiGet([LEGACY_FLIGHTS_KEY, LEGACY_TRIPS_KEY]);

  let flights: unknown[] = [];
  let trips: unknown[] = [];

  try {
    if (pairs[0][1]) {
      const parsed = JSON.parse(pairs[0][1]);
      if (Array.isArray(parsed)) flights = parsed;
    }
  } catch {}

  try {
    if (pairs[1][1]) {
      const parsed = JSON.parse(pairs[1][1]);
      if (Array.isArray(parsed)) trips = parsed;
    }
  } catch {}

  return { flights, trips };
}

export async function clearLegacyGuestData(): Promise<void> {
  await AsyncStorage.multiRemove([LEGACY_FLIGHTS_KEY, LEGACY_TRIPS_KEY]);
}
