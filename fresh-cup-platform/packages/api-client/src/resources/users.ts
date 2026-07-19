import type { UpdateProfileInput, User } from "@fresh-cup/types";
import type { ApiClient } from "../client";

export class UsersResource {
  constructor(private readonly client: ApiClient) {}

  me(): Promise<User> {
    return this.client.request("/users/me");
  }

  updateMe(input: UpdateProfileInput): Promise<User> {
    return this.client.request("/users/me", { method: "PATCH", body: JSON.stringify(input) });
  }
}
