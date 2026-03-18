import type { Express } from "express";
import { createServer, type Server } from "node:http";
import { lookupFlight } from "./storage";

export async function registerRoutes(app: Express): Promise<Server> {
  app.get("/api/flights/lookup", async (req, res) => {
    const { code, date, dep, arr } = req.query;
    if (!code || !date || typeof code !== "string" || typeof date !== "string") {
      return res.status(400).json({ error: "Missing flight code or date" });
    }

    try {
      const result = await lookupFlight(
        code.toUpperCase(),
        date,
        typeof dep === "string" ? dep.toUpperCase() : undefined,
        typeof arr === "string" ? arr.toUpperCase() : undefined,
      );      return res.json(result);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Lookup failed";
      return res.status(500).json({ error: msg });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
