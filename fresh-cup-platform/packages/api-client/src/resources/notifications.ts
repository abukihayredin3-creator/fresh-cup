import type { RegisterPushTokenInput } from "@fresh-cup/types";
import type { ApiClient } from "../client";

export class NotificationsResource {
  constructor(private readonly client: ApiClient) {}

  registerPushToken(input: RegisterPushTokenInput): Promise<void> {
    return this.client.request("/notifications/push-tokens", {
      method: "POST",
      body: JSON.stringify(input),
    });
  }

  unregisterPushToken(id: string): Promise<void> {
    return this.client.request(`/notifications/push-tokens/${id}`, { method: "DELETE" });
  }
}
