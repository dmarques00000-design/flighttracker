import "dotenv/config";
import { Pool } from "pg";

async function main() {
  const url = process.env.DATABASE_URL_DIRECT ?? process.env.DATABASE_URL;
  if (!url) throw new Error("No DATABASE_URL set");

  const pool = new Pool({ connectionString: url, ssl: { rejectUnauthorized: false } });

  const users = [
    { id: "test-user-001",                                          email: "diogo.test@logbook.app",   name: "Diogo Marques", provider: "email" },
    { id: "000567.1f8c5326b92a432da31d3dbd6dcb39f0.2127",          email: "diogo@apple.placeholder",  name: "Diogo Marques", provider: "apple" },
  ];

  for (const u of users) {
    await pool.query(
      `INSERT INTO users (id, email, name, provider)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, provider = EXCLUDED.provider`,
      [u.id, u.email, u.name, u.provider]
    );
    console.log(`\u2705 Upserted: ${u.id}`);
  }

  const after = await pool.query("SELECT id, email FROM users");
  console.log("Users in DB:", after.rows);

  await pool.end();
}

main().catch((err) => { console.error(err); process.exit(1); });
