import { beforeEach, describe, expect, it, jest } from "@jest/globals";

import { PaymentService } from "../../src/services/payment.service";
import { PaymentEvent } from "../../src/domain/events";

type MockPayment = {
  id: string;
  currency: string;
  description: string;
  status: string;
  orderId?: string;
  amount?: number;
  paymentMethod?: string;
};

type MockPaymentInput = {
  orderId: string;
  amount: number;
  currency: string;
  paymentMethod: string;
  status?: string;
};

const mockCreate =
  jest.fn<(payment: MockPaymentInput) => Promise<MockPayment>>();

const mockFindAll = jest.fn<() => Promise<MockPayment[]>>();

const mockFindById = jest.fn<(id: string) => Promise<MockPayment | null>>();

const mockUpdate =
  jest.fn<(id: string, data: Partial<MockPayment>) => Promise<MockPayment>>();

const mockPublish =
  jest.fn<(event: string, payload: Record<string, unknown>) => Promise<void>>();

jest.mock("../../src/infrastructure/payment.repository", () => ({
  paymentRepository: {
    create: (payment: MockPaymentInput) => mockCreate(payment),
    findAll: () => mockFindAll(),
    findById: (id: string) => mockFindById(id),
    update: (id: string, data: Partial<MockPayment>) => mockUpdate(id, data),
  },
}));

jest.mock("../../src/infrastructure/webhook.client", () => ({
  webhookClient: {
    publish: (event: string, payload: Record<string, unknown>) =>
      mockPublish(event, payload),
  },
}));

describe("PaymentService", () => {
  const service = new PaymentService();

  const payment = {
    id: "payment-123",
    currency: "USD",
    description: "Payment for order order-123",
    status: "pending",
  } as any;

  beforeEach(() => {
    jest.clearAllMocks();

    mockCreate.mockResolvedValue(payment);
    mockPublish.mockResolvedValue(undefined);
  });

  describe("createPayment", () => {
    it("creates a payment with a pending status", async () => {
      const result = await service.createPayment({
        orderId: "order-123",
        amount: 2500,
        currency: "usd",
        paymentMethod: "card",
      } as any);

      expect(mockCreate).toHaveBeenCalledTimes(1);

      const savedPayment = mockCreate.mock.calls[0][0];

      expect(savedPayment).toEqual(
        expect.objectContaining({
          orderId: "order-123",
          amount: 2500,
          currency: "USD",
          status: "pending",
        })
      );

      expect(result).toEqual(payment);
    });

    it("publishes the payment-created event", async () => {
      await service.createPayment({
        orderId: "order-123",
        amount: 2500,
        currency: "USD",
        paymentMethod: "card",
      } as any);

      expect(mockPublish).toHaveBeenCalledWith(
        PaymentEvent.CREATED,
        expect.objectContaining({
          orderId: "order-123",
          status: "pending",
        })
      );
    });
  });
});
