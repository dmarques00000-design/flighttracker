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
