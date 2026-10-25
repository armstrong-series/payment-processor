import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { env } from "../config/env";
import type { Payment } from "../domain/payment";

class PaymentRepository {
  private readonly filePath = resolve(env.paymentsFile);
  private writeQueue: Promise<void> = Promise.resolve();

  private async ensureFileExists(): Promise<void> {
    await mkdir(dirname(this.filePath), { recursive: true });

    try {
      await readFile(this.filePath, "utf8");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        throw error;
      }

      try {
        await writeFile(this.filePath, "[]\n", {
          encoding: "utf8",
          flag: "wx",
        });
      } catch (writeError) {
        if ((writeError as NodeJS.ErrnoException).code !== "EEXIST") {
          throw writeError;
        }
      }
    }
  }

  private async readAll(): Promise<Payment[]> {
    await this.ensureFileExists();

    const content = await readFile(this.filePath, "utf8");

    if (!content.trim()) {
      return [];
    }

    const payments: unknown = JSON.parse(content);

    if (!Array.isArray(payments)) {
      throw new Error(
        `Invalid payment store: expected a JSON array in ${this.filePath}`
      );
    }

    return payments as Payment[];
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
