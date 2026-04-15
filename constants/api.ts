/**
 * API_BASE — base URL for the Express backend.
 * In development the server runs on localhost:5000.
 * Override with EXPO_PUBLIC_API_URL in .env for staging/production.
 */
export const API_BASE: string =
  (process.env.EXPO_PUBLIC_API_URL as string | undefined) ??
  "http://localhost:5000";
