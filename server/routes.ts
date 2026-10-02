import type { Express } from "express";
import { createServer, type Server } from "node:http";
import { lookupFlight, lookupFlightsByAirport } from "./storage";
import { upsertUser, getUserById, deleteUser } from "./userStorage";
import { getFlightsByUser, createFlight, deleteFlight, updateFlight, DuplicateFlightError } from "./flightStorage";
import { getTripsByUser, createTrip, updateTrip, deleteTrip } from "./tripStorage";
import { insertFlightSchema, insertTripSchema } from "../shared/schema";
import { authLimiter, writeLimiter, readLimiter } from "./middleware/security";
import { requireAuth } from "./middleware/auth";
import { createSessionToken, verifyAppleIdentityToken } from "./appleAuth";
import { z } from "zod";
import { migrateGuestData } from "./guestMigration";

// ─── Empirical annual flights-per-person CDF ──────────────────────────────────────────────────
const CDF: [number, number][] = [
  [  0, 0.0000 ],
  [  1, 0.3800 ],
  [  2, 0.5700 ],
  [  3, 0.6500 ],
  [  4, 0.7080 ],
  [  5, 0.7500 ],
  [  6, 0.7840 ],
  [  7, 0.8100 ],
  [  8, 0.8300 ],
  [  9, 0.8460 ],
  [ 10, 0.8600 ],
  [ 11, 0.8710 ],
  [ 12, 0.8810 ],
  [ 13, 0.8895 ],
  [ 14, 0.8970 ],
  [ 15, 0.9040 ],
  [ 16, 0.9100 ],
  [ 17, 0.9155 ],
  [ 18, 0.9205 ],
  [ 19, 0.9250 ],
  [ 20, 0.9292 ],
  [ 21, 0.9330 ],
  [ 22, 0.9365 ],
  [ 23, 0.9398 ],
  [ 24, 0.9428 ],
  [ 25, 0.9455 ],
  [ 26, 0.9480 ],
  [ 27, 0.9503 ],
  [ 28, 0.9524 ],
  [ 29, 0.9544 ],
  [ 30, 0.9562 ],
  [ 31, 0.9579 ],
  [ 32, 0.9595 ],
  [ 33, 0.9610 ],
  [ 34, 0.9624 ],
  [ 35, 0.9637 ],
  [ 36, 0.9649 ],
  [ 37, 0.9660 ],
  [ 38, 0.9671 ],
  [ 39, 0.9681 ],
  [ 40, 0.9690 ],
  [ 41, 0.9699 ],
  [ 42, 0.9707 ],
  [ 43, 0.9715 ],
  [ 44, 0.9722 ],
  [ 45, 0.9729 ],
  [ 46, 0.9736 ],
  [ 47, 0.9742 ],
  [ 48, 0.9748 ],
  [ 49, 0.9754 ],
  [ 50, 0.9760 ],
  [ 55, 0.9785 ],
  [ 60, 0.9808 ],
  [ 65, 0.9825 ],
  [ 70, 0.9840 ],
  [ 75, 0.9855 ],
  [ 80, 0.9867 ],
  [ 90, 0.9885 ],
  [100, 0.9900 ],
  [125, 0.9930 ],
  [150, 0.9955 ],
  [200, 1.0000 ],
];

function flightCountToPercentile(count: number): number {
  if (count <= 0) return 0;
  for (let i = 1; i < CDF.length; i++) {
    const [x0, y0] = CDF[i - 1];
    const [x1, y1] = CDF[i];
    if (count <= x1) {
      const t = (count - x0) / (x1 - x0);
      return Math.round((y0 + t * (y1 - y0)) * 1000) / 10;
    }
  }
  return 100;
}

// ─── Notion feedback helper ───────────────────────────────────────────────────────────────────
const NOTION_FEEDBACK_DB_ID = "d0f10547-8b19-43c8-98e3-4640f62539f0";

