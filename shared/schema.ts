import { sql } from "drizzle-orm";
import {
  pgTable,
  text,
  varchar,
  integer,
  real,
  timestamp,
  boolean,
} from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";

// ─── Users ────────────────────────────────────────────────────────────────────
// Populated on first Google / Apple sign-in via POST /api/auth/upsert

export const users = pgTable("users", {
  id:         varchar("id", { length: 128 }).primaryKey(), // Google sub / Apple user id
  email:      text("email").notNull().unique(),
  name:       text("name"),
  avatarUrl:  text("avatar_url"),
  provider:   varchar("provider", { length: 16 }).notNull().default("google"), // 'google' | 'apple'
  createdAt:  timestamp("created_at").notNull().default(sql`now()`),
  updatedAt:  timestamp("updated_at").notNull().default(sql`now()`),
});

export const insertUserSchema = createInsertSchema(users).omit({ createdAt: true, updatedAt: true });
export const selectUserSchema = createSelectSchema(users);
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User      = typeof users.$inferSelect;

// ─── Flights ──────────────────────────────────────────────────────────────────
// One row per logged flight per user

export const flights = pgTable("flights", {
  id:                 varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  userId:             varchar("user_id", { length: 128 }).notNull().references(() => users.id, { onDelete: "cascade" }),

  // Core flight identity
  flightCode:         text("flight_code"),          // e.g. LX19
  airline:            text("airline"),               // e.g. Swiss International Air Lines
  airlineCode:        varchar("airline_code", { length: 8 }),
  aircraft:           text("aircraft"),              // e.g. Boeing 787-9 Dreamliner
  tailNumber:         text("tail_number"),

  // Route
  departureAirport:   varchar("departure_airport", { length: 4 }).notNull(),
  arrivalAirport:     varchar("arrival_airport",   { length: 4 }).notNull(),
  departureCity:      text("departure_city"),
  arrivalCity:        text("arrival_city"),

  // Times (stored as HH:MM strings for simplicity; date is separate)
  date:               varchar("date", { length: 10 }).notNull(), // YYYY-MM-DD
  departureTime:      varchar("departure_time", { length: 5 }),  // HH:MM
  arrivalTime:        varchar("arrival_time",   { length: 5 }),  // HH:MM

  // Terminal / gate
  departureTerminal:  text("departure_terminal"),
  arrivalTerminal:    text("arrival_terminal"),
  departureGate:      text("departure_gate"),
  arrivalGate:        text("arrival_gate"),

  // Stats
  durationMinutes:    integer("duration_minutes"),
  distanceMiles:      integer("distance_miles"),
  co2Kg:              integer("co2_kg"),
  status:             varchar("status", { length: 16 }).default("on_time"), // 'on_time' | 'delayed'
  delayMinutes:       integer("delay_minutes").default(0),

  // Seat / class
  seat:               text("seat"),
  seatClass:          varchar("seat_class", { length: 32 }),  // economy / business / first
  isMock:             boolean("is_mock").default(false),

  // Notes
  notes:              text("notes"),

  createdAt:          timestamp("created_at").notNull().default(sql`now()`),
  updatedAt:          timestamp("updated_at").notNull().default(sql`now()`),
});

export const insertFlightSchema = createInsertSchema(flights).omit({ createdAt: true, updatedAt: true });
export const selectFlightSchema = createSelectSchema(flights);
export type InsertFlight = z.infer<typeof insertFlightSchema>;
export type Flight      = typeof flights.$inferSelect;

// ─── Trips ────────────────────────────────────────────────────────────────────
// A named group of flights belonging to a user

export const trips = pgTable("trips", {
  id:         varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  userId:     varchar("user_id", { length: 128 }).notNull().references(() => users.id, { onDelete: "cascade" }),
  title:      text("title").notNull(),
  flightIds:  text("flight_ids").notNull().default("[]"), // JSON array of flight id strings
  coverUri:   text("cover_uri"),
  starred:    boolean("starred").notNull().default(false),
  status:     varchar("status", { length: 16 }).notNull().default("planned"), // 'planned' | 'upcoming' | 'completed'
  createdAt:  timestamp("created_at").notNull().default(sql`now()`),
  updatedAt:  timestamp("updated_at").notNull().default(sql`now()`),
});

export const insertTripSchema = createInsertSchema(trips).omit({ createdAt: true, updatedAt: true }).extend({
  flightIds: z.array(z.string()).default([]),
});
export const selectTripSchema = createSelectSchema(trips);
export type InsertTrip = z.infer<typeof insertTripSchema>;
export type TripRow   = typeof trips.$inferSelect;
