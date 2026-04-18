import "dotenv/config";
import { Pool } from "pg";
import { bootstrapDatabase } from "../server/bootstrap";

async function main() {
  const url = process.env.DATABASE_URL_DIRECT ?? process.env.DATABASE_URL;
  if (!url) throw new Error("No DATABASE_URL set");

  const pool = new Pool({ connectionString: url, ssl: { rejectUnauthorized: false } });

  console.log("Dropping stale tables...");
  // Drop in correct order (flights refs users)
  await pool.query(`DROP TABLE IF EXISTS flights CASCADE`);
  await pool.query(`DROP TABLE IF EXISTS users CASCADE`);
  console.log("Dropped.");

  console.log("Recreating tables via bootstrap...");
  await bootstrapDatabase(pool);

  console.log("Seeding test user...");
  await pool.query(`
    INSERT INTO users (id, email, name, provider)
    VALUES ('test-user-001', 'diogo.test@logbook.app', 'Diogo Marques', 'email')
    ON CONFLICT (id) DO NOTHING
  `);

  console.log("✅ Done! Tables recreated and test user seeded.");
  await pool.end();
}

main().catch((err) => { console.error(err); process.exit(1); });
