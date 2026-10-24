import type { Response } from "express";

export function success<T>(
  res: Response,
  message: string,
  data: T,
  statusCode = 200
) {
  return res.status(statusCode).json({
    message,
    status: "success",
    data,
  });
}

export function failure(
  res: Response,
  message: string,
  statusCode: number,
  code: string
) {
  return res.status(statusCode).json({
    message,
    status: "error",
    error: { code },
  });
}
