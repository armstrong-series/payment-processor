import { z } from "zod";
import { PaymentEvent } from "./events";

const supportedEventTypes = Object.values(PaymentEvent);

export const paymentWebhookSchema = z
  .object({
    id: z.string().trim().min(1).optional(),
    event_id: z.string().trim().min(1).optional(),
    eventId: z.string().trim().min(1).optional(),

    event_type: z.enum(supportedEventTypes as [string, ...string[]]).optional(),
    eventType: z.enum(supportedEventTypes as [string, ...string[]]).optional(),

    data: z.record(z.string(), z.unknown()),
  })
  .refine((event) => Boolean(event.id ?? event.event_id ?? event.eventId), {
    message: "A stable event ID is required.",
  })
  .refine((event) => Boolean(event.event_type ?? event.eventType), {
    message: "An event type is required.",
  });

export type PaymentWebhookPayload = z.infer<typeof paymentWebhookSchema>;
