import { useState, useEffect } from "react";
import * as Network from "expo-network";

export interface NetworkState {
  /** false while Network hasn't resolved yet, or genuinely disconnected */
  isConnected: boolean;
  /** false if connected to a network but no internet (captive portal, etc.) */
  isInternetReachable: boolean;
}

/**
 * Subscribes to expo-network and returns the live connectivity state.
 * Both fields default to `true` so we don't flash a false-positive banner
 * on app start before the first fetch resolves.
 *
 * expo-network does not have a push listener, so we poll every 4 s while
 * mounted. This is sufficient for the offline banner use-case and avoids
 * the native linking requirement of @react-native-community/netinfo.
 */
export function useNetworkState(): NetworkState {
  const [state, setState] = useState<NetworkState>({
    isConnected: true,
    isInternetReachable: true,
  });

  useEffect(() => {
    let cancelled = false;

    async function update() {
      try {
        const net = await Network.getNetworkStateAsync();
        if (cancelled) return;
        setState({
          isConnected:         net.isConnected        ?? true,
          isInternetReachable: net.isInternetReachable ?? true,
        });
      } catch {
        // If the call fails, stay optimistic — don't flash a false offline banner.
      }
    }

    update();
    const interval = setInterval(update, 4_000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  return state;
}
