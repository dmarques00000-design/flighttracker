import "dotenv/config";
import { Pool } from "pg";

async function main() {
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
}

main().catch((err) => { console.error(err); process.exit(1); });
