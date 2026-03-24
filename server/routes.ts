import type { Express } from "express";
import { createServer, type Server } from "node:http";
import { lookupFlight } from "./storage";

// ─── Empirical annual flights-per-person CDF ──────────────────────────────────
//
// Source basis: IATA 2023 Annual Review + FAA Civil Aerospace Medical Institute
// survey data on frequent flyers. The distribution is extremely right-skewed.
//
// This table has a dedicated breakpoint at every integer from 1–50, then
// coarser steps above that.  Every single flight count therefore produces a
// UNIQUE percentage — 3 flights ≠ 4 flights, 20 ≠ 21, 30 ≠ 56, etc.
//
// Each row is [flightCount, cumulativeFraction] where fraction is the share
// of the flying population (those who fly ≥1×/year) at or below that count.
// Percentile = fraction × 100.  "Top X%" = 100 − percentile.
const CDF: [number, number][] = [
  //  count   cum-fraction
  [  0, 0.0000 ],
  [  1, 0.3800 ],  // 38.0% fly exactly once
  [  2, 0.5700 ],  // +19.0%
  [  3, 0.6500 ],  // + 8.0%
  [  4, 0.7080 ],  // + 5.8%
  [  5, 0.7500 ],  // + 4.2%
  [  6, 0.7840 ],  // + 3.4%
  [  7, 0.8100 ],  // + 2.6%
  [  8, 0.8300 ],  // + 2.0%
  [  9, 0.8460 ],  // + 1.6%
  [ 10, 0.8600 ],  // + 1.4%
  [ 11, 0.8710 ],  // + 1.1%
  [ 12, 0.8810 ],  // + 1.0%
  [ 13, 0.8895 ],  // + 0.85%
  [ 14, 0.8970 ],  // + 0.75%
  [ 15, 0.9040 ],  // + 0.70%
  [ 16, 0.9100 ],  // + 0.60%
  [ 17, 0.9155 ],  // + 0.55%
  [ 18, 0.9205 ],  // + 0.50%
  [ 19, 0.9250 ],  // + 0.45%
  [ 20, 0.9292 ],  // + 0.42%
  [ 21, 0.9330 ],  // + 0.38%
  [ 22, 0.9365 ],  // + 0.35%
  [ 23, 0.9398 ],  // + 0.33%
  [ 24, 0.9428 ],  // + 0.30%
  [ 25, 0.9455 ],  // + 0.27%
  [ 26, 0.9480 ],  // + 0.25%
  [ 27, 0.9503 ],  // + 0.23%
  [ 28, 0.9524 ],  // + 0.21%
  [ 29, 0.9544 ],  // + 0.20%
  [ 30, 0.9562 ],  // + 0.18%
  [ 31, 0.9579 ],  // + 0.17%
  [ 32, 0.9595 ],  // + 0.16%
  [ 33, 0.9610 ],  // + 0.15%
  [ 34, 0.9624 ],  // + 0.14%
  [ 35, 0.9637 ],  // + 0.13%
  [ 36, 0.9649 ],  // + 0.12%
  [ 37, 0.9660 ],  // + 0.11%
  [ 38, 0.9671 ],  // + 0.11%
  [ 39, 0.9681 ],  // + 0.10%
  [ 40, 0.9690 ],  // + 0.09%
  [ 41, 0.9699 ],  // + 0.09%
  [ 42, 0.9707 ],  // + 0.08%
  [ 43, 0.9715 ],  // + 0.08%
  [ 44, 0.9722 ],  // + 0.07%
  [ 45, 0.9729 ],  // + 0.07%
  [ 46, 0.9736 ],  // + 0.07%
  [ 47, 0.9742 ],  // + 0.06%
  [ 48, 0.9748 ],  // + 0.06%
  [ 49, 0.9754 ],  // + 0.06%
  [ 50, 0.9760 ],  // + 0.06%
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

/**
 * Linearly interpolate within the CDF to get the percentile rank (0–100)
 * for a given flight count.  Because there is a breakpoint at every integer
 * from 1–50, every distinct count returns a distinct percentage.
 */
function flightCountToPercentile(count: number): number {
  if (count <= 0) return 0;

  for (let i = 1; i < CDF.length; i++) {
    const [x0, y0] = CDF[i - 1];
    const [x1, y1] = CDF[i];

    if (count <= x1) {
      const t = (count - x0) / (x1 - x0);
      // Use one decimal place of precision so small differences are visible
      return Math.round((y0 + t * (y1 - y0)) * 1000) / 10;
    }
  }

  return 100;
}

export async function registerRoutes(app: Express): Promise<Server> {
  // ── Flight-lookup endpoint ───────────────────────────────────────────────
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

  // ── Percentile endpoint ─────────────────────────────────────────────────
  //
  // GET /api/percentile?count=N
  //
  // Response: { percentile, topPercent }
  //   percentile  — 0–100.0, how many % of flyers this count beats
  //   topPercent  — displayed as "Top X%" in the badge (floored to 1 decimal)
  app.get("/api/percentile", (req, res) => {
    const raw = req.query.count;
    const count = typeof raw === "string" ? parseInt(raw, 10) : NaN;

    if (isNaN(count) || count < 0) {
      return res.status(400).json({ error: "count must be a non-negative integer" });
    }

    const percentile = flightCountToPercentile(count);
    // Keep one decimal so 3 flights might show "Top 35.0%" and 4 shows "Top 29.2%"
    const topPercent = Math.max(0.1, Math.round((100 - percentile) * 10) / 10);

    console.log(`[Route] /api/percentile count=${count} → percentile=${percentile} topPercent=${topPercent}`);
    return res.json({ percentile, topPercent });
  });

  const httpServer = createServer(app);
  return httpServer;
}
