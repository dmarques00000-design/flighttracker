import { and, eq, desc, inArray } from "drizzle-orm";
import { db } from "./db";
import { flights, trips, type InsertTrip, type TripRow } from "../shared/schema";

/** Serialise flightIds array to/from the JSON text column. */
function serialise(row: TripRow) {
  return {
    ...row,
    flightIds: typeof row.flightIds === "string"
      ? (JSON.parse(row.flightIds) as string[])
      : row.flightIds,
  };
}

/** Return all trips for a user, newest first. */
export async function getTripsByUser(userId: string) {
  const rows = await db
    .select()
    .from(trips)
    .where(eq(trips.userId, userId))
    .orderBy(desc(trips.createdAt));
  return rows.map(serialise);
}


async function assertFlightOwnership(flightIds: string[], userId: string): Promise<void> {
  if (flightIds.length === 0) return;

  const rows = await db
    .select({ id: flights.id })
    .from(flights)
    .where(and(inArray(flights.id, flightIds), eq(flights.userId, userId)));

  if (rows.length !== new Set(flightIds).size) {
    throw new Error("One or more flights do not belong to this user.");
  }
}

/** Insert a new trip. Returns the created row with flightIds as an array. */
export async function createTrip(data: InsertTrip) {
  await assertFlightOwnership(data.flightIds ?? [], data.userId);

  const [created] = await db
    .insert(trips)
    .values({
      ...data,
      flightIds: JSON.stringify(data.flightIds ?? []),
    })
    .returning();
  return serialise(created);
}

/** Partially update a trip. Returns the updated row or undefined if not found / unauthorised. */
export async function updateTrip(
  id: string,
  userId: string,
  data: Partial<Omit<InsertTrip, "id" | "userId">>,
) {
  if (Array.isArray(data.flightIds)) {
    await assertFlightOwnership(data.flightIds, userId);
  }

  const payload: Record<string, unknown> = { ...data, updatedAt: new Date() };
  if (Array.isArray(data.flightIds)) {
    payload.flightIds = JSON.stringify(data.flightIds);
  }
  const [updated] = await db
    .update(trips)
    .set(payload)
    .where(and(eq(trips.id, id), eq(trips.userId, userId)))
    .returning();
  return updated ? serialise(updated) : undefined;
}

/** Delete a trip by id. Only deletes if it belongs to the given userId. */
export async function deleteTrip(id: string, userId: string): Promise<boolean> {
  const result = await db
    .delete(trips)
    .where(and(eq(trips.id, id), eq(trips.userId, userId)))
    .returning({ id: trips.id });
  return result.length > 0;
}
