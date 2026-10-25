import { randomUUID } from "node:crypto";
import { env } from "../config/env";
import type {
  CreatePaymentInput,
  Payment,
  PaymentStatus,
} from "../domain/payment";
import { webhookClient } from "../infrastructure/webhook.client";
import { paymentRepository } from "../infrastructure/payment.repository";
import { PaymentEvent } from "../domain/events";

export class PaymentService {
  async createPayment(input: CreatePaymentInput): Promise<Payment> {
    const now = new Date().toISOString();

    const payment: Payment = {
      id: randomUUID(),
      amount: input.amount,
      currency: input.currency.toUpperCase(),
      ...(input.description ? { description: input.description } : {}),
      status: "pending",
      createdAt: now,
      updatedAt: now,
    };

    const created = await paymentRepository.create(payment);

    await webhookClient.publish(PaymentEvent.CREATED, created);

    void this.processPayment(created.id);

    return created;
  }

  async getPayments(): Promise<Payment[]> {
    return paymentRepository.findAll();
  }

  async getPayment(id: string): Promise<Payment | undefined> {
    return paymentRepository.findById(id);
  }

  async updatePaymentStatus(
    id: string,
    status: "succeeded" | "failed"
  ): Promise<Payment | undefined> {
    const existing = await paymentRepository.findById(id);

    if (!existing) {
      return undefined;
    }

    // if (existing.status === "succeeded" || existing.status === "failed") {
    //   throw new PaymentStatusError(`Payment is already ${existing.status}.`);
    // }

    const updated = await paymentRepository.update(id, {
      status,
      updatedAt: new Date().toISOString(),
    });

    if (updated) {
      await webhookClient.publish(PaymentEvent.STATUS_UPDATED, updated);
      await webhookClient.publish(`payment.${status}`, updated);
    }

    return updated;
  }

  private async processPayment(id: string): Promise<void> {
    try {
      const current = await paymentRepository.findById(id);

      if (!current || current.status !== "pending") {
        return;
      }

      const processing = await paymentRepository.update(id, {
        status: "processing",
        updatedAt: new Date().toISOString(),
      });

      if (!processing) {
        return;
      }

      await webhookClient.publish(PaymentEvent.PROCESSING, processing);

      await new Promise((resolve) =>
        setTimeout(resolve, env.processingDelayMs)
      );

      const latest = await paymentRepository.findById(id);

      if (!latest || latest.status !== "processing") {
        return;
      }

      const finalStatus: PaymentStatus = "succeeded";

      const completed = await paymentRepository.update(id, {
        status: finalStatus,
        updatedAt: new Date().toISOString(),
      });

      if (completed) {
        await webhookClient.publish(PaymentEvent.SUCCEEDED, completed);
      }
    } catch (error) {
      console.error("Payment simulation failed", { id, error });
    }
  }

  async getAllPayments(page = 1, limit = 10) {
    const payments = await this.getPayments();

    const totalItems = payments.length;
    const totalPages = Math.ceil(totalItems / limit);
    const offset = (page - 1) * limit;

    return {
      data: payments.slice(offset, offset + limit),
      meta: {
        currentPage: page,
        perPage: limit,
        totalItems,
        totalPages,
      },
    };
  }
}

export class PaymentStatusError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PaymentStatusError";
  }
}

export const paymentService = new PaymentService();
