/**
 * lib/validation.ts
 * ──────────────────────────────────────────────────────────────────────────
 * Single source of truth for all client-side input validation.
 *
 * Every schema:
 *  - Normalises the value first (trim, uppercase, etc.)
 *  - Then validates the normalised value
 *  - Produces a human-readable error message suitable for direct
 *    display in the UI (no technical jargon, no field names)
 *
 * Usage:
 *   import { validateField, flightCodeSchema } from "@/lib/validation";
 *   const { value, error } = validateField(flightCodeSchema, rawInput);
 *   if (error) showError(error);
 */

import { z } from "zod";

// ─── Re-usable transform helpers ──────────────────────────────────────────────────

const trimUpper = (s: string) => s.trim().toUpperCase();
const trimStr   = (s: string) => s.trim();

// ─── Flight code  (e.g. LX2819, BA456, EJU1234) ──────────────────────────────

export const flightCodeSchema = z
  .string()
  .transform((s) => s.trim().toUpperCase().replace(/[^A-Z0-9]/g, ""))
  .pipe(
    z
      .string()
      .min(3,  { message: "Flight code must be at least 3 characters (e.g. LX2819)" })
      .max(8,  { message: "Flight code must be 8 characters or fewer (e.g. LX2819)" })
      .regex(
        /^[A-Z]{2,3}\d{1,4}$/,
        { message: "Invalid format — use IATA airline code + flight number (e.g. LX2819, BA456)" },
      ),
  );

// ─── Date  (YYYY-MM-DD, year 2000–today+1yr) ──────────────────────────────────

export const dateSchema = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, { message: "Date must be in YYYY-MM-DD format" })
  .refine(
    (s) => !isNaN(new Date(s + "T00:00:00").getTime()),
    { message: "Invalid date" },
  )
  .refine(
    (s) => new Date(s + "T00:00:00") >= new Date("2000-01-01T00:00:00"),
    { message: "Date is too far in the past (must be after 1 Jan 2000)" },
  )
  .refine(
    (s) => {
      const max = new Date();
      max.setFullYear(max.getFullYear() + 1);
      return new Date(s + "T00:00:00") <= max;
    },
    { message: "Date cannot be more than 1 year in the future" },
  );

// ─── IATA airport code  (exactly 3 uppercase letters, e.g. ZRH, LHR) ─────────

export const iataSchema = z
  .string()
  .transform(trimUpper)
  .pipe(
    z
      .string()
      .length(3, { message: "Airport code must be exactly 3 letters (e.g. ZRH, LHR)" })
      .regex(/^[A-Z]{3}$/, { message: "Airport code must be 3 letters only (e.g. ZRH, LHR)" }),
  );

/** Same as iataSchema but allows an empty string (optional airport field). */
export const optionalIataSchema = z
  .string()
  .transform(trimUpper)
  .pipe(
    z
      .string()
      .refine(
        (s) => s === "" || /^[A-Z]{3}$/.test(s),
        { message: "Airport code must be 3 letters (e.g. ZRH) or leave empty" },
      ),
  );

// ─── Trip title ────────────────────────────────────────────────────────────────────

export const tripTitleSchema = z
  .string()
  .transform(trimStr)
  .pipe(
    z
      .string()
      .min(1,  { message: "Trip name cannot be empty" })
      .max(80, { message: "Trip name must be 80 characters or fewer" }),
  );

// ─── Flight notes (optional free-text) ─────────────────────────────────────────

export const notesSchema = z
  .string()
  .transform(trimStr)
  .pipe(
    z
      .string()
      .max(500, { message: "Notes must be 500 characters or fewer" }),
  )
  .optional();

// ─── Seat number (optional, e.g. 14A, 32C) ─────────────────────────────────────

export const seatSchema = z
  .string()
  .transform(trimUpper)
  .pipe(
    z
      .string()
      .max(10, { message: "Seat number must be 10 characters or fewer" })
      .regex(
        /^[0-9]{1,3}[A-Z]?$|^$/,
        { message: "Seat must be a row number + optional letter (e.g. 14A, 32C)" },
      ),
  )
  .optional();

// ─── Seat class ───────────────────────────────────────────────────────────────────────

export const SEAT_CLASSES = ["economy", "premium_economy", "business", "first"] as const;
export type SeatClass = typeof SEAT_CLASSES[number];

export const seatClassSchema = z
  .enum(SEAT_CLASSES, {
    errorMap: () => ({ message: "Seat class must be economy, premium economy, business, or first" }),
  })
  .optional();

// ─── User display name ─────────────────────────────────────────────────────────────

export const displayNameSchema = z
  .string()
  .transform(trimStr)
  .pipe(
    z
      .string()
      .min(1,   { message: "Name cannot be empty" })
      .max(100, { message: "Name must be 100 characters or fewer" }),
  );

// ─── validateField() helper ───────────────────────────────────────────────────────
/**
 * Run a Zod schema against a raw value.
 * Returns the parsed (normalised) value on success, or the first
 * human-readable error message on failure.
 *
 * @example
 * const { value, error } = validateField(flightCodeSchema, " lx2819 ");
 * // value => "LX2819", error => null
 *
 * const { value, error } = validateField(flightCodeSchema, "TOOLONGCODE");
 * // value => "TOOLONGCODE", error => "Flight code must be 8 characters or fewer"
 */
export function validateField<T>(
  schema: z.ZodType<T>,
  raw: string,
): { value: string; error: string | null } {
  const result = schema.safeParse(raw);
  if (result.success) {
    // Return the transformed value as a string for display/use in state
    return { value: String(result.data), error: null };
  }
  const firstError = result.error.errors[0]?.message ?? "Invalid value";
  return { value: raw, error: firstError };
}
