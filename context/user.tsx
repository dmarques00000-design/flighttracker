import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";
import {
  NotificationPrefs,
  DEFAULT_NOTIFICATION_PREFS,
} from "@/utils/notifications";
import { API_BASE } from "@/constants/api";

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  provider: "google" | "apple" | "email" | "";
  avatarUrl: string;
  homeCityCode: string;
  nationality: string;
  frequentFlyerNumber: string;
  preferredAirline: string;
  seatPreference: "window" | "middle" | "aisle" | "";
  avatarInitials: string;
}

const DEFAULT_PROFILE: UserProfile = {
  id: "",
  name: "",
  email: "",
  provider: "",
  avatarUrl: "",
  homeCityCode: "",
  nationality: "",
  frequentFlyerNumber: "",
  preferredAirline: "",
  seatPreference: "",
  avatarInitials: "",
};

const STORAGE_KEY       = "@flighttracker_user_profile";
const AUTH_KEY          = "@flighttracker_is_logged_in";
const NOTIF_PREFS_KEY   = "@flighttracker_notif_prefs";

interface UserContextType {
  profile: UserProfile;
  isLoggedIn: boolean;
  /**
   * True once the initial AsyncStorage read has completed and `isLoggedIn`
   * reflects the persisted session. Always false on the very first render.
   *
   * Consumers that need to act on auth state at cold start (e.g. deep-link
   * routing in _layout.tsx) MUST wait for `isHydrated === true` before
   * inspecting `isLoggedIn` or navigating, otherwise they may observe a
   * stale `false` and incorrectly redirect to the auth screen.
   */
  isHydrated: boolean;
  notifPrefs: NotificationPrefs;
  updateProfile: (updates: Partial<UserProfile>) => Promise<void>;
  updateNotifPrefs: (updates: Partial<NotificationPrefs>) => Promise<void>;
  deleteAccount: (userId: string) => Promise<void>;
  login: (params: LoginParams) => Promise<void>;
  logout: () => Promise<void>;
  dismissedPrompt: boolean;
  dismissPrompt: () => void;
}

export interface LoginParams {
  id: string;
  name: string;
  email: string;
  provider: "google" | "apple" | "email";
  avatarUrl?: string;
}

const UserContext = createContext<UserContextType | null>(null);

function isPrivateRelayEmail(email: string): boolean {
  return email.toLowerCase().endsWith("@privaterelay.appleid.com");
}

async function silentUpsert(profile: UserProfile): Promise<void> {
  if (!profile.id) return;
  try {
    await fetch(`${API_BASE}/api/auth/upsert`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id:        profile.id,
        email:     profile.email || null,
        name:      profile.name,
        avatarUrl: profile.avatarUrl,
        provider:  profile.provider,
      }),
    });
  } catch {
    // Network unavailable at launch — not fatal.
  }
}

async function checkAppleCredentialState(userId: string): Promise<boolean> {
  if (Platform.OS !== "ios") return true;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const AppleAuth = require("expo-apple-authentication");
    const state = await AppleAuth.getCredentialStateForUserAsync(userId);
    return state === AppleAuth.AppleAuthenticationCredentialState.AUTHORIZED;
  } catch {
    return true;
  }
}

async function revokeAppleToken(): Promise<void> {
  if (Platform.OS !== "ios") return;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const AppleAuth = require("expo-apple-authentication");
    await AppleAuth.revokeAsync();
  } catch {}
}

