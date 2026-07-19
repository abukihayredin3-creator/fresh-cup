import type { PushPlatform } from "./enums";

export interface RegisterPushTokenInput {
  /** FCM/APNs device token. */
  token: string;
  platform: PushPlatform;
}
