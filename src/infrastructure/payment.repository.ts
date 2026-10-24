import { randomUUID } from "node:crypto";
import { dirname, resolve } from "node:path";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { env } from "../config/env";
import type { Payment, PaymentStatus, PaymentRow } from "../domain/payment";
import { db } from "./database";
import { PaymentEvent } from "../domain/events";

function insertOutboxEvent(eventType: PaymentEvent, payment: Payment): void {
  const now = new Date().toISOString();

  db.prepare(
    `
    INSERT INTO outbox_events (
      id, event_type, aggregate_id, payload,
      created_at, next_attempt_at
    ) VALUES (?, ?, ?, ?, ?, ?)
  `
  ).run(randomUUID(), eventType, payment.id, JSON.stringify(payment), now, now);
}

class PaymentRepository {
  private readonly filePath = resolve(env.paymentsFile);
  private writeQueue: Promise<void> = Promise.resolve();

  private async readAll(): Promise<Payment[]> {
    try {
      const content = await readFile(this.filePath, "utf8");
      return JSON.parse(content) as Payment[];
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return [];
      }

      throw error;
    }
  }

  private async writeAll(payments: Payment[]): Promise<void> {
    await mkdir(dirname(this.filePath), { recursive: true });

    const tempPath = `${this.filePath}.${randomUUID()}.tmp`;

    await writeFile(tempPath, JSON.stringify(payments, null, 2), "utf8");
    await rename(tempPath, this.filePath);
  }

  private async serializeWrite<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.writeQueue.then(operation);

    this.writeQueue = result.then(
      () => undefined,
      () => undefined
    );

    return result;
  }

  async create(payment: Payment): Promise<Payment> {
    return this.serializeWrite(async () => {
      const payments = await this.readAll();
      payments.push(payment);
      await this.writeAll(payments);
      return payment;
    });
  }

  async findAll(): Promise<Payment[]> {
    await this.writeQueue;
    return this.readAll();
  }

  async findById(id: string): Promise<Payment | undefined> {
    const payments = await this.findAll();
    return payments.find((payment) => payment.id === id);
  }

  async update(
    id: string,
    changes: Partial<Payment>
  ): Promise<Payment | undefined> {
    return this.serializeWrite(async () => {
      const payments = await this.readAll();
      const index = payments.findIndex((payment) => payment.id === id);

      if (index === -1) {
        return undefined;
      }

      payments[index] = { ...payments[index], ...changes };
      await this.writeAll(payments);

      return payments[index];
    });
  }
}

export const paymentRepository = new PaymentRepository();
