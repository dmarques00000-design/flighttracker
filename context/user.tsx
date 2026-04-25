import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  NotificationPrefs,
  DEFAULT_NOTIFICATION_PREFS,
} from "@/utils/notifications";
import { API_BASE } from "@/constants/api";

export interface UserProfile {
  id: string;           // real provider ID (Google sub / Apple user ID)
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
  notifPrefs: NotificationPrefs;
  updateProfile: (updates: Partial<UserProfile>) => Promise<void>;
  updateNotifPrefs: (updates: Partial<NotificationPrefs>) => Promise<void>;
  clearProfile: () => Promise<void>;
  login: (params: LoginParams) => Promise<void>;
  logout: () => Promise<void>;
  dismissedPrompt: boolean;
  dismissPrompt: () => void;
}

export interface LoginParams {
  /** Stable provider user ID (Google sub, Apple user ID). Falls back to email for test/email logins. */
  id: string;
  name: string;
  email: string;
  provider: "google" | "apple" | "email";
  avatarUrl?: string;
}

const UserContext = createContext<UserContextType | null>(null);

/**
 * Silently upsert a user row in the DB.
 * Fire-and-forget — errors are swallowed so a transient network blip at
 * launch never breaks an already-logged-in session.
 *
 * Called both from login() (where errors ARE thrown) and from the
 * AsyncStorage restore path (where we only want a best-effort guarantee
 * that the row exists before the user tries to write any data).
 */
async function silentUpsert(profile: UserProfile): Promise<void> {
  if (!profile.id || !profile.email) return;
  try {
    await fetch(`${API_BASE}/api/auth/upsert`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id:        profile.id,
        email:     profile.email,
        name:      profile.name,
        avatarUrl: profile.avatarUrl,
        provider:  profile.provider,
      }),
    });
  } catch {
    // Network unavailable at launch — not fatal. The upsert will be
    // retried the next time login() is called explicitly.
  }
}

export function UserProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile]         = useState<UserProfile>(DEFAULT_PROFILE);
  const [isLoggedIn, setIsLoggedIn]   = useState(false);
  const [dismissedPrompt, setDismissedPrompt] = useState(false);
  const [notifPrefs, setNotifPrefs]   = useState<NotificationPrefs>(DEFAULT_NOTIFICATION_PREFS);

  useEffect(() => {
    AsyncStorage.multiGet([STORAGE_KEY, AUTH_KEY, NOTIF_PREFS_KEY]).then((pairs) => {
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

      if (authRaw === "true") {
        setIsLoggedIn(true);

        // Re-upsert on every launch for cached sessions.
        // Guarantees the users row exists in Postgres even if the server
        // was unreachable during the very first sign-in — without this,
        // any write (flights, trips) would throw a FK violation.
        if (restoredProfile) {
          silentUpsert(restoredProfile);
        }
      }

      if (notifPrefsRaw) {
        try {
          setNotifPrefs({ ...DEFAULT_NOTIFICATION_PREFS, ...JSON.parse(notifPrefsRaw) });
        } catch {}
      }
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

  async function clearProfile() {
    setProfile(DEFAULT_PROFILE);
    setIsLoggedIn(false);
    await AsyncStorage.multiRemove([STORAGE_KEY, AUTH_KEY]);
  }

  async function login(params: LoginParams) {
    const { id, name, email, provider, avatarUrl } = params;

    // Persist user to DB — must succeed before we mark the user as logged in.
    // If the upsert fails the user row won't exist and every flight save will
    // throw a FK violation, so we throw here to surface the problem early.
    const res = await fetch(`${API_BASE}/api/auth/upsert`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, email, name, avatarUrl, provider }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "(no body)");
      throw new Error(`[UserContext] /api/auth/upsert failed ${res.status}: ${body}`);
    }

    const initials = name.trim()
      ? name.trim().split(" ").filter(Boolean).map((p) => p[0].toUpperCase()).slice(0, 2).join("")
      : email[0]?.toUpperCase() ?? "?";

    const updated: UserProfile = {
      ...profile,
      id,
      name: name.trim(),
      email: email.trim(),
      provider,
      avatarUrl: avatarUrl ?? "",
      avatarInitials: initials,
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
      profile, isLoggedIn, notifPrefs,
      updateProfile, updateNotifPrefs,
      clearProfile, login, logout,
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
