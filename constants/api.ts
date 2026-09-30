import Constants from "expo-constants";

/**
 * API_BASE — base URL for the Express backend.
 *
 * Priority:
 *  1. EXPO_PUBLIC_API_URL env var  →  use as-is (staging / production builds)
 *  2. Expo hostUri (dev builds)    →  use the dev API port (default 5001) so
 *     physical devices reach the dev machine over LAN.
 *  3. Fallback                     →  localhost:5001 (simulators only)
 */
function resolveApiBase(): string {
  // 1. Explicit override always wins (staging / prod)
  const override = process.env.EXPO_PUBLIC_API_URL as string | undefined;
  if (override) return override;

  // 2. In Expo Go / dev builds, hostUri is "<LAN_IP>:<metro_port>".
  //    The Express dev server runs on 5001 in our local workflow.
  //    Override with EXPO_PUBLIC_API_PORT if needed.
  const hostUri = Constants.expoConfig?.hostUri;
  const apiPort = process.env.EXPO_PUBLIC_API_PORT || "5001";
  if (hostUri) {
    const host = hostUri.split(":")[0]; // strip the Metro port
    return `http://${host}:${apiPort}`;
  }

  // 3. Simulator fallback — localhost works fine here
  return `http://localhost:${apiPort}`;
}

export const API_BASE: string = resolveApiBase();
