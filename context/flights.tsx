import React, { createContext, useContext, useState, useEffect, useMemo, ReactNode, useCallback } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { API_BASE } from "@/constants/api";
import { useUser } from "@/context/user";
import { writeWidgetData } from "@/utils/widgetData";

export interface Flight {
  id: string;
  flightCode: string;
  date: string;
  airline: string;
  airlineCode: string;
  departureAirport: string;
  arrivalAirport: string;
  departureCity: string;
  arrivalCity: string;
  departureTime: string;
  arrivalTime: string;
  durationMinutes: number;
  distanceMiles: number;
  co2Kg: number;
  status: "on_time" | "delayed" | "cancelled";
  delayMinutes: number;
  aircraft: string;
  addedAt: string;
  verified: boolean;
  isMock?: boolean;
  tailNumber?: string;
  departureTerminal?: string;
  arrivalTerminal?: string;
  departureGate?: string;
  arrivalGate?: string;
}

interface FlightStats {
  totalFlights: number;
  totalMiles: number;
  totalCo2Kg: number;
  totalFlightMinutes: number;
  totalDelayMinutes: number;
  rankPercentile: number;
  yearFlights: number;
  yearMiles: number;
  yearCo2: number;
}

interface FlightsContextValue {
  flights: Flight[];
  stats: FlightStats;
  isLoading: boolean;
  addFlight: (flight: Omit<Flight, "id" | "addedAt">) => Promise<void>;
  removeFlight: (id: string) => Promise<void>;
}

const LOCAL_STORAGE_KEY = "@logbook_flights";

/** Error thrown when a user tries to log a flight they already have. */
export class DuplicateFlightError extends Error {
  constructor() {
    super("You have already logged this flight.");
    this.name = "DuplicateFlightError";
  }
}

function computeStats(flights: Flight[]): FlightStats {
  const currentYear = new Date().getFullYear();
  const yearFlights = flights.filter((f) => f.date.startsWith(String(currentYear)));
  const totalFlights = flights.length;
  const totalMiles = flights.reduce((s, f) => s + f.distanceMiles, 0);
  const totalCo2Kg = flights.reduce((s, f) => s + f.co2Kg, 0);
  const totalFlightMinutes = flights.reduce((s, f) => s + f.durationMinutes, 0);
  const totalDelayMinutes = flights.reduce((s, f) => s + f.delayMinutes, 0);
  const yearMiles = yearFlights.reduce((s, f) => s + f.distanceMiles, 0);
  const yearCo2 = yearFlights.reduce((s, f) => s + f.co2Kg, 0);
  const rankPercentile = computeRank(yearFlights.length);
  return { totalFlights, totalMiles, totalCo2Kg, totalFlightMinutes, totalDelayMinutes, rankPercentile, yearFlights: yearFlights.length, yearMiles, yearCo2 };
}

function computeRank(flightsThisYear: number): number {
  if (flightsThisYear === 0) return 0;
  if (flightsThisYear <= 1) return 15;
  if (flightsThisYear <= 3) return 35;
  if (flightsThisYear <= 6) return 55;
  if (flightsThisYear <= 10) return 70;
  if (flightsThisYear <= 15) return 82;
  if (flightsThisYear <= 25) return 91;
  if (flightsThisYear <= 40) return 96;
  return 99;
}

const FlightsContext = createContext<FlightsContextValue | null>(null);

