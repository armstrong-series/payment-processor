import { createHmac, timingSafeEqual } from "node:crypto";

export function verifyWebhookSignature(
  rawBody: Buffer,
  signature: string | undefined,
  secret: string
): boolean {
  if (!signature || !secret || rawBody.length === 0) {
    return false;
  }

  const supplied = signature.startsWith("sha256=")
    ? signature.slice("sha256=".length)
    : signature;

  if (!/^[a-f0-9]{64}$/i.test(supplied)) {
    return false;
  }

  const expected = createHmac("sha256", secret).update(rawBody).digest();

  const received = Buffer.from(supplied, "hex");

  return (
    received.length === expected.length && timingSafeEqual(received, expected)
  );
}
