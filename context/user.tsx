import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";
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

/**
 * App Store Review Guideline 4.8 — Apple Sign In credential state check.
 *
 * On every cold launch we must verify that the stored Apple credential is
 * still valid. If the user has revoked access in
 * Settings → Apple ID → Password & Security → Apps Using Apple ID,
 * the credential state will be REVOKED (or NOT_FOUND). In either case we
 * must clear the local session immediately so the user is never left in an
 * authenticated-but-revoked state.
 *
 * Returns true  → credential is still AUTHORIZED, session may proceed.
 * Returns false → credential was revoked/not found, caller must log out.
 *
 * Deliberately fire-and-forgets network issues: if the device is offline
 * or the module is unavailable we treat the session as still valid to
 * avoid a disruptive logout caused by a transient network blip.
 */
async function checkAppleCredentialState(userId: string): Promise<boolean> {
  if (Platform.OS !== "ios") return true;
  try {
    // Lazy-require so the module is only loaded on iOS builds that include it.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const AppleAuth = require("expo-apple-authentication");
    const state = await AppleAuth.getCredentialStateForUserAsync(userId);
    // CredentialState enum: AUTHORIZED = 1, REVOKED = 2, NOT_FOUND = 3, TRANSFERRED = 4
    return state === AppleAuth.AppleAuthenticationCredentialState.AUTHORIZED;
  } catch {
    // Module not installed, API error, or device offline — allow session.
    return true;
  }
}

export function UserProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile]         = useState<UserProfile>(DEFAULT_PROFILE);
  const [isLoggedIn, setIsLoggedIn]   = useState(false);
  const [dismissedPrompt, setDismissedPrompt] = useState(false);
  const [notifPrefs, setNotifPrefs]   = useState<NotificationPrefs>(DEFAULT_NOTIFICATION_PREFS);

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
        // ── Guideline 4.8: verify Apple credential state on every cold start ──
        if (restoredProfile.provider === "apple" && restoredProfile.id) {
          const stillAuthorized = await checkAppleCredentialState(restoredProfile.id);
          if (!stillAuthorized) {
            // Apple credential was revoked — silently clear the session.
            setIsLoggedIn(false);
            await AsyncStorage.removeItem(AUTH_KEY);
            return;
          }
        }

        setIsLoggedIn(true);
        // Re-upsert on every launch to guarantee the users row exists in Postgres
        // even if the server was unreachable during the very first sign-in.
        silentUpsert(restoredProfile);
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

    // Apple only returns the user's full name on the very first sign-in.
    // On every subsequent login the name field comes back as an empty string.
    // Fall back to the cached name so the profile is never silently wiped.
    const resolvedName = (provider === "apple" && !name.trim())
      ? profile.name
      : name.trim();

    // Persist user to DB — must succeed before we mark the user as logged in.
    const res = await fetch(`${API_BASE}/api/auth/upsert`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, email, name: resolvedName, avatarUrl, provider }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "(no body)");
      throw new Error(`[UserContext] /api/auth/upsert failed ${res.status}: ${body}`);
    }

    const initials = resolvedName
      ? resolvedName.split(" ").filter(Boolean).map((p) => p[0].toUpperCase()).slice(0, 2).join("")
      : email[0]?.toUpperCase() ?? "?";

    const updated: UserProfile = {
      ...profile,
      id,
      name: resolvedName,
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
