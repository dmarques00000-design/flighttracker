import type { Express } from "express";
import { createServer, type Server } from "node:http";
import { lookupFlight } from "./storage";

export async function registerRoutes(app: Express): Promise<Server> {
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

  const httpServer = createServer(app);
  return httpServer;
}
