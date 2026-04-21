import React, { createContext, useContext, useState, useEffect, useMemo, useCallback, ReactNode } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { API_BASE } from "@/constants/api";
import { useUser } from "@/context/user";

export type TripStatus = "planned" | "upcoming" | "completed";

export interface Trip {
  id: string;
  title: string;
  flightIds: string[];
  createdAt: string;
  coverUri?: string;
  starred?: boolean;
  status?: TripStatus;
}

interface TripsContextValue {
  trips: Trip[];
  isLoading: boolean;
  addTrip: (title: string, flightIds: string[], coverUri?: string) => Promise<void>;
  removeTrip: (id: string) => Promise<void>;
  updateTrip: (id: string, title: string, flightIds: string[], coverUri?: string) => Promise<void>;
  toggleStar: (id: string) => Promise<void>;
  setTripStatus: (id: string, status: TripStatus) => Promise<void>;
}

const LOCAL_KEY = "@logbook_trips";

const TripsContext = createContext<TripsContextValue | null>(null);

export function TripsProvider({ children }: { children: ReactNode }) {
  const { profile, isLoggedIn } = useUser();
  const [trips, setTrips] = useState<Trip[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setIsLoading(true);
      if (isLoggedIn && profile.id) {
        try {
          const res = await fetch(`${API_BASE}/api/users/${encodeURIComponent(profile.id)}/trips`);
          if (res.ok) {
            const data: Trip[] = await res.json();
            if (!cancelled) setTrips(data);
            if (!cancelled) setIsLoading(false);
            return;
          }
        } catch (err) {
          console.warn("[TripsContext] API fetch failed, falling back to local:", err);
        }
      }
      const raw = await AsyncStorage.getItem(LOCAL_KEY);
      if (!cancelled && raw) {
        try { setTrips(JSON.parse(raw) as Trip[]); } catch { setTrips([]); }
      }
      if (!cancelled) setIsLoading(false);
    }
    load();
    return () => { cancelled = true; };
  }, [isLoggedIn, profile.id]);

  const persistLocal = useCallback(async (updated: Trip[]) => {
    if (!isLoggedIn) await AsyncStorage.setItem(LOCAL_KEY, JSON.stringify(updated));
  }, [isLoggedIn]);

  const addTrip = useCallback(async (title: string, flightIds: string[], coverUri?: string) => {
    if (isLoggedIn && profile.id) {
      try {
        const res = await fetch(`${API_BASE}/api/trips`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title, flightIds, userId: profile.id, coverUri }),
        });
        if (res.ok) {
          const saved: Trip = await res.json();
          setTrips((prev) => [saved, ...prev]);
          return;
        }
      } catch (err) {
        console.warn("[TripsContext] API save failed, saving locally:", err);
      }
    }
    const trip: Trip = {
      id: Date.now().toString() + Math.random().toString(36).substring(2, 9),
      title,
      flightIds,
      createdAt: new Date().toISOString(),
      starred: false,
      status: "planned",
      ...(coverUri ? { coverUri } : {}),
    };
    setTrips((prev) => {
      const next = [trip, ...prev];
      persistLocal(next);
      return next;
    });
  }, [isLoggedIn, profile.id, persistLocal]);

  const removeTrip = useCallback(async (id: string) => {
    let snapshot: Trip[] = [];
    setTrips((prev) => { snapshot = prev; return prev.filter((t) => t.id !== id); });
    if (isLoggedIn && profile.id) {
      try {
        const res = await fetch(`${API_BASE}/api/trips/${encodeURIComponent(id)}`, { method: "DELETE" });
        if (!res.ok) throw new Error(`DELETE /api/trips/${id} => ${res.status}`);
      } catch (err) {
        console.warn("[TripsContext] Delete failed, reverting:", err);
        setTrips(snapshot);
        throw err;
      }
    } else {
      setTrips((prev) => { persistLocal(prev); return prev; });
    }
  }, [isLoggedIn, profile.id, persistLocal]);

  const updateTrip = useCallback(async (id: string, title: string, flightIds: string[], coverUri?: string) => {
    let currentStatus: TripStatus | undefined;
    setTrips((prev) => {
      const next = prev.map((t) => {
        if (t.id !== id) return t;
        currentStatus = t.status;
        return { ...t, title, flightIds, coverUri };
      });
      if (!isLoggedIn) persistLocal(next);
      return next;
    });
    if (isLoggedIn && profile.id) {
      try {
        await fetch(`${API_BASE}/api/trips/${encodeURIComponent(id)}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title, flightIds, coverUri, status: currentStatus }),
        });
      } catch (err) {
        console.warn("[TripsContext] Update failed:", err);
      }
    }
  }, [isLoggedIn, profile.id, persistLocal]);

  const toggleStar = useCallback(async (id: string) => {
    let newStarred = false;
    setTrips((prev) => {
      const next = prev.map((t) => {
        if (t.id !== id) return t;
        newStarred = !t.starred;
        return { ...t, starred: newStarred };
      });
      if (!isLoggedIn) persistLocal(next);
      return next;
    });
    if (isLoggedIn && profile.id) {
      try {
        await fetch(`${API_BASE}/api/trips/${encodeURIComponent(id)}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ starred: newStarred }),
        });
      } catch (err) {
        console.warn("[TripsContext] Star toggle failed:", err);
      }
    }
  }, [isLoggedIn, profile.id, persistLocal]);

  const setTripStatus = useCallback(async (id: string, status: TripStatus) => {
    setTrips((prev) => {
      const next = prev.map((t) => t.id === id ? { ...t, status } : t);
      if (!isLoggedIn) persistLocal(next);
      return next;
    });
    if (isLoggedIn && profile.id) {
      try {
        await fetch(`${API_BASE}/api/trips/${encodeURIComponent(id)}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status }),
        });
      } catch (err) {
        console.warn("[TripsContext] Status update failed:", err);
      }
    }
  }, [isLoggedIn, profile.id, persistLocal]);

  const value = useMemo(
    () => ({ trips, isLoading, addTrip, removeTrip, updateTrip, toggleStar, setTripStatus }),
    [trips, isLoading, addTrip, removeTrip, updateTrip, toggleStar, setTripStatus]
  );

  return <TripsContext.Provider value={value}>{children}</TripsContext.Provider>;
}

export function useTrips() {
  const ctx = useContext(TripsContext);
  if (!ctx) throw new Error("useTrips must be within TripsProvider");
  return ctx;
}
