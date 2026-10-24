import { timingSafeEqual } from "node:crypto";
import type { Request, Response, NextFunction } from "express";
import { env } from "../config/env";

export function apiKeyAuth(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const requestHeader = req.header("X-API-Key");

  if (!requestHeader || !env.apiKey) {
    res.status(401).json({
      message: "API key is required.",
      status: "error",
      data: [],
    });
    return;
  }

  const provided = Buffer.from(requestHeader, "utf8");
  const expected = Buffer.from(env.apiKey, "utf8");

  if (
    provided.length !== expected.length ||
    !timingSafeEqual(provided, expected)
  ) {
    res.status(401).json({
      message: "Invalid API key.",
      status: "error",
      data: [],
    });
    return;
  }

  next();
}
