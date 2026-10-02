import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });
dotenv.config();
import express from "express";
import { Pool } from "pg";
import type { Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { bootstrapDatabase } from "./bootstrap";
import { securityHeaders } from "./middleware/security";

const app = express();
const log = console.log;

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

function setupCors(app: express.Application) {
  app.use((req, res, next) => {
    const origin = req.header("origin");

    const isAllowed =
      !origin ||
      origin.startsWith("http://localhost:") ||
      origin.startsWith("http://127.0.0.1:") ||
      origin.startsWith("http://192.168.") ||
      origin.startsWith("http://10.") ||
      origin.startsWith("http://172.");

    if (isAllowed) {
      res.header("Access-Control-Allow-Origin", origin || "*");
      res.header("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
      res.header("Access-Control-Allow-Headers", "Content-Type");
      res.header("Access-Control-Allow-Credentials", "true");
    }

    if (req.method === "OPTIONS") {
      return res.sendStatus(200);
    }

    next();
  });
}

function setupBodyParsing(app: express.Application) {
  app.use(
    express.json({
      // Reject bodies larger than 100kb — prevents payload-based DoS attacks
      limit: "100kb",
      verify: (req, _res, buf) => {
        req.rawBody = buf;
      },
    }),
  );
  app.use(express.urlencoded({ extended: false, limit: "100kb" }));
}

function setupRequestLogging(app: express.Application) {
  app.use((req, res, next) => {
    const start = Date.now();
    const reqPath = req.path;
    let capturedJsonResponse: Record<string, unknown> | undefined = undefined;

    const originalResJson = res.json;
    res.json = function (bodyJson, ...args) {
      capturedJsonResponse = bodyJson;
      return originalResJson.apply(res, [bodyJson, ...args]);
    };

    res.on("finish", () => {
      if (!reqPath.startsWith("/api")) return;
      const duration = Date.now() - start;
      let logLine = `${req.method} ${reqPath} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }
      if (logLine.length > 80) logLine = logLine.slice(0, 79) + "\u2026";
      log(logLine);
    });

    next();
  });
}

function setupErrorHandler(app: express.Application) {
  app.use((err: unknown, _req: Request, res: Response, next: NextFunction) => {
    const error = err as { status?: number; statusCode?: number; message?: string };
    const status = error.status || error.statusCode || 500;
    const message = error.message || "Internal Server Error";
    console.error("Internal Server Error:", err);
    if (res.headersSent) return next(err);
    return res.status(status).json({ message });
  });
}

(async () => {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL env var is not set");
  }

  // ── Bootstrap: create tables if they don't exist (non-fatal) ──────────────
  try {
    const bootstrapUrl = process.env.DATABASE_URL_DIRECT || process.env.DATABASE_URL;
    const pool = new Pool({
      connectionString: bootstrapUrl,
      ssl: { rejectUnauthorized: false },
    });
    await bootstrapDatabase(pool);
    await pool.end();
  } catch (err) {
    console.warn("[bootstrap] Could not verify tables (non-fatal):", (err as Error).message);
    console.warn("[bootstrap] Tip: set DATABASE_URL_DIRECT in .env to your Neon direct connection string.");
  }

  // Security headers are applied first, before anything else
  app.use(securityHeaders());

  setupCors(app);
  setupBodyParsing(app);
  setupRequestLogging(app);

  const server = await registerRoutes(app);

  setupErrorHandler(app);

  const port = parseInt(process.env.PORT || "5000", 10);
  server.listen(port, "0.0.0.0", () => {
    log(`Server running on http://localhost:${port}`);
  });
})();
