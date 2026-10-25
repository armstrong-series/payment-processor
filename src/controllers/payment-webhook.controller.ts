import type { Request, Response } from "express";

export function receivePaymentWebhook(req: Request, res: Response): void {
  const event = req.body;

  console.info("Convoy webhook received", {
    eventType: event?.event_type ?? event?.eventType,
    eventId: event?.id,
    paymentId: event?.data?.id,
  });

  res.status(200).json({
    message: "Webhook received successfully.",
    status: "success",
    data: [],
  });
}
