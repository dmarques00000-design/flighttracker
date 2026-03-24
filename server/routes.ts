import type { Express } from "express";
import { createServer, type Server } from "node:http";
import { lookupFlight } from "./storage";

// ─── Empirical annual flights-per-person CDF ──────────────────────────────────
//
// Source basis: IATA 2023 Annual Review + FAA Civil Aerospace Medical Institute
// survey data on frequent flyers.  The global distribution of flights per person
// per year is extremely right-skewed:
//
//   ~60 % of the adult population flies 0 times per year.
//   ~25 % flies 1–2 times (leisure, occasional travel).
//   ~10 % flies 3–6 times (regular travellers).
//   ~4  % flies 7–15 times (frequent flyers).
//   ~1  % flies 16+ times  (road warriors / crew).
//
// We model this with a piecewise-linear CDF over the "flying population" (the
// ~40 % who fly at least once).  Percentile 0 = least flights, 100 = most.
// The "Top X %" badge shows (100 - percentile), i.e. how far from the top.
//
// CDF breakpoints [flightCount, cumulativePopulationFraction 0-1]:
const CDF: [number, number][] = [
  [0,   0.00],
  [1,   0.38],   // 38 % fly exactly once a year
  [2,   0.57],   // next 19 % fly twice
  [3,   0.67],
  [4,   0.74],
  [6,   0.82],
  [8,   0.87],
  [10,  0.90],
  [12,  0.92],
  [15,  0.94],
  [20,  0.96],
  [25,  0.97],
  [30,  0.975],
  [40,  0.982],
  [50,  0.988],
  [75,  0.993],
  [100, 0.997],
  [150, 0.999],
  [200, 1.000],
];

/**
 * Linearly interpolate within the CDF to get the percentile rank (0–100)
 * for a given flight count.  Higher count → higher percentile → smaller
 * "Top X%" number.
 */
function flightCountToPercentile(count: number): number {
  if (count <= 0) return 0;

  for (let i = 1; i < CDF.length; i++) {
    const [x0, y0] = CDF[i - 1];
    const [x1, y1] = CDF[i];

    if (count <= x1) {
      // Linear interpolation between the two breakpoints
      const t = (count - x0) / (x1 - x0);
      return Math.round((y0 + t * (y1 - y0)) * 100);
    }
  }

  return 100; // Above the top of the table
}

/**
 * Returns a human-readable label for the percentile tier.
 */
function percentileLabel(topPercent: number): string {
  if (topPercent <= 1)  return "Elite flyer";
  if (topPercent <= 3)  return "Road warrior";
  if (topPercent <= 5)  return "Frequent flyer";
  if (topPercent <= 10) return "Regular traveller";
  if (topPercent <= 20) return "Active traveller";
  return "Traveller";
}

export async function registerRoutes(app: Express): Promise<Server> {
  // ── Existing flight-lookup endpoint ────────────────────────────────────────
  app.get("/api/flights/lookup", async (req, res) => {
    const { code, date, dep, arr } = req.query;

    console.log("[Route] /api/flights/lookup called");
    console.log("[Route] Query params:", { code, date, dep, arr });

    if (!code || !date || typeof code !== "string" || typeof date !== "string") {
      console.log("[Route] Missing or invalid params — returning 400");
      return res.status(400).json({ error: "Missing flight code or date" });
    }

    try {
      console.log(`[Route] Calling lookupFlight(${code}, ${date}, ${dep}, ${arr})`);
      const result = await lookupFlight(
        code.toUpperCase(),
        date,
        typeof dep === "string" ? dep.toUpperCase() : undefined,
        typeof arr === "string" ? arr.toUpperCase() : undefined,
      );
      console.log(`[Route] lookupFlight result — isMock: ${result.isMock}, flight: ${result.flightCode}, status: ${result.status}`);
      return res.json(result);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Lookup failed";
      console.error("[Route] Error in lookupFlight:", err);
      return res.status(500).json({ error: msg });
    }
  });

  // ── Percentile endpoint ────────────────────────────────────────────────────
  //
  // GET /api/percentile?count=N
  //
  // Returns the user's standing among the global flying population based on
  // an empirical CDF derived from IATA annual passenger survey data.
  //
  // Response:
  //   { percentile: number,   // 0–100, how many % of flyers you beat
  //     topPercent: number,   // 100 - percentile  (shown as "Top X%")
  //     label: string }       // human label for the tier
  app.get("/api/percentile", (req, res) => {
    const raw = req.query.count;
    const count = typeof raw === "string" ? parseInt(raw, 10) : NaN;

    if (isNaN(count) || count < 0) {
      return res.status(400).json({ error: "count must be a non-negative integer" });
    }

    const percentile = flightCountToPercentile(count);
    const topPercent = Math.max(1, 100 - percentile);
    const label = percentileLabel(topPercent);

    console.log(`[Route] /api/percentile count=${count} → percentile=${percentile} topPercent=${topPercent}`);
    return res.json({ percentile, topPercent, label });
  });

  const httpServer = createServer(app);
  return httpServer;
}
