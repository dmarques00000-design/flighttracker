import { eq } from "drizzle-orm";
import { db } from "./db";
import { users, flights, trips, type InsertUser, type User } from "../shared/schema";

/** Apple private relay addresses must never overwrite a real stored email. */
function isPrivateRelayEmail(email: string | null | undefined): boolean {
  return !!email && email.toLowerCase().endsWith("@privaterelay.appleid.com");
}

/**
 * Upsert a user record on social sign-in.
 *
 * Identity key: `id` (Apple user ID) — never `email`.
 *
 * Email update rules:
 *  - If the incoming email is a private relay address, keep whatever is
 *    already stored (a real email is more useful and must not be lost).
 *  - If the incoming email is a real address, always update it.
 *  - If no email is stored yet and the incoming one is also a relay
 *    address, store null rather than the relay string so the UI never
 *    shows a raw @privaterelay.appleid.com address to the user.
 *
 * Returns the up-to-date user row.
 */
export async function upsertUser(data: InsertUser): Promise<User> {
  const existing = await db.query.users.findFirst({
    where: eq(users.id, data.id),
  });

  const incomingEmailIsRelay = isPrivateRelayEmail(data.email);

  if (existing) {
    const [updated] = await db
      .update(users)
      .set({
        // Only update email if the incoming value is a real address.
        // If it's a private relay address, preserve whatever is stored
        // (could be a real email from a previous sign-in without Hide My Email).
        email:     incomingEmailIsRelay ? existing.email : (data.email ?? existing.email),
        name:      data.name      ?? existing.name,
        avatarUrl: data.avatarUrl ?? existing.avatarUrl,
        updatedAt: new Date(),
      })
      .where(eq(users.id, data.id))
      .returning();
    return updated;
  }

  // New user — store null instead of a relay address so the profile
  // email field is empty until the user provides a real one.
  const [created] = await db
    .insert(users)
    .values({
      ...data,
      email: incomingEmailIsRelay ? null : data.email,
    })
    .returning();
  return created;
}

/** Fetch a single user by id. Returns undefined if not found. */
export async function getUserById(id: string): Promise<User | undefined> {
  return db.query.users.findFirst({ where: eq(users.id, id) });
}

/**
 * Permanently delete a user and all their data.
 * Flights and trips are removed automatically via ON DELETE CASCADE
 * on the FK constraints defined in shared/schema.ts.
 * Returns true if a row was deleted, false if the user was not found.
 */
export async function deleteUser(id: string): Promise<boolean> {
  return db.transaction(async (tx) => {
    // Do not rely solely on the database's FK cascade here. Account deletion
    // is a high-stakes operation, so delete every account-owned table
    // explicitly inside one transaction. If any step fails, none of the
    // account data is partially deleted.
    const deleted = await tx
      .delete(users)
      .where(eq(users.id, id))
      .returning({ id: users.id });

    if (deleted.length === 0) return false;

    await tx.delete(trips).where(eq(trips.userId, id));
    await tx.delete(flights).where(eq(flights.userId, id));

    return true;
  });
}
