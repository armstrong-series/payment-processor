export type PaymentStatus = "pending" | "processing" | "succeeded" | "failed";

export interface Payment {
  id: string;
  amount: number;
  currency: string;
  description?: string;
  status: PaymentStatus;
  createdAt: string;
  updatedAt: string;
}

export interface CreatePaymentInput {
  amount: number;
  currency: string;
  description?: string;
}

export interface PaymentRow {
  id: string;
  amount: number;
  currency: string;
  description: string | null;
  status: PaymentStatus;
  created_at: string;
  updated_at: string;
}
