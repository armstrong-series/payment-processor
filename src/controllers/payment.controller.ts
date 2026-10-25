import type { NextFunction, Request, Response } from "express";
import { z } from "zod";
import {
  PaymentStatusError,
  paymentService,
} from "../services/payment.service";
import { success } from "../utils/apiResponse";

function getPaymentId(id: string | string[] | undefined): string {
  return z
    .string()
    .trim()
    .min(1, "Payment ID is required.")
    .parse(typeof id === "string" ? id : undefined);
}

const createPaymentSchema = z
  .object({
    amount: z.number().finite().positive(),
    currency: z
      .string()
      .trim()
      .length(3)
      .regex(/^[a-zA-Z]{3}$/),
    description: z.string().trim().max(500).optional(),
  })
  .strict();

const updateStatusSchema = z
  .object({
    status: z.enum(["succeeded", "failed"]),
  })
  .strict();

export class PaymentController {
  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const input = createPaymentSchema.parse(req.body);
      const payment = await paymentService.createPayment(input);

      return success(res, "Payment created successfully.", payment, 201);
    } catch (error) {
      next(error);
    }
  }

  async list(_req: Request, res: Response, next: NextFunction) {
    try {
      const payments = await paymentService.getPayments();
      return success(res, "Payments retrieved successfully.", payments);
    } catch (error) {
      next(error);
    }
  }

  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const id = getPaymentId(req.params.id);
      const payment = await paymentService.getPayment(id);

      if (!payment) {
        return res.status(404).json({
          message: "Payment not found.",
          status: "error",
          error: { code: "PAYMENT_NOT_FOUND" },
        });
      }

      return success(res, "Payment retrieved successfully.", payment);
    } catch (error) {
      next(error);
    }
  }

  async updateStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const { status } = updateStatusSchema.parse(req.body);

      const id = getPaymentId(req.params.id);
      const payment = await paymentService.updatePaymentStatus(id, status);

      if (!payment) {
        return res.status(404).json({
          message: "Payment not found.",
          status: "error",
          error: { code: "PAYMENT_NOT_FOUND" },
        });
      }

      return success(res, "Payment status updated successfully.", payment);
    } catch (error) {
      next(error);
    }
  }

  async getAll(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsedPage = Number(req.query.page ?? 1);
      const parsedLimit = Number(req.query.limit ?? 10);

      const page =
        Number.isInteger(parsedPage) && parsedPage > 0 ? parsedPage : 1;

      const limit =
        Number.isInteger(parsedLimit) && parsedLimit > 0
          ? Math.min(parsedLimit, 100)
          : 10;

      const result = await paymentService.getAllPayments(page, limit);

      res.status(200).json({
        message: "Payments retrieved successfully.",
        status: "success",
        data: result.data,
        meta: result.meta,
      });
    } catch (error) {
      next(error);
    }
  }
}

export const paymentController = new PaymentController();
