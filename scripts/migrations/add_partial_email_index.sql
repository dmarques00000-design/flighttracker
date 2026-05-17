-- Migration: replace blanket UNIQUE on users.email with a partial unique index
-- that excludes Apple private relay addresses.
--
-- Run once against your Neon / Postgres database before deploying the server
-- changes that remove the .unique() constraint from the Drizzle schema.
--
-- Step 1: drop the old blanket unique constraint (created by Drizzle's .unique())
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_email_unique;

-- Step 2: add a partial unique index covering only real (non-relay) addresses
CREATE UNIQUE INDEX IF NOT EXISTS users_real_email_unique
  ON users (email)
  WHERE email IS NOT NULL
    AND email NOT LIKE '%@privaterelay.appleid.com';
