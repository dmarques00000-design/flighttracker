import { eq, desc, and } from "drizzle-orm";
import { db } from "./db";
import { flights, type InsertFlight, type Flight } from "../shared/schema";

/** Return all real (non-mock) flights for a user, newest first. */
export async function getFlightsByUser(userId: string): Promise<Flight[]> {
  return db
    .select()
    .from(flights)
    .where(
      and(
        eq(flights.userId, userId),
        eq(flights.isMock, false),
      ),
    )
    .orderBy(desc(flights.date), desc(flights.departureTime));
}

/**
 * Insert a new flight row.
 * Throws a DuplicateFlightError if the user already has a flight with the
 * same flightCode + date combination.
 */
export class DuplicateFlightError extends Error {
  constructor() {
    super("You have already logged this flight.");
    this.name = "DuplicateFlightError";
  }
}

export async function createFlight(data: InsertFlight): Promise<Flight> {
  // Duplicate guard: same user + flightCode + date (only among real flights)
  if (data.flightCode && data.date) {
    const [existing] = await db
      .select({ id: flights.id })
      .from(flights)
      .where(
        and(
          eq(flights.userId, data.userId),
          eq(flights.flightCode, data.flightCode),
          eq(flights.date, data.date),
          eq(flights.isMock, false),
        ),
      )
      .limit(1);
    if (existing) throw new DuplicateFlightError();
  }

  try {
    const [created] = await db.insert(flights).values(data).returning();
    return created;
  } catch (err) {
    // The pre-insert check above is only a fast path. The database unique index
    // is the authoritative guard for concurrent inserts.
    const dbError = err as { code?: string; constraint?: string };
    if (dbError.code === "23505" && dbError.constraint === "flights_user_flight_code_date_unique") {
      throw new DuplicateFlightError();
    }
    throw err;
  }
}

/** Delete a flight by id. Only deletes if it belongs to the given userId (safety check). */
export async function deleteFlight(id: string, userId: string): Promise<boolean> {
  const result = await db
    .delete(flights)
    .where(and(eq(flights.id, id), eq(flights.userId, userId)))
    .returning({ id: flights.id });

  return result.length > 0;
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
    .where(and(eq(flights.id, id), eq(flights.userId, userId)))
    .returning();

  return updated;
}