export function FlightsProvider({ children }: { children: ReactNode }) {
  const { profile, isLoggedIn } = useUser();
  const [flights, setFlights] = useState<Flight[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // ── Write widget data whenever flights change ────────────────────────────
  useEffect(() => {
    if (!isLoading) writeWidgetData(flights);
  }, [flights, isLoading]);

  // ── Load flights: API when logged in, AsyncStorage as fallback/guest ────────────
  useEffect(() => {
    let cancelled = false;
    async function load() {
      setIsLoading(true);
      if (isLoggedIn && profile.id) {
        try {
          const res = await fetch(`${API_BASE}/api/users/${encodeURIComponent(profile.id)}/flights`);
          if (res.ok) {
            const data: Flight[] = await res.json();
            if (!cancelled) setFlights(data);
            setIsLoading(false);
            return;
          }
        } catch (err) {
          console.warn("[FlightsContext] API fetch failed, falling back to local storage:", err);
        }
      }
      // Guest / offline fallback
      const raw = await AsyncStorage.getItem(LOCAL_STORAGE_KEY);
      if (!cancelled && raw) {
        try {
          const parsed = JSON.parse(raw) as Flight[];
          setFlights(parsed.map((f) => ({ ...f, verified: f.verified ?? false, isMock: f.isMock ?? false })));
        } catch { setFlights([]); }
      }
      if (!cancelled) setIsLoading(false);
    }
    load();
    return () => { cancelled = true; };
  }, [isLoggedIn, profile.id]);

  // ── Persist locally for both guest mode and as offline fallback for logged-in users ──
  const persistLocal = useCallback(async (updated: Flight[]) => {
    await AsyncStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updated));
  }, []);

  // ── Add flight ───────────────────────────────────────────────────────────────────────
  const addFlight = useCallback(async (data: Omit<Flight, "id" | "addedAt">) => {
    const isDuplicate = flights.some(
      (f) => f.flightCode === data.flightCode && f.date === data.date,
    );
    if (isDuplicate) throw new DuplicateFlightError();

    if (isLoggedIn && profile.id) {
      let res: Response;
      try {
        res = await fetch(`${API_BASE}/api/flights`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...data, userId: profile.id }),
        });
      } catch (err) {
        console.warn("[FlightsContext] Network error saving flight:", err);
        throw err;
      }
      if (res.status === 409) throw new DuplicateFlightError();
      if (!res.ok) {
        const err = new Error(`${res.status}`);
        console.warn("[FlightsContext] API returned", res.status, "saving flight");
        throw err;
      }
      const saved: Flight = await res.json();
      const next = [saved, ...flights];
      setFlights(next);
      await persistLocal(next);
      return;
    }

    const flight: Flight = {
      ...data,
      id: Date.now().toString() + Math.random().toString(36).substring(2, 9),
      addedAt: new Date().toISOString(),
    };
    const next = [flight, ...flights];
    setFlights(next);
    await persistLocal(next);
  }, [flights, isLoggedIn, profile.id, persistLocal]);

  // ── Remove flight ────────────────────────────────────────────────────────────────────
  const removeFlight = useCallback(async (id: string) => {
    const snapshot = flights;
    const next = flights.filter((f) => f.id !== id);
    setFlights(next);

    if (isLoggedIn && profile.id) {
      try {
        const res = await fetch(
          `${API_BASE}/api/flights/${encodeURIComponent(id)}?userId=${encodeURIComponent(profile.id)}`,
          { method: "DELETE" },
        );
        if (!res.ok) throw new Error(`DELETE /api/flights/${id} responded with ${res.status}`);
        await persistLocal(next);
      } catch (err) {
        console.warn("[FlightsContext] Failed to delete flight from API, reverting:", err);
        setFlights(snapshot);
        throw err;
      }
    } else {
      await persistLocal(next);
    }
  }, [flights, isLoggedIn, profile.id, persistLocal]);

  const stats = useMemo(() => computeStats(flights), [flights]);

  const value = useMemo(() => ({
    flights, stats, isLoading, addFlight, removeFlight,
  }), [flights, stats, isLoading, addFlight, removeFlight]);

  return (
    <FlightsContext.Provider value={value}>
      {children}
    </FlightsContext.Provider>
  );
}

export function useFlights() {
  const ctx = useContext(FlightsContext);
  if (!ctx) throw new Error("useFlights must be within FlightsProvider");
  return ctx;
}
