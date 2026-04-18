import "dotenv/config";
import { Pool } from "pg";
import { bootstrapDatabase } from "../server/bootstrap";

async function main() {
  const url = process.env.DATABASE_URL_DIRECT ?? process.env.DATABASE_URL;
  if (!url) throw new Error("No DATABASE_URL set");

  const pool = new Pool({ connectionString: url, ssl: { rejectUnauthorized: false } });

  // Show current users
  const users = await pool.query("SELECT id, email FROM users");
  console.log("Current users in DB:", users.rows);

  // Try inserting test user
  await pool.query(`
    INSERT INTO users (id, email, name, provider)
    VALUES ('test-user-001', 'diogo.test@logbook.app', 'Diogo Marques', 'email')
    ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email, name = EXCLUDED.name
  `);
  console.log("✅ Test user upserted.");

  const after = await pool.query("SELECT id, email FROM users");
  console.log("Users after upsert:", after.rows);

  await pool.end();
}

main().catch((err) => { console.error(err); process.exit(1); });
