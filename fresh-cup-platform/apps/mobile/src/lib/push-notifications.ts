import type { PushPlatform } from "@fresh-cup/types";
import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { api } from "./api-client";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

function currentPushPlatform(): PushPlatform | null {
  if (Platform.OS === "ios") return "IOS";
  if (Platform.OS === "android") return "ANDROID";
  // Web push requires a VAPID-keyed service-worker flow, distinct from Expo's native push
  // service — out of scope here since the PWA (apps/web) already has its own notification path.
  return null;
}

/**
 * Requests permission, obtains an Expo push token, and registers it with the backend
 * (POST /notifications/push-tokens). Returns null (no-op) on simulators/web/without an
 * EAS project id, since Expo's push service can't issue a token in those cases.
 */
export async function registerForPushNotificationsAsync(): Promise<string | null> {
  const platform = currentPushPlatform();
  if (!platform || !Device.isDevice) {
    return null;
  }

  const projectId = Constants.expoConfig?.extra?.eas?.projectId as string | undefined;
  if (!projectId) {
    return null;
  }

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "default",
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }

  const existing = await Notifications.getPermissionsAsync();
  let status = existing.status;
  if (status !== "granted") {
    const requested = await Notifications.requestPermissionsAsync();
    status = requested.status;
  }
  if (status !== "granted") {
    return null;
  }

  try {
    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
    await api.notifications.registerPushToken({ token, platform });
    return token;
  } catch {
    return null;
  }
}
