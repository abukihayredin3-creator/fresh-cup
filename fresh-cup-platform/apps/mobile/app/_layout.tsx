import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider } from "../src/lib/auth-context";
import { BranchProvider } from "../src/lib/branch-context";
import { CartProvider } from "../src/lib/cart-context";
import { FavoritesProvider } from "../src/lib/favorites-context";
import { QueryProvider } from "../src/lib/query-provider";
import { DineInTableProvider } from "../src/lib/table-context";
import { usePushNotifications } from "../src/lib/use-push-notifications";
import { I18nProvider } from "../src/i18n/I18nProvider";
import { ThemeProvider, useTheme } from "../src/theme/ThemeProvider";

function Navigation() {
  const { theme, isDark } = useTheme();
  usePushNotifications();

  return (
    <>
      <StatusBar style={isDark ? "light" : "dark"} />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: theme.surface },
          headerTintColor: theme.fg,
          headerShadowVisible: false,
          contentStyle: { backgroundColor: theme.surface },
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="login" options={{ title: "Log in", presentation: "modal" }} />
        <Stack.Screen name="cart" options={{ title: "Cart" }} />
        <Stack.Screen name="checkout" options={{ title: "Checkout" }} />
        <Stack.Screen name="menu/[itemId]" options={{ title: "" }} />
        <Stack.Screen name="orders/[orderId]" options={{ title: "Order" }} />
        <Stack.Screen name="profile/addresses" options={{ title: "Address book" }} />
        <Stack.Screen name="table/[qrToken]" options={{ title: "", headerShown: false }} />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <I18nProvider>
            <QueryProvider>
              <AuthProvider>
                <BranchProvider>
                  <DineInTableProvider>
                    <CartProvider>
                      <FavoritesProvider>
                        <Navigation />
                      </FavoritesProvider>
                    </CartProvider>
                  </DineInTableProvider>
                </BranchProvider>
              </AuthProvider>
            </QueryProvider>
          </I18nProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
