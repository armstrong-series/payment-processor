import { env } from "../config/env";

class WebhookClient {
  async publish<T extends object>(eventType: string, data: T): Promise<void> {
    if (!env.webhookEnabled) {
      console.info(`[Webhook disabled] ${eventType}`);
      return;
    }

    if (!env.webhookProjectId || !env.webhookApiKey) {
      console.error("Webhook is enabled but project credentials are missing.");
      return;
    }

    const url =
      `${env.webhookUrl.replace(/\/$/, "")}` +
      `/api/v1/projects/${env.webhookProjectId}/events`;

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.webhookApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          event_type: eventType,
          data,
        }),
        signal: AbortSignal.timeout(5000),
      });

      if (!response.ok) {
        const responseBody = await response.text();

        console.error("Convoy event publishing failed", {
          eventType,
          status: response.status,
          responseBody,
        });
      }
    } catch (error) {
      console.error("Unable to reach Convoy", {
        eventType,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}

export const webhookClient = new WebhookClient();
