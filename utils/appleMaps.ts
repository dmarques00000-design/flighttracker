import { Linking, Platform } from "react-native";

/**
 * Open an airport in Apple Maps (iOS) or Google Maps (Android).
 *
 * Strategy:
 *  1. Try the native apple-maps:// scheme (opens Maps.app directly).
 *  2. If that scheme is not supported (rare, e.g. simulator edge cases)
 *     fall back to the universal https://maps.apple.com/?q= URL which
 *     iOS will still hand off to Maps.app via universal-links.
 *  3. On Android use geo: URI so Google Maps (or any maps app) handles it.
 */
export async function openAirportInMaps(
  iataCode: string,
  cityName: string,
  airportName?: string,
): Promise<void> {
  const label = airportName ?? `${iataCode} Airport`;
  const query  = encodeURIComponent(`${label}, ${cityName}`);

  if (Platform.OS === "android") {
    const geoUri = `geo:0,0?q=${query}`;
    await Linking.openURL(geoUri);
    return;
  }

  // iOS — prefer native scheme for instant Maps.app launch
  const nativeUrl  = `maps://?q=${query}`;
  const fallbackUrl = `https://maps.apple.com/?q=${query}`;

  const canOpen = await Linking.canOpenURL(nativeUrl).catch(() => false);
  await Linking.openURL(canOpen ? nativeUrl : fallbackUrl);
}

/**
 * Build a human-readable airport label for the Maps search query.
 * Falls back gracefully when only the IATA code is available.
 */
export function airportMapLabel(iataCode: string, city: string): string {
  return `${iataCode} Airport, ${city}`;
}
