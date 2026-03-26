import type { Express } from "express";
import { createServer, type Server } from "node:http";
import { lookupFlight, lookupFlightsByAirport } from "./storage";

// ─── Empirical annual flights-per-person CDF ──────────────────────────────────
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

// ─── Notion feedback helper ───────────────────────────────────────────────────
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

  const title = `[${payload.category}] ${payload.message.slice(0, 60)}${payload.message.length > 60 ? "…" : ""}`;

  const body = {
    parent: { database_id: NOTION_FEEDBACK_DB_ID },
    properties: {
      Title:        { title: [{ text: { content: title } }] },
      Category:     { select: { name: payload.category } },
      Message:      { rich_text: [{ text: { content: payload.message } }] },
      "User Name":  { rich_text: [{ text: { content: payload.userName  ?? "" } }] },
      "User Email": { rich_text: [{ text: { content: payload.userEmail ?? "" } }] },
      "App Version":{ rich_text: [{ text: { content: payload.appVersion ?? "" } }] },
      Platform:     { select: { name: payload.platform ?? "ios" } },
      Status:       { select: { name: "New" } },
    },
  };

  const res = await fetch("https://api.notion.com/v1/pages", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`,
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
        code.toUpperCase(), date,
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

  // ── Airport schedule search endpoint ────────────────────────────────────
  app.get("/api/flights/search", async (req, res) => {
    const { date, dep, arr } = req.query;
    console.log("[Route] /api/flights/search called");
    console.log("[Route] Query params:", { date, dep, arr });
    if (!date || typeof date !== "string") return res.status(400).json({ error: "Missing date parameter (YYYY-MM-DD)" });
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return res.status(400).json({ error: "Invalid date format — use YYYY-MM-DD" });
    const depStr = typeof dep === "string" && dep.trim() ? dep.trim().toUpperCase() : undefined;
    const arrStr = typeof arr === "string" && arr.trim() ? arr.trim().toUpperCase() : undefined;
    if (!depStr && !arrStr) return res.status(400).json({ error: "Provide at least one of dep or arr" });
    if (depStr && !/^[A-Z]{3}$/.test(depStr)) return res.status(400).json({ error: `Invalid departure airport code: ${depStr}` });
    if (arrStr && !/^[A-Z]{3}$/.test(arrStr)) return res.status(400).json({ error: `Invalid arrival airport code: ${arrStr}` });
    try {
      const results = await lookupFlightsByAirport(depStr, arrStr, date);
      console.log(`[Route] /api/flights/search returning ${results.length} flight(s)`);
      return res.json(results);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Search failed";
      console.error("[Route] Error in lookupFlightsByAirport:", err);
      return res.status(500).json({ error: msg });
    }
  });

  // ── Percentile endpoint ─────────────────────────────────────────────────
  app.get("/api/percentile", (req, res) => {
    const raw = req.query.count;
    const count = typeof raw === "string" ? parseInt(raw, 10) : NaN;
    if (isNaN(count) || count < 0) return res.status(400).json({ error: "count must be a non-negative integer" });
    const percentile = flightCountToPercentile(count);
    const topPercent = Math.max(0.1, Math.round((100 - percentile) * 10) / 10);
    console.log(`[Route] /api/percentile count=${count} → percentile=${percentile} topPercent=${topPercent}`);
    return res.json({ percentile, topPercent });
  });

  // ── Beta feedback endpoint ───────────────────────────────────────────────
  //
  // POST /api/feedback
  // Body: { category, message, userName?, userEmail?, appVersion?, platform? }
  // Stores a new row in the "Beta Feedback" Notion database.
  app.post("/api/feedback", async (req, res) => {
    console.log("[Route] POST /api/feedback called");
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
      console.log(`[Route] Feedback stored in Notion — category: ${resolvedCategory}`);
      return res.json({ ok: true });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to store feedback";
      console.error("[Route] Error storing feedback:", err);
      return res.status(500).json({ error: msg });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
