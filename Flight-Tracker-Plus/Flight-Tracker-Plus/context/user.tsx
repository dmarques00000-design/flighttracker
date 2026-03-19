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

interface UserContextType {
  profile: UserProfile;
  updateProfile: (updates: Partial<UserProfile>) => Promise<void>;
  clearProfile: () => Promise<void>;
}

const UserContext = createContext<UserContextType | null>(null);

export function UserProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<UserProfile>(DEFAULT_PROFILE);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((raw) => {
      if (raw) {
        try {
          setProfile({ ...DEFAULT_PROFILE, ...JSON.parse(raw) });
        } catch {}
      }
    });
  }, []);

  async function updateProfile(updates: Partial<UserProfile>) {
    const updated = { ...profile, ...updates };
    setProfile(updated);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  }

  async function clearProfile() {
    setProfile(DEFAULT_PROFILE);
    await AsyncStorage.removeItem(STORAGE_KEY);
  }

  return (
    <UserContext.Provider value={{ profile, updateProfile, clearProfile }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  const ctx = useContext(UserContext);
  if (!ctx) throw new Error("useUser must be used inside UserProvider");
  return ctx;
}
