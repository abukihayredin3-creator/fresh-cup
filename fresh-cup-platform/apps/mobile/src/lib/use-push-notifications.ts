import * as Notifications from "expo-notifications";
import { useRouter } from "expo-router";
import { useEffect } from "react";
import { useAuth } from "./auth-context";
import { registerForPushNotificationsAsync } from "./push-notifications";

/**
 * Registers the device's Expo push token once a user is signed in, and routes to the relevant
 * order when the user taps a delivered notification (order lifecycle pushes always carry
 * `data.orderId` — see apps/api's NotificationsService).
 */
export function usePushNotifications(): void {
  const { user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!user) return;
    void registerForPushNotificationsAsync();
  }, [user]);

  useEffect(() => {
    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      const orderId = response.notification.request.content.data?.orderId;
      if (typeof orderId === "string" && orderId) {
        router.push(`/orders/${orderId}`);
      }
    });
    return () => subscription.remove();
  }, [router]);
}
