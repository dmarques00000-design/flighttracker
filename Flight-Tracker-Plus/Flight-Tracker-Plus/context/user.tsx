import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

export interface UserProfile {
  name: string;
  email: string;
  homeCityCode: string;
  nationality: string;
  passportNumber: string;
  passportExpiry: string;
  frequentFlyerNumber: string;
  preferredAirline: string;
  seatPreference: "window" | "middle" | "aisle" | "";
  avatarInitials: string;
}

const DEFAULT_PROFILE: UserProfile = {
  name: "",
  email: "",
  homeCityCode: "",
  nationality: "",
  passportNumber: "",
  passportExpiry: "",
  frequentFlyerNumber: "",
  preferredAirline: "",
  seatPreference: "",
  avatarInitials: "",
};

const STORAGE_KEY = "@flighttracker_user_profile";
const AUTH_KEY = "@flighttracker_is_logged_in";

interface UserContextType {
  profile: UserProfile;
  isLoggedIn: boolean;
  updateProfile: (updates: Partial<UserProfile>) => Promise<void>;
  clearProfile: () => Promise<void>;
  login: (name: string, email: string) => Promise<void>;
  logout: () => Promise<void>;
  dismissedPrompt: boolean;
  dismissPrompt: () => void;
}

const UserContext = createContext<UserContextType | null>(null);

export function UserProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<UserProfile>(DEFAULT_PROFILE);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [dismissedPrompt, setDismissedPrompt] = useState(false);

  useEffect(() => {
    AsyncStorage.multiGet([STORAGE_KEY, AUTH_KEY]).then((pairs) => {
      const profileRaw = pairs[0][1];
      const authRaw = pairs[1][1];
      if (profileRaw) {
        try { setProfile({ ...DEFAULT_PROFILE, ...JSON.parse(profileRaw) }); } catch {}
      }
      if (authRaw === "true") setIsLoggedIn(true);
    });
  }, []);

  async function updateProfile(updates: Partial<UserProfile>) {
    const updated = { ...profile, ...updates };
    setProfile(updated);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  }

  async function clearProfile() {
    setProfile(DEFAULT_PROFILE);
    setIsLoggedIn(false);
    await AsyncStorage.multiRemove([STORAGE_KEY, AUTH_KEY]);
  }

  async function login(name: string, email: string) {
    const initials = name.trim()
      ? name.trim().split(" ").filter(Boolean).map((p) => p[0].toUpperCase()).slice(0, 2).join("")
      : email[0]?.toUpperCase() ?? "?";
    const updated = { ...profile, name: name.trim(), email: email.trim(), avatarInitials: initials };
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
    <UserContext.Provider value={{ profile, isLoggedIn, updateProfile, clearProfile, login, logout, dismissedPrompt, dismissPrompt }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  const ctx = useContext(UserContext);
  if (!ctx) throw new Error("useUser must be used inside UserProvider");
  return ctx;
}
