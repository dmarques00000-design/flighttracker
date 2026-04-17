import "dotenv/config";
import { Pool } from "pg";
import { bootstrapDatabase } from "./bootstrap";

if (!process.env.DATABASE_URL) {
  console.error("ERROR: DATABASE_URL is not set. Check your .env file.");
  process.exit(1);
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

bootstrapDatabase(pool)
  .then(() => {
    console.log("Done.");
    return pool.end();
  })
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Bootstrap failed:", err);
    process.exit(1);
  });
