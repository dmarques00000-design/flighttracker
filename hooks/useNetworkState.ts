import { useState, useEffect } from "react";
import NetInfo, { NetInfoState } from "@react-native-community/netinfo";

export interface NetworkState {
  /** false while NetInfo hasn't resolved yet, or genuinely disconnected */
  isConnected: boolean;
  /** false if connected to a network but no internet (captive portal, etc.) */
  isInternetReachable: boolean;
}

/**
 * Subscribes to @react-native-community/netinfo and returns the live
 * connectivity state. Both fields default to `true` so we don't flash
 * a false-positive banner on app start before NetInfo resolves.
 *
 * null is treated as true (optimistic) because NetInfo returns null
 * briefly on first mount before it has read the OS state.
 */
export function useNetworkState(): NetworkState {
  const [state, setState] = useState<NetworkState>({
    isConnected: true,
    isInternetReachable: true,
  });

  useEffect(() => {
    function update(s: NetInfoState) {
      setState({
        isConnected:        s.isConnected        ?? true,
        isInternetReachable: s.isInternetReachable ?? true,
      });
    }

    // Fetch current state immediately (avoids waiting for the first change event)
    NetInfo.fetch().then(update);

    const unsubscribe = NetInfo.addEventListener(update);
    return unsubscribe;
  }, []);

  return state;
}
