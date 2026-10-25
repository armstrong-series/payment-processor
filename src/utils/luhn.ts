export function normalizeCardNumber(value: string): string {
  return value.replace(/[\s-]/g, "");
}

export function passesLuhn(value: string): boolean {
  const number = normalizeCardNumber(value);

  if (!/^\d{12,19}$/.test(number)) {
    return false;
  }

  let sum = 0;
  let doubleDigit = false;

  for (let i = number.length - 1; i >= 0; i--) {
    let digit = Number(number[i]);

    if (doubleDigit) {
      digit *= 2;

      if (digit > 9) {
        digit -= 9;
      }
    }

    sum += digit;
    doubleDigit = !doubleDigit;
  }

  return sum % 10 === 0;
}
