import { Pool } from "pg";

/**
 * bootstrapDatabase
 * -----------------
 * Creates the `users` and `flights` tables if they don't already exist.
 * Runs once on server startup — safe to call repeatedly (idempotent).
 *
 * This replaces the need to run `drizzle-kit push` manually.
 * Column definitions mirror shared/schema.ts exactly.
 */
export async function bootstrapDatabase(pool: Pool): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id           VARCHAR(128)  PRIMARY KEY,
      email        TEXT          NOT NULL UNIQUE,
      name         TEXT,
      avatar_url   TEXT,
      provider     VARCHAR(16)   NOT NULL DEFAULT 'google',
      created_at   TIMESTAMPTZ   NOT NULL DEFAULT now(),
      updated_at   TIMESTAMPTZ   NOT NULL DEFAULT now()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS flights (
      id                   VARCHAR(36)   PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id              VARCHAR(128)  NOT NULL REFERENCES users(id) ON DELETE CASCADE,

      flight_code          TEXT,
      airline              TEXT,
      airline_code         VARCHAR(8),
      aircraft             TEXT,
      tail_number          TEXT,

      departure_airport    VARCHAR(4)    NOT NULL,
      arrival_airport      VARCHAR(4)    NOT NULL,
      departure_city       TEXT,
      arrival_city         TEXT,

      date                 VARCHAR(10)   NOT NULL,
      departure_time       VARCHAR(5),
      arrival_time         VARCHAR(5),

      departure_terminal   TEXT,
      arrival_terminal     TEXT,
      departure_gate       TEXT,
      arrival_gate         TEXT,

      duration_minutes     INTEGER,
      distance_miles       INTEGER,
      co2_kg               INTEGER,
      status               VARCHAR(16)   DEFAULT 'on_time',
      delay_minutes        INTEGER       DEFAULT 0,

      seat                 TEXT,
      seat_class           VARCHAR(32),
      is_mock              BOOLEAN       DEFAULT FALSE,
      notes                TEXT,

      created_at           TIMESTAMPTZ   NOT NULL DEFAULT now(),
      updated_at           TIMESTAMPTZ   NOT NULL DEFAULT now()
    );
  `);

  console.log("[bootstrap] Database tables verified.");
}
