-- Migration: enforce one real flight per user + flight code + date.
--
-- The application already performs a duplicate pre-check, but that check is
-- race-prone. This partial unique index makes the database authoritative while
-- preserving the existing semantics for mock flights and flights without a
-- flight code.
--
-- Do not delete or merge existing duplicates automatically. If the preflight
-- check below finds duplicates, resolve them first and then run this migration.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM flights
    WHERE flight_code IS NOT NULL
      AND is_mock = false
    GROUP BY user_id, flight_code, date
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION
      'Cannot create flights_user_flight_code_date_unique: duplicate real flights already exist. Resolve duplicates first.';
  END IF;
END
$$;

CREATE UNIQUE INDEX IF NOT EXISTS flights_user_flight_code_date_unique
  ON flights (user_id, flight_code, date)
  WHERE flight_code IS NOT NULL
    AND is_mock = false;
