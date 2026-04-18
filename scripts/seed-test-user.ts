/**
 * seed-test-user.ts
 * Inserts the test user row so the FK constraint on flights is satisfied.
 * Run once: npx tsx scripts/seed-test-user.ts
 */
import "dotenv/config";
import { Pool } from "pg";

const url = process.env.DATABASE_URL_DIRECT ?? process.env.DATABASE_URL;
if (!url) throw new Error("No DATABASE_URL set");

const pool = new Pool({ connectionString: url, ssl: { rejectUnauthorized: false } });

await pool.query(`
  INSERT INTO users (id, email, name, provider)
  VALUES ('test-user-001', 'diogo.test@logbook.app', 'Diogo Marques', 'email')
  ON CONFLICT (id) DO NOTHING
`);

console.log("✅ Test user seeded (or already existed).");
await pool.end();
