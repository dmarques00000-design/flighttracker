import React, { createContext, useContext, useState, useEffect, useMemo, useCallback, ReactNode } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { API_BASE } from "@/constants/api";
import { useUser } from "@/context/user";
import { fetchWithTimeout } from "@/lib/fetch";

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
          const res = await fetchWithTimeout(
            `${API_BASE}/api/users/${encodeURIComponent(profile.id)}/trips`,
          );
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

  // Always persist locally so trips survive app restarts when the API is unreachable.
  const persistLocal = useCallback(async (updated: Trip[]) => {
    await AsyncStorage.setItem(LOCAL_KEY, JSON.stringify(updated));
  }, []);

  const addTrip = useCallback(async (title: string, flightIds: string[], coverUri?: string) => {
    if (isLoggedIn && profile.id) {
      // Logged-in path: server is the source of truth. Any failure throws so
      // the call site can surface an error to the user — we must NOT silently
      // create a local-only trip that will vanish on the next cold start.
      const res = await fetchWithTimeout(`${API_BASE}/api/trips`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, flightIds, userId: profile.id, coverUri }),
      });
      if (!res.ok) throw new Error(`POST /api/trips => ${res.status}`);
      const saved: Trip = await res.json();
      setTrips((prev) => {
        const next = [saved, ...prev];
        persistLocal(next);
        return next;
      });
      return;
    }
    // Guest mode: no account, create locally only.
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
        const res = await fetchWithTimeout(
          `${API_BASE}/api/trips/${encodeURIComponent(id)}?userId=${encodeURIComponent(profile.id)}`,
          { method: "DELETE" },
        );
        if (!res.ok) throw new Error(`DELETE /api/trips/${id} => ${res.status}`);
        setTrips((prev) => { persistLocal(prev); return prev; });
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
    // Capture snapshot and current status before applying optimistic update.
    let snapshot: Trip[] = [];
    let currentStatus: TripStatus | undefined;
    setTrips((prev) => {
      snapshot = prev;
      const next = prev.map((t) => {
        if (t.id !== id) return t;
        currentStatus = t.status;
        return { ...t, title, flightIds, coverUri };
      });
      persistLocal(next);
      return next;
    });
    if (isLoggedIn && profile.id) {
      try {
        const res = await fetchWithTimeout(`${API_BASE}/api/trips/${encodeURIComponent(id)}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId: profile.id, title, flightIds, coverUri, status: currentStatus }),
        });
        if (!res.ok) throw new Error(`PATCH /api/trips/${id} => ${res.status}`);
      } catch (err) {
        console.warn("[TripsContext] Update failed, reverting:", err);
        setTrips(snapshot);
        persistLocal(snapshot);
        throw err;
      }
    }
  }, [isLoggedIn, profile.id, persistLocal]);

  const toggleStar = useCallback(async (id: string) => {
    // Capture snapshot before applying optimistic update.
    let snapshot: Trip[] = [];
    let newStarred = false;
    setTrips((prev) => {
      snapshot = prev;
      const next = prev.map((t) => {
        if (t.id !== id) return t;
        newStarred = !t.starred;
        return { ...t, starred: newStarred };
      });
      persistLocal(next);
      return next;
    });
    if (isLoggedIn && profile.id) {
      try {
        const res = await fetchWithTimeout(`${API_BASE}/api/trips/${encodeURIComponent(id)}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId: profile.id, starred: newStarred }),
        });
        if (!res.ok) throw new Error(`PATCH /api/trips/${id} (star) => ${res.status}`);
      } catch (err) {
        console.warn("[TripsContext] Star toggle failed, reverting:", err);
        setTrips(snapshot);
        persistLocal(snapshot);
        throw err;
      }
    }
  }, [isLoggedIn, profile.id, persistLocal]);

  const setTripStatus = useCallback(async (id: string, status: TripStatus) => {
    // Capture snapshot before applying optimistic update.
    let snapshot: Trip[] = [];
    setTrips((prev) => {
      snapshot = prev;
      const next = prev.map((t) => t.id === id ? { ...t, status } : t);
      persistLocal(next);
      return next;
    });
    if (isLoggedIn && profile.id) {
      try {
        const res = await fetchWithTimeout(`${API_BASE}/api/trips/${encodeURIComponent(id)}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId: profile.id, status }),
        });
        if (!res.ok) throw new Error(`PATCH /api/trips/${id} (status) => ${res.status}`);
      } catch (err) {
        console.warn("[TripsContext] Status update failed, reverting:", err);
        setTrips(snapshot);
        persistLocal(snapshot);
        throw err;
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