export function UserProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile]               = useState<UserProfile>(DEFAULT_PROFILE);
  const [isLoggedIn, setIsLoggedIn]         = useState(false);
  const [isHydrated, setIsHydrated]         = useState(false);
  const [dismissedPrompt, setDismissedPrompt] = useState(false);
  const [notifPrefs, setNotifPrefs]         = useState<NotificationPrefs>(DEFAULT_NOTIFICATION_PREFS);

  useEffect(() => {
    AsyncStorage.multiGet([STORAGE_KEY, AUTH_KEY, NOTIF_PREFS_KEY]).then(async (pairs) => {
      const profileRaw    = pairs[0][1];
      const authRaw       = pairs[1][1];
      const notifPrefsRaw = pairs[2][1];

      let restoredProfile: UserProfile | null = null;

      if (profileRaw) {
        try {
          const parsed = JSON.parse(profileRaw);
          const { passportNumber, passportExpiry, ...safe } = parsed;
          restoredProfile = { ...DEFAULT_PROFILE, ...safe };
          setProfile(restoredProfile);
        } catch {}
      }

      if (authRaw === "true" && restoredProfile) {
        if (restoredProfile.provider === "apple" && restoredProfile.id) {
          const stillAuthorized = await checkAppleCredentialState(restoredProfile.id);
          if (!stillAuthorized) {
            setIsLoggedIn(false);
            // Mark hydrated even on revocation so the deep-link gate unblocks.
            setIsHydrated(true);
            await AsyncStorage.removeItem(AUTH_KEY);
            return;
          }
        }

        setIsLoggedIn(true);
        silentUpsert(restoredProfile);
      }

      if (notifPrefsRaw) {
        try {
          setNotifPrefs({ ...DEFAULT_NOTIFICATION_PREFS, ...JSON.parse(notifPrefsRaw) });
        } catch {}
      }

      // Hydration complete — auth state is now reliable.
      setIsHydrated(true);
    });
  }, []);

  async function updateProfile(updates: Partial<UserProfile>) {
    const updated = { ...profile, ...updates };
    setProfile(updated);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  }

  async function updateNotifPrefs(updates: Partial<NotificationPrefs>) {
    const updated = { ...notifPrefs, ...updates };
    setNotifPrefs(updated);
    await AsyncStorage.setItem(NOTIF_PREFS_KEY, JSON.stringify(updated));
  }

  async function deleteAccount(userId: string): Promise<void> {
    if (profile.provider === "apple") {
      await revokeAppleToken();
    }

    const res = await fetch(`${API_BASE}/api/users/${encodeURIComponent(userId)}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "(no body)");
      throw new Error(`[UserContext] DELETE /api/users/${userId} failed ${res.status}: ${body}`);
    }

    setProfile(DEFAULT_PROFILE);
    setIsLoggedIn(false);
    await AsyncStorage.multiRemove([STORAGE_KEY, AUTH_KEY, NOTIF_PREFS_KEY]);
  }

  async function login(params: LoginParams) {
    const { id, name, email, provider, avatarUrl } = params;

    const resolvedName = (provider === "apple" && !name.trim())
      ? profile.name
      : name.trim();

    const resolvedEmail = (provider === "apple" && isPrivateRelayEmail(email))
      ? ""
      : email.trim();

    const res = await fetch(`${API_BASE}/api/auth/upsert`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id,
        email:     resolvedEmail || null,
        name:      resolvedName,
        avatarUrl,
        provider,
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "(no body)");
      throw new Error(`[UserContext] /api/auth/upsert failed ${res.status}: ${body}`);
    }

    // Derive initials only when we have a real name to work from.
    // Apple only provides the user's name on the FIRST authorization — every
    // subsequent login sends an empty string. If resolvedName is blank and
    // a cached value already exists, keep the cached value so the avatar
    // never regresses to "?" after re-login.
    const derivedInitials = resolvedName
      ? resolvedName.split(" ").filter(Boolean).map((p) => p[0].toUpperCase()).slice(0, 2).join("")
      : resolvedEmail[0]?.toUpperCase() ?? "";

    const avatarInitials = derivedInitials || profile.avatarInitials || "?";

    const updated: UserProfile = {
      ...profile,
      id,
      name: resolvedName,
      email: resolvedEmail,
      provider,
      avatarUrl: avatarUrl ?? "",
      avatarInitials,
    };

    setProfile(updated);
    setIsLoggedIn(true);
    await AsyncStorage.multiSet([
      [STORAGE_KEY, JSON.stringify(updated)],
      [AUTH_KEY, "true"],
    ]);
  }

  async function logout() {
    setIsLoggedIn(false);
    await AsyncStorage.removeItem(AUTH_KEY);
  }

  function dismissPrompt() {
    setDismissedPrompt(true);
  }

  return (
    <UserContext.Provider value={{
      profile, isLoggedIn, isHydrated, notifPrefs,
      updateProfile, updateNotifPrefs,
      deleteAccount, login, logout,
      dismissedPrompt, dismissPrompt,
    }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  const ctx = useContext(UserContext);
  if (!ctx) throw new Error("useUser must be used inside UserProvider");
  return ctx;
}
