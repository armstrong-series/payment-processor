import app from "./app";
import { env } from "./config/env";

const server = app.listen(env.port, "0.0.0.0", () => {
  console.info(`Payment API listening on port ${env.port}`);
});

function shutdown(signal: string) {
  console.info(`${signal} received. Shutting down...`);

  server.close((error) => {
    if (error) {
      console.error("Error during shutdown:", error);
      process.exitCode = 1;
    }
  });
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));