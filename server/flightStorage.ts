import { eq, desc } from "drizzle-orm";
import { db } from "./db";
import { flights, type InsertFlight, type Flight } from "../shared/schema";

/** Return all flights for a user, newest first. */
export async function getFlightsByUser(userId: string): Promise<Flight[]> {
  return db
    .select()
    .from(flights)
    .where(eq(flights.userId, userId))
    .orderBy(desc(flights.date), desc(flights.departureTime));
}

/** Insert a new flight row. Returns the created row. */
export async function createFlight(data: InsertFlight): Promise<Flight> {
  const [created] = await db.insert(flights).values(data).returning();
  return created;
}

/** Delete a flight by id. Only deletes if it belongs to the given userId (safety check). */
export async function deleteFlight(id: string, userId: string): Promise<boolean> {
  const result = await db
    .delete(flights)
    .where(eq(flights.id, id))
    .returning({ id: flights.id, userId: flights.userId });

  const deleted = result.find((r) => r.userId === userId);
  return !!deleted;
}

/** Update an existing flight. Returns the updated row or undefined if not found. */
export async function updateFlight(
  id: string,
  userId: string,
  data: Partial<InsertFlight>,
): Promise<Flight | undefined> {
  const [updated] = await db
    .update(flights)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(flights.id, id))
    .returning();

  if (!updated || updated.userId !== userId) return undefined;
  return updated;
}
