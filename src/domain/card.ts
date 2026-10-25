export type TestCardBrand = "visa" | "mastercard" | "amex" | "verve";

export type TestCardOutcome = "succeeded" | "failed";

export interface SeededTestCard {
  id: string;
  brand: TestCardBrand;
  number: string;
  last4: string;
  expiryMonth: number;
  expiryYear: number;
  outcome: TestCardOutcome;
  enabled: boolean;
}

export type PublicTestCard = Omit<SeededTestCard, "number">;
