export const SUPPORTED_CURRENCIES = [
  "USD",
  "EUR",
  "GBP",
  "GHS",
  "NGN",
  "CAD",
] as const;

export type Currency = (typeof SUPPORTED_CURRENCIES)[number];

export function isSupportedCurrency(currency: string): currency is Currency {
  return SUPPORTED_CURRENCIES.includes(currency as Currency);
}
