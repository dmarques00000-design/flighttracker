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
  deleteAccount: (userId: string) => Promise<void>;
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
    // Network unavailable at launch — not fatal.
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
        // Re-upsert on every launch to guarantee the users row exists in Postgres
        // even if the server was unreachable during the very first sign-in.
        if (restoredProfile) silentUpsert(restoredProfile);
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

  /**
   * Permanently delete the account from the server (cascades to flights + trips),
   * then wipe all local state and AsyncStorage.
   * Throws if the server call fails so the UI can show an error to the user.
   */
  async function deleteAccount(userId: string): Promise<void> {
    const res = await fetch(`${API_BASE}/api/users/${encodeURIComponent(userId)}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "(no body)");
      throw new Error(`[UserContext] DELETE /api/users/${userId} failed ${res.status}: ${body}`);
    }
    // Server deletion succeeded — wipe everything locally.
    setProfile(DEFAULT_PROFILE);
    setIsLoggedIn(false);
    await AsyncStorage.multiRemove([STORAGE_KEY, AUTH_KEY, NOTIF_PREFS_KEY]);
  }

  async function login(params: LoginParams) {
    const { id, name, email, provider, avatarUrl } = params;

    // Persist user to DB — must succeed before we mark the user as logged in.
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
