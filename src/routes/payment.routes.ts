import { Router } from "express";
import { paymentController } from "../controllers/payment.controller";

const router = Router();

router.post("/", (req, res, next) => paymentController.create(req, res, next));

router.get("/", (req, res, next) => paymentController.list(req, res, next));

router.get("/:id", (req, res, next) =>
  paymentController.getById(req, res, next)
);

router.patch("/:id/status", (req, res, next) =>
  paymentController.updateStatus(req, res, next)
);

export default router;
