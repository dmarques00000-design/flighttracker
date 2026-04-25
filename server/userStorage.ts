import { eq } from "drizzle-orm";
import { db } from "./db";
import { users, type InsertUser, type User } from "../shared/schema";

/**
 * Upsert a user record on social sign-in.
 * If the user already exists (by id), update name / avatar / email.
 * Returns the up-to-date user row.
 */
export async function upsertUser(data: InsertUser): Promise<User> {
  const existing = await db.query.users.findFirst({
    where: eq(users.id, data.id),
  });

  if (existing) {
    const [updated] = await db
      .update(users)
      .set({
        email:     data.email ?? existing.email,
        name:      data.name  ?? existing.name,
        avatarUrl: data.avatarUrl ?? existing.avatarUrl,
        updatedAt: new Date(),
      })
      .where(eq(users.id, data.id))
      .returning();
    return updated;
  }

  const [created] = await db.insert(users).values(data).returning();
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
  const deleted = await db
    .delete(users)
    .where(eq(users.id, id))
    .returning({ id: users.id });
  return deleted.length > 0;
}