async function createNotionFeedbackEntry(payload: {
  category: string;
  message: string;
  userName?: string;
  userEmail?: string;
  appVersion?: string;
  platform?: string;
}): Promise<void> {
  const token = process.env.NOTION_TOKEN;
  if (!token) throw new Error("NOTION_TOKEN env var not set");

  const title = `[${payload.category}] ${payload.message.slice(0, 60)}${
    payload.message.length > 60 ? "\u2026" : ""
  }`;

  const body = {
    parent: { database_id: NOTION_FEEDBACK_DB_ID },
    properties: {
      Title:         { title: [{ text: { content: title } }] },
      Category:      { select: { name: payload.category } },
      Message:       { rich_text: [{ text: { content: payload.message } }] },
      "User Name":   { rich_text: [{ text: { content: payload.userName  ?? "" } }] },
      "User Email":  { rich_text: [{ text: { content: payload.userEmail ?? "" } }] },
      "App Version": { rich_text: [{ text: { content: payload.appVersion ?? "" } }] },
      Platform:      { select: { name: payload.platform ?? "ios" } },
      Status:        { select: { name: "New" } },
    },
  };

  const res = await fetch("https://api.notion.com/v1/pages", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "Notion-Version": "2022-06-28",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Notion API error ${res.status}: ${text}`);
  }
}

export async function registerRoutes(app: Express): Promise<Server> {

  // ── Auth: verify Apple identity and create a server session ───────────────────────
  app.post("/api/auth/upsert", authLimiter, async (req, res) => {
    const body = req.body ?? {};
    const parsed = z.object({
      provider: z.enum(["apple", "email"]),
      identityToken: z.string().min(100).optional(),
      nonce: z.string().min(8).optional(),
      name: z.string().max(200).optional().default(""),
      id: z.string().max(128).optional(),
      email: z.string().email().optional().nullable(),
    }).safeParse(body);

    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.flatten() });
    }

    try {
      let userId: string;
      let email: string | null = null;
      let provider: "apple" | "email" = parsed.data.provider;

      if (parsed.data.provider === "apple") {
        if (!parsed.data.identityToken || !parsed.data.nonce) {
          return res.status(400).json({ error: "Apple identity token and nonce are required" });
        }

        const claims = await verifyAppleIdentityToken(
          parsed.data.identityToken,
          parsed.data.nonce,
        );

        userId = claims.sub;
        email = typeof claims.email === "string" ? claims.email : null;
      } else {
        // Development-only test account. It cannot be used in production.
        if (
          process.env.NODE_ENV === "production" ||
          process.env.ALLOW_TEST_AUTH !== "true" ||
          parsed.data.id !== "test-user-001"
        ) {
          return res.status(401).json({ error: "Test authentication is disabled" });
        }
        userId = "test-user-001";
        email = parsed.data.email ?? "diogo.test@logbook.app";
      }

      const user = await upsertUser({
        id: userId,
        email,
        name: parsed.data.name?.trim().slice(0, 200) || null,
        avatarUrl: null,
        provider,
      });

      return res.json({
        sessionToken: createSessionToken(user.id),
        user,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Authentication failed";
      console.error("[Route] Apple authentication failed:", msg);
      return res.status(401).json({ error: "Apple authentication failed" });
    }
  });

  // ── Guest data migration ─────────────────────────────────────────────────────
  // Moves pre-auth local data into the authenticated account in one transaction.
  app.post("/api/auth/migrate-guest-data", writeLimiter, async (req, res) => {
    const parsed = z.object({
      flights: z.array(z.object({
        id: z.string().max(128).optional(),
        flightCode: z.string().max(64).nullable().optional(),
        date: z.string().max(10).optional(),
        airline: z.string().max(200).nullable().optional(),
        airlineCode: z.string().max(16).nullable().optional(),
        departureAirport: z.string().max(4).optional(),
        arrivalAirport: z.string().max(4).optional(),
        departureCity: z.string().max(200).nullable().optional(),
        arrivalCity: z.string().max(200).nullable().optional(),
        departureTime: z.string().max(5).nullable().optional(),
        arrivalTime: z.string().max(5).nullable().optional(),
        durationMinutes: z.number().nullable().optional(),
        distanceMiles: z.number().nullable().optional(),
        co2Kg: z.number().nullable().optional(),
        status: z.string().max(16).nullable().optional(),
        delayMinutes: z.number().nullable().optional(),
        aircraft: z.string().max(200).nullable().optional(),
        addedAt: z.string().optional(),
        isMock: z.boolean().optional(),
        tailNumber: z.string().max(64).nullable().optional(),
        departureTerminal: z.string().max(64).nullable().optional(),
        arrivalTerminal: z.string().max(64).nullable().optional(),
        departureGate: z.string().max(64).nullable().optional(),
        arrivalGate: z.string().max(64).nullable().optional(),
      }).passthrough()).max(500),
      trips: z.array(z.object({
        id: z.string().max(128).optional(),
        title: z.string().max(200).optional(),
        flightIds: z.array(z.string().max(128)).optional(),
        createdAt: z.string().optional(),
        coverUri: z.string().max(2048).nullable().optional(),
        starred: z.boolean().optional(),
        status: z.string().max(16).optional(),
      }).passthrough()).max(200),
    }).safeParse(req.body ?? {});

    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.flatten() });
    }

    try {
      const result = await migrateGuestData(
        req.authUserId!,
        parsed.data.flights,
        parsed.data.trips,
      );
      return res.json({ ok: true, ...result });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Guest data migration failed";
      console.error("[Route] guest data migration failed:", err);
      return res.status(500).json({ error: msg });
    }
  });

  // ── Auth: get user by id ─────────────────────────────────────────────────────

  // All routes below authentication require a verified server session.
  // Public endpoints are explicitly exempted in the middleware.
  app.use("/api", requireAuth);
  app.get("/api/users/:id", readLimiter, async (req, res) => {
    const id = String(req.params.id);
    if (req.authUserId !== id) return res.status(403).json({ error: "Forbidden" });
    try {
      const user = await getUserById(id);
      if (!user) return res.status(404).json({ error: "User not found" });
      return res.json(user);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Fetch failed";
      return res.status(500).json({ error: msg });
    }
  });

  // ── Auth: delete account and all associated data ─────────────────────────────
  // Flights and trips are cascade-deleted via FK constraints in the schema.
  // Required by Apple App Store guideline 5.1.1.
  app.delete("/api/users/:id", writeLimiter, async (req, res) => {
    const id = String(req.params.id);
    if (req.authUserId !== id) return res.status(403).json({ error: "Forbidden" });
    console.log(`[Route] DELETE /api/users/${id}`);
    try {
      const deleted = await deleteUser(id);
      if (!deleted) return res.status(404).json({ error: "User not found" });
      return res.json({ ok: true });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Delete failed";
      console.error("[Route] deleteUser error:", err);
      return res.status(500).json({ error: msg });
    }
  });

  // ── Flights: list all flights for a user ──────────────────────────────────────────
  app.get("/api/users/:userId/flights", readLimiter, async (req, res) => {
    const userId = req.authUserId!;
    if (req.params.userId !== userId) return res.status(403).json({ error: "Forbidden" });
    console.log(`[Route] GET /api/users/${userId}/flights`);
    try {
      const userFlights = await getFlightsByUser(userId);
      return res.json(userFlights);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Fetch failed";
      console.error("[Route] getFlightsByUser error:", err);
      return res.status(500).json({ error: msg });
    }
  });

  // ── Flights: save a new flight ─────────────────────────────────────────────────────
  app.post("/api/flights", writeLimiter, async (req, res) => {
    console.log("[Route] POST /api/flights — userId:", req.body?.userId);
    const parsed = insertFlightSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.flatten() });
    }
    try {
      const flight = await createFlight({ ...parsed.data, userId: req.authUserId! });
      return res.status(201).json(flight);
    } catch (err) {
      if (err instanceof DuplicateFlightError) {
        return res.status(409).json({ error: err.message, code: "DUPLICATE_FLIGHT" });
      }
      const msg = err instanceof Error ? err.message : "Create failed";
      console.error("[Route] createFlight error:", (err as any)?.detail ?? msg);
      return res.status(500).json({ error: msg });
    }
  });

  // ── Flights: update a flight ──────────────────────────────────────────────────────────────
  app.patch("/api/flights/:id", writeLimiter, async (req, res) => {
    const id = String(req.params.id);
    const rest = { ...(req.body ?? {}) };
    delete rest.userId;
    const userId = req.authUserId!;
    console.log(`[Route] PATCH /api/flights/${id}`);
    try {
      const updated = await updateFlight(id, userId, rest);
      if (!updated) return res.status(404).json({ error: "Flight not found or unauthorised" });
      return res.json(updated);
    } catch (err) {
      if (err instanceof DuplicateFlightError) {
        return res.status(409).json({ error: err.message, code: "DUPLICATE_FLIGHT" });
      }
      const msg = err instanceof Error ? err.message : "Update failed";
      console.error("[Route] updateFlight error:", err);
      return res.status(500).json({ error: msg });
    }
  });

  // ── Flights: delete a flight ──────────────────────────────────────────────────────────────
  app.delete("/api/flights/:id", writeLimiter, async (req, res) => {
    const id = String(req.params.id);
    const userId = req.authUserId!;
    console.log(`[Route] DELETE /api/flights/${id}`);
    try {
      const ok = await deleteFlight(id, userId);
      if (!ok) return res.status(404).json({ error: "Flight not found or unauthorised" });
      return res.json({ ok: true });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Delete failed";
      console.error("[Route] deleteFlight error:", err);
      return res.status(500).json({ error: msg });
    }
  });

  // ── Flight-lookup endpoint ───────────────────────────────────────────────────────────────────
  app.get("/api/flights/lookup", readLimiter, async (req, res) => {
    const { code, date, dep, arr } = req.query;
    if (!code || !date || typeof code !== "string" || typeof date !== "string") {
      return res.status(400).json({ error: "Missing flight code or date" });
    }
    try {
      const result = await lookupFlight(
        code.toUpperCase(), date,
        typeof dep === "string" ? dep.toUpperCase() : undefined,
        typeof arr === "string" ? arr.toUpperCase() : undefined,
      );
      return res.json(result);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Lookup failed";
      return res.status(500).json({ error: msg });
    }
  });

  // ── Airport schedule search endpoint ───────────────────────────────────────────────
  app.get("/api/flights/search", readLimiter, async (req, res) => {
    const { date, dep, arr } = req.query;
    if (!date || typeof date !== "string") return res.status(400).json({ error: "Missing date parameter (YYYY-MM-DD)" });
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return res.status(400).json({ error: "Invalid date format — use YYYY-MM-DD" });
    const depStr = typeof dep === "string" && dep.trim() ? dep.trim().toUpperCase() : undefined;
    const arrStr = typeof arr === "string" && arr.trim() ? arr.trim().toUpperCase() : undefined;
    if (!depStr && !arrStr) return res.status(400).json({ error: "Provide at least one of dep or arr" });
    if (depStr && !/^[A-Z]{3}$/.test(depStr)) return res.status(400).json({ error: `Invalid departure airport code: ${depStr}` });
    if (arrStr && !/^[A-Z]{3}$/.test(arrStr)) return res.status(400).json({ error: `Invalid arrival airport code: ${arrStr}` });
    try {
      const results = await lookupFlightsByAirport(depStr, arrStr, date);
      return res.json(results);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Search failed";
      return res.status(500).json({ error: msg });
    }
  });

  // ── Percentile endpoint ───────────────────────────────────────────────────────────────────────
  app.get("/api/percentile", readLimiter, (req, res) => {
    const raw = req.query.count;
    const count = typeof raw === "string" ? parseInt(raw, 10) : NaN;
    if (isNaN(count) || count < 0) return res.status(400).json({ error: "count must be a non-negative integer" });
    const percentile = flightCountToPercentile(count);
    const topPercent = Math.max(0.1, Math.round((100 - percentile) * 10) / 10);
    return res.json({ percentile, topPercent });
  });

  // ── Beta feedback endpoint ──────────────────────────────────────────────────────────────────
  app.post("/api/feedback", writeLimiter, async (req, res) => {
    const { category, message, userName, userEmail, appVersion, platform } = req.body ?? {};
    if (!message || typeof message !== "string" || message.trim().length < 3) {
      return res.status(400).json({ error: "message must be at least 3 characters" });
    }
    const validCategories = ["Bug", "Suggestion", "General", "Performance", "UI/UX"];
    const resolvedCategory = validCategories.includes(category) ? category : "General";
    try {
      await createNotionFeedbackEntry({
        category: resolvedCategory,
        message:  message.trim().slice(0, 2000),
        userName:   typeof userName   === "string" ? userName.trim()   : undefined,
        userEmail:  typeof userEmail  === "string" ? userEmail.trim()  : undefined,
        appVersion: typeof appVersion === "string" ? appVersion.trim() : undefined,
        platform:   typeof platform   === "string" ? platform          : "ios",
      });
      return res.json({ ok: true });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to store feedback";
      return res.status(500).json({ error: msg });
    }
  });

  // ────────────────────────────────────────────────────────────────────────────────
  // TRIPS
  // ────────────────────────────────────────────────────────────────────────────────

  // ── Trips: list all trips for a user ──────────────────────────────────────────────
  app.get("/api/users/:userId/trips", readLimiter, async (req, res) => {
    const userId = req.authUserId!;
    if (req.params.userId !== userId) return res.status(403).json({ error: "Forbidden" });
    console.log(`[Route] GET /api/users/${userId}/trips`);
    try {
      const userTrips = await getTripsByUser(userId);
      return res.json(userTrips);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Fetch failed";
      console.error("[Route] getTripsByUser error:", err);
      return res.status(500).json({ error: msg });
    }
  });

  // ── Trips: create a new trip ───────────────────────────────────────────────────────────
  app.post("/api/trips", writeLimiter, async (req, res) => {
    console.log("[Route] POST /api/trips — userId:", req.body?.userId);
    const parsed = insertTripSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.flatten() });
    }
    try {
      const trip = await createTrip({ ...parsed.data, userId: req.authUserId! });
      return res.status(201).json(trip);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Create failed";
      console.error("[Route] createTrip error:", (err as any)?.detail ?? msg);
      return res.status(500).json({ error: msg });
    }
  });

  // ── Trips: update a trip (title, flightIds, coverUri, starred, status) ───────────────
  app.patch("/api/trips/:id", writeLimiter, async (req, res) => {
    const id = String(req.params.id);
    const rest = { ...(req.body ?? {}) };
    delete rest.userId;
    const userId = req.authUserId!;
    console.log(`[Route] PATCH /api/trips/${id}`);
    try {
      const updated = await updateTrip(id, userId, rest);
      if (!updated) return res.status(404).json({ error: "Trip not found or unauthorised" });
      return res.json(updated);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Update failed";
      console.error("[Route] updateTrip error:", err);
      return res.status(500).json({ error: msg });
    }
  });

  // ── Trips: delete a trip ──────────────────────────────────────────────────────────────────
  app.delete("/api/trips/:id", writeLimiter, async (req, res) => {
    const id = String(req.params.id);
    const userId = req.authUserId!;
    console.log(`[Route] DELETE /api/trips/${id}`);
    try {
      const ok = await deleteTrip(id, userId);
      if (!ok) return res.status(404).json({ error: "Trip not found or unauthorised" });
      return res.json({ ok: true });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Delete failed";
      console.error("[Route] deleteTrip error:", err);
      return res.status(500).json({ error: msg });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
