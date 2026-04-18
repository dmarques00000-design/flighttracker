import "dotenv/config";
import { Pool } from "pg";

async function main() {
  const url = process.env.DATABASE_URL_DIRECT ?? process.env.DATABASE_URL;
  if (!url) throw new Error("No DATABASE_URL set");

  const pool = new Pool({ connectionString: url, ssl: { rejectUnauthorized: false } });

  // First, show what columns the users table actually has
  const cols = await pool.query(`
    SELECT column_name, data_type
    FROM information_schema.columns
    WHERE table_name = 'users'
    ORDER BY ordinal_position
  `);
  console.log("users columns:", cols.rows);

  await pool.end();
}

main().catch((err) => { console.error(err); process.exit(1); });
