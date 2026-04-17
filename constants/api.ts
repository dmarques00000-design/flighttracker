import Constants from "expo-constants";

/**
 * API_BASE — base URL for the Express backend.
 *
 * Priority:
 *  1. EXPO_PUBLIC_API_URL env var  →  use as-is (staging / production builds)
 *  2. Expo hostUri (dev builds)    →  replace Metro port (8081) with server
 *     port (5000) so physical devices reach the dev machine over LAN.
 *  3. Fallback                     →  localhost:5000 (simulators only)
 */
function resolveApiBase(): string {
  // 1. Explicit override always wins (staging / prod)
  const override = process.env.EXPO_PUBLIC_API_URL as string | undefined;
  if (override) return override;

  // 2. In Expo Go / dev builds, hostUri is "<LAN_IP>:<metro_port>"
  //    e.g. "192.168.1.42:8081" — we swap the port to reach the API server.
  const hostUri = Constants.expoConfig?.hostUri;
  if (hostUri) {
    const host = hostUri.split(":")[0]; // strip the Metro port
    return `http://${host}:5000`;
  }

  // 3. Simulator fallback — localhost works fine here
  return "http://localhost:5000";
}

export const API_BASE: string = resolveApiBase();
