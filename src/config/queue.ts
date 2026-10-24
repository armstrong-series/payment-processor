import { Queue } from "bullmq";
import IORedis from "ioredis";

export const redisConnection = new IORedis(
  process.env.REDIS_URL ?? "redis://redis:6379/0",
  {
    maxRetriesPerRequest: null,
  }
);

export const PAYMENT_QUEUE = "payment-processing";

export const paymentQueue = new Queue(PAYMENT_QUEUE, {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 5,
    backoff: {
      type: "exponential",
      delay: 1000,
    },

    removeOnComplete: false,
    removeOnFail: false,
  },
});
