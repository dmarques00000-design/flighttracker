import React, { createContext, useContext, useState, useEffect, useMemo, ReactNode, useCallback } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

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
  /** true when the flight was imported from an Apple Wallet boarding pass */
  verified: boolean;
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

const STORAGE_KEY = "@logbook_flights";

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

  return {
    totalFlights,
    totalMiles,
    totalCo2Kg,
    totalFlightMinutes,
    totalDelayMinutes,
    rankPercentile,
    yearFlights: yearFlights.length,
    yearMiles,
    yearCo2,
  };
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
  const [flights, setFlights] = useState<Flight[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((raw) => {
      if (raw) {
        try {
          const parsed = JSON.parse(raw) as Flight[];
          const migrated = parsed.map((f) => ({
            ...f,
            verified: f.verified ?? false,
          }));
          setFlights(migrated);
        } catch {
          setFlights([]);
        }
      }
      setIsLoading(false);
    });
  }, []);

  const persist = useCallback(async (updated: Flight[]) => {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  }, []);

  const addFlight = useCallback(async (data: Omit<Flight, "id" | "addedAt">) => {
    const flight: Flight = {
      ...data,
      id: Date.now().toString() + Math.random().toString(36).substring(2, 9),
      addedAt: new Date().toISOString(),
    };
    setFlights((prev) => {
      const next = [flight, ...prev];
      persist(next);
      return next;
    });
  }, [persist]);

  const removeFlight = useCallback(async (id: string) => {
    setFlights((prev) => {
      const next = prev.filter((f) => f.id !== id);
      persist(next);
      return next;
    });
  }, [persist]);

  const stats = useMemo(() => computeStats(flights), [flights]);

  const value = useMemo(() => ({
    flights,
    stats,
    isLoading,
    addFlight,
    removeFlight,
  }), [flights, stats, isLoading, addFlight, removeFlight]);

  return (
    <FlightsContext.Provider value={value}>
      {children}
    </FlightsContext.Provider>
  );
}

export function useFlights() {
  const ctx = useContext(FlightsContext);
  if (!ctx) throw new Error("useFlights must be used within FlightsProvider");
  return ctx;
}
