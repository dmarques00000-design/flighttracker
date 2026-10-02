import { desc, eq } from "drizzle-orm";
import { db } from "./db";
import { flights, trips } from "../shared/schema";

type GuestFlight = {
  id?: string;
  flightCode?: string | null;
  date?: string;
  airline?: string | null;
  airlineCode?: string | null;
  departureAirport?: string;
  arrivalAirport?: string;
  departureCity?: string | null;
  arrivalCity?: string | null;
  departureTime?: string | null;
  arrivalTime?: string | null;
  durationMinutes?: number;
  distanceMiles?: number;
  co2Kg?: number;
  status?: string;
  delayMinutes?: number;
  aircraft?: string | null;
  addedAt?: string;
  verified?: boolean;
  isMock?: boolean;
  tailNumber?: string | null;
  departureTerminal?: string | null;
  arrivalTerminal?: string | null;
  departureGate?: string | null;
  arrivalGate?: string | null;
};

type GuestTrip = {
  id?: string;
  title?: string;
  flightIds?: string[];
  createdAt?: string;
  coverUri?: string;
  starred?: boolean;
  status?: string;
};

function validDate(value?: string): Date | undefined {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function flightFingerprint(flight: GuestFlight): string {
  return [
    flight.date ?? "",
    flight.departureAirport ?? "",
    flight.arrivalAirport ?? "",
    flight.departureTime ?? "",
    flight.arrivalTime ?? "",
  ].join("|");
}

export async function migrateGuestData(
  userId: string,
  guestFlights: GuestFlight[],
  guestTrips: GuestTrip[],
): Promise<{ flightsMigrated: number; tripsMigrated: number }> {
  return db.transaction(async (tx) => {
    const existingFlights = await tx
      .select()
      .from(flights)
      .where(eq(flights.userId, userId))
      .orderBy(desc(flights.createdAt));

    const flightIdMap = new Map<string, string>();
    const realByCodeDate = new Map<string, string>();
    const realWithoutCode = new Map<string, string>();

    for (const flight of existingFlights) {
      if (flight.isMock) continue;
      if (flight.flightCode) {
        realByCodeDate.set(
          flight.flightCode + "|" + flight.date,
          flight.id,
        );
      } else {
        realWithoutCode.set(flightFingerprint({
          date: flight.date,
          departureAirport: flight.departureAirport,
          arrivalAirport: flight.arrivalAirport,
          departureTime: flight.departureTime ?? undefined,
          arrivalTime: flight.arrivalTime ?? undefined,
        }), flight.id);
      }
    }

    let flightsMigrated = 0;

    for (const guest of guestFlights) {
      // Mock flights are intentionally not migrated. They are not authoritative
      // user data and the logged-in API excludes them from normal flight lists.
      if (guest.isMock) continue;
      if (!guest.date || !guest.departureAirport || !guest.arrivalAirport) {
        continue;
      }

      let existingId: string | undefined;
      if (guest.flightCode) {
        existingId = realByCodeDate.get(guest.flightCode + "|" + guest.date);
      } else {
        existingId = realWithoutCode.get(flightFingerprint(guest));
      }

      if (existingId) {
        if (guest.id) flightIdMap.set(guest.id, existingId);
        continue;
      }

      const [created] = await tx
        .insert(flights)
        .values({
          userId,
          flightCode: guest.flightCode ?? null,
          airline: guest.airline ?? null,
          airlineCode: guest.airlineCode ?? null,
          aircraft: guest.aircraft ?? null,
          tailNumber: guest.tailNumber ?? null,
          departureAirport: guest.departureAirport,
          arrivalAirport: guest.arrivalAirport,
          departureCity: guest.departureCity ?? null,
          arrivalCity: guest.arrivalCity ?? null,
          date: guest.date,
          departureTime: guest.departureTime ?? null,
          arrivalTime: guest.arrivalTime ?? null,
          departureTerminal: guest.departureTerminal ?? null,
          arrivalTerminal: guest.arrivalTerminal ?? null,
          departureGate: guest.departureGate ?? null,
          arrivalGate: guest.arrivalGate ?? null,
          durationMinutes: guest.durationMinutes ?? null,
          distanceMiles: guest.distanceMiles ?? null,
          co2Kg: guest.co2Kg ?? null,
          status: guest.status ?? "on_time",
          delayMinutes: guest.delayMinutes ?? 0,
          isMock: false,
        })
        .returning({ id: flights.id });

      if (guest.id) flightIdMap.set(guest.id, created.id);
      flightsMigrated++;
      if (guest.flightCode) {
        realByCodeDate.set(guest.flightCode + "|" + guest.date, created.id);
      } else {
        realWithoutCode.set(flightFingerprint(guest), created.id);
      }
    }

    const existingTrips = await tx
      .select()
      .from(trips)
      .where(eq(trips.userId, userId));

    const existingTripKeys = new Set(
      existingTrips.map((trip) => {
        const createdAt = trip.createdAt.toISOString();
        return trip.title + "|" + createdAt;
      }),
    );

    let tripsMigrated = 0;

    for (const guest of guestTrips) {
      const title = typeof guest.title === "string" && guest.title.trim()
        ? guest.title.trim().slice(0, 200)
        : "Trip";
      const createdAt = validDate(guest.createdAt) ?? new Date();
      const tripKey = title + "|" + createdAt.toISOString();

      if (existingTripKeys.has(tripKey)) continue;

      const mappedFlightIds = Array.isArray(guest.flightIds)
        ? guest.flightIds
            .map((id) => flightIdMap.get(id))
            .filter((id): id is string => Boolean(id))
        : [];

      await tx.insert(trips).values({
        userId,
        title,
        flightIds: JSON.stringify(mappedFlightIds),
        coverUri: guest.coverUri ?? null,
        starred: guest.starred ?? false,
        status:
          guest.status === "upcoming" || guest.status === "completed"
            ? guest.status
            : "planned",
        createdAt,
      });

      existingTripKeys.add(tripKey);
      tripsMigrated++;
    }

    return { flightsMigrated, tripsMigrated };
  });
}
