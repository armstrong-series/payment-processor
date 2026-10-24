import express from "express";
import { registerAppRoutes } from "./routes/app.routes";
import { errorHandler } from "./middleware/error-handler";

const app = express();

app.disable("x-powered-by");
app.use(express.json({ limit: "1mb" }));

registerAppRoutes(app);

app.use((_req, res) => {
  res.status(404).json({
    message: "Route not found.",
    status: "error",
    error: { code: "ROUTE_NOT_FOUND" },
  });
});

app.use(errorHandler);

export default app;
