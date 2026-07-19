import { Tabs } from "expo-router/js-tabs";
import type { ColorValue } from "react-native";
import { Text } from "react-native";
import { useI18n } from "../../src/i18n/I18nProvider";
import { useTheme } from "../../src/theme/ThemeProvider";
import { brand } from "../../src/theme/tokens";

function TabIcon({
  glyph,
  focused,
  color,
}: {
  glyph: string;
  focused: boolean;
  color: ColorValue;
}) {
  return <Text style={{ fontSize: 20, color, opacity: focused ? 1 : 0.7 }}>{glyph}</Text>;
}

export default function TabsLayout() {
  const { theme } = useTheme();
  const { t } = useI18n();

  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: theme.surface },
        headerTintColor: theme.fg,
        headerShadowVisible: false,
        tabBarStyle: { backgroundColor: theme.surfaceAlt, borderTopColor: theme.border },
        tabBarActiveTintColor: brand.orange600,
        tabBarInactiveTintColor: theme.fgMuted,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t("nav.home"),
          tabBarIcon: ({ focused, color }) => <TabIcon glyph="⌂" focused={focused} color={color} />,
        }}
      />
      <Tabs.Screen
        name="menu"
        options={{
          title: t("nav.menu"),
          tabBarIcon: ({ focused, color }) => (
            <TabIcon glyph="☰" focused={focused} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="orders"
        options={{
          title: t("nav.orders"),
          tabBarIcon: ({ focused, color }) => <TabIcon glyph="▤" focused={focused} color={color} />,
        }}
      />
      <Tabs.Screen
        name="favorites"
        options={{
          title: t("nav.favorites"),
          tabBarIcon: ({ focused, color }) => <TabIcon glyph="♥" focused={focused} color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: t("nav.profile"),
          tabBarIcon: ({ focused, color }) => <TabIcon glyph="☺" focused={focused} color={color} />,
        }}
      />
    </Tabs>
  );
}
