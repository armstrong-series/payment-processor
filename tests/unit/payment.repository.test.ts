import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from "@jest/globals";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

describe("PaymentRepository", () => {
  let directory: string;
  let repository: any;
  let originalPaymentsFile: string | undefined;

  const payment = {
    id: "payment-123",
    amount: 2500,
    currency: "USD",
    status: "pending",
    createdAt: "2026-10-25T10:00:00.000Z",
    updatedAt: "2026-10-25T10:00:00.000Z",
  };

  beforeEach(async () => {
    originalPaymentsFile = process.env.PAYMENTS_FILE;

    directory = await mkdtemp(join(tmpdir(), "payment-tests-"));

    process.env.PAYMENTS_FILE = join(directory, "payments.json");

    jest.resetModules();

    const repositoryModule = await import(
      "../../src/infrastructure/payment.repository"
    );

    repository = repositoryModule.paymentRepository;
  });

  afterEach(async () => {
    if (originalPaymentsFile === undefined) {
      delete process.env.PAYMENTS_FILE;
    } else {
      process.env.PAYMENTS_FILE = originalPaymentsFile;
    }

    await rm(directory, { recursive: true, force: true });
    jest.resetModules();
  });

  it("persists a payment and retrieves it", async () => {
    await repository.create(payment);

    await expect(repository.findById(payment.id)).resolves.toEqual(payment);
  });

  it("returns an empty array when no payments exist", async () => {
    await expect(repository.findAll()).resolves.toEqual([]);
  });

  it("returns all stored payments", async () => {
    await repository.create(payment);

    await expect(repository.findAll()).resolves.toEqual([payment]);
  });

  it("returns undefined for a missing payment", async () => {
    await expect(
      repository.findById("missing-payment")
    ).resolves.toBeUndefined();
  });

  it("persists an updated payment", async () => {
    await repository.create(payment);

    const updatedPayment = {
      ...payment,
      status: "succeeded",
      updatedAt: "2026-10-25T11:00:00.000Z",
    };

    await repository.update(payment.id, updatedPayment);

    await expect(repository.findById(payment.id)).resolves.toEqual(
      updatedPayment
    );
  });
});
