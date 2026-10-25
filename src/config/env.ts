import "dotenv/config";

export const env = {
  nodeEnv: process.env.NODE_ENV ?? "development",
  port: Number(process.env.PORT ?? 3000),
  paymentsFile: process.env.PAYMENTS_FILE ?? "data/payments.json",
  processingDelayMs: Number(process.env.PAYMENT_PROCESSING_DELAY_MS ?? 5000),
  webhookUrl: process.env.WEBHOOK_URL ?? "http://convoy:5005",
  webhookProjectId: process.env.WEBHOOK_PROJECT_ID ?? "",
  webhookApiKey: process.env.WEBHOOK_API_KEY ?? "",
  webhookEnabled: process.env.WEBHOOK_ENABLED === "true",
  apiKey: process.env.API_KEY ?? "",
  webhookEndpointId: process.env.WEBHOOK_ENDPOINT_ID ?? "",
};
