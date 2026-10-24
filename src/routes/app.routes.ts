import type { Express, RequestHandler } from "express";
import paymentRoutes from "./payment.routes";
import { apiKeyAuth } from "../middleware/authentication";

type AppRoute =
  | {
      method: "get";
      path: string;
      handler: RequestHandler;
    }
  | {
      method: "use";
      path: string;
      handler: typeof paymentRoutes;
      middleware?: RequestHandler[];
    };

const appRoutes: AppRoute[] = [
  {
    method: "get",
    path: "/",
    handler: (_req, res) => {
      res.status(200).json({
        message: "Service is running.",
        status: "success",
      });
    },
  },
  {
    method: "get",
    path: "/health",
    handler: (_req, res) => {
      res.status(200).json({
        message: "Service is healthy.",
        status: "success",
      });
    },
  },
  {
    method: "use",
    path: "/api/v1/payments",
    middleware: [apiKeyAuth],
    handler: paymentRoutes,
  },
];

export function registerAppRoutes(app: Express): void {
  for (const route of appRoutes) {
    if (route.method === "get") {
      app.get(route.path, route.handler);
    } else {
      app.use(route.path, ...(route.middleware ?? []), route.handler);
    }
  }
}
