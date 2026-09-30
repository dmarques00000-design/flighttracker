import type { NextFunction, Request, Response } from "express";
import { verifySessionToken } from "../appleAuth";

declare global {
  namespace Express {
    interface Request {
      authUserId?: string;
    }
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
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
