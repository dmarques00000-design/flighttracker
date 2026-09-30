import type { NextFunction, Request, Response } from "express";
import { verifySessionToken } from "../appleAuth";

declare global {
  namespace Express {
    interface Request {
      authUserId?: string;
    }
  }
}

const PUBLIC_API_PATHS = new Set([
  "/auth/upsert",
  "/flights/lookup",
  "/flights/search",
  "/percentile",
]);

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (PUBLIC_API_PATHS.has(req.path)) return next();

  const authorization = req.header("authorization");
  if (!authorization?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Authentication required" });
  }

  const token = authorization.slice("Bearer ".length).trim();
  const userId = verifySessionToken(token);

  if (!userId) {
    return res.status(401).json({ error: "Invalid or expired session" });
  }

  req.authUserId = userId;
  return next();
}
