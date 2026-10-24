import type { ErrorRequestHandler } from "express";
import { ZodError } from "zod";
import { PaymentStatusError } from "../services/payment.service";

export const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  if (error instanceof ZodError) {
    return res.status(400).json({
      message: "Validation failed.",
      status: "error",
      error: {
        code: "VALIDATION_ERROR",
        details: error.issues.map((issue) => ({
          field: issue.path.join("."),
          message: issue.message,
        })),
      },
    });
  }

  if (error instanceof PaymentStatusError) {
    return res.status(409).json({
      message: error.message,
      status: "error",
      error: { code: "INVALID_PAYMENT_STATUS_TRANSITION" },
    });
  }

  console.error("Unhandled application error:", error);

  return res.status(500).json({
    message: "An unexpected error occurred.",
    status: "error",
    error: { code: "INTERNAL_SERVER_ERROR" },
  });
};
