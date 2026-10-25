import { Router } from "express";
import { receivePaymentWebhook } from "../controllers/payment-webhook.controller";

const router = Router();

router.post("/webhooks", receivePaymentWebhook);

export default router;
