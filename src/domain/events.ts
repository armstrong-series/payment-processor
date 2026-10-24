export enum PaymentEvent {
  CREATED = "payment.created",
  PROCESSING = "payment.processing",
  SUCCEEDED = "payment.succeeded",
  FAILED = "payment.failed",
  STATUS_UPDATED = "payment.status_updated",

  PROCESS_REQUESTED = "payment.process_requested",
}
