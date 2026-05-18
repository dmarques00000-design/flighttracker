import { useState, useEffect, useCallback } from "react";
import { AppState, AppStateStatus } from "react-native";

export interface NetworkState {
  /** false while the check hasn't resolved yet, or genuinely disconnected */
  isConnected: boolean;
  /** Same value — fetch-based check doesn't distinguish reachability separately */
  isInternetReachable: boolean;
}

/**
 * Lightweight connectivity check that requires NO native modules.
 *
 * Strategy: fire a HEAD request to a reliable, small endpoint. If it
 * succeeds we're online; if it fails (network error, timeout) we're offline.
 * Re-checks every 5 s while the app is foregrounded, and immediately on
 * app foreground events.
 *
 * Trade-off vs @react-native-community/netinfo:
 *  - No push listener (max 5 s lag)
 *  - Requires internet for the probe — detects *internet* reachability,
 *    not just local network attachment. This is actually more correct for
 *    the offline-banner use-case.
 */

const PROBE_URL = "https://www.gstatic.com/generate_204";
const PROBE_TIMEOUT_MS = 4_000;
const POLL_INTERVAL_MS = 5_000;

async function checkConnectivity(): Promise<boolean> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
  try {
    const res = await fetch(PROBE_URL, {
      method: "HEAD",
      cache: "no-store",
      signal: controller.signal,
    });
    return res.ok || res.status === 204;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

export function useNetworkState(): NetworkState {
  const [isConnected, setIsConnected] = useState(true);

  const update = useCallback(async () => {
    const online = await checkConnectivity();
    setIsConnected(online);
  }, []);

  useEffect(() => {
    update();

    const interval = setInterval(update, POLL_INTERVAL_MS);

    // Re-check immediately when the app comes back to the foreground.
    const sub = AppState.addEventListener("change", (state: AppStateStatus) => {
      if (state === "active") update();
    });

    return () => {
      clearInterval(interval);
      sub.remove();
    };
  }, [update]);

  return { isConnected, isInternetReachable: isConnected };
}
