import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useColorScheme } from "react-native";
import { darkTheme, lightTheme, type SemanticTheme } from "./tokens";

export type ThemePreference = "light" | "dark" | "system";

interface ThemeContextValue {
  preference: ThemePreference;
  isDark: boolean;
  theme: SemanticTheme;
  setPreference: (preference: ThemePreference) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);
const STORAGE_KEY = "fresh-cup-theme";

export function ThemeProvider({ children }: { children: ReactNode }) {
  const systemScheme = useColorScheme();
  const [preference, setPreferenceState] = useState<ThemePreference>("system");

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((stored) => {
        if (stored === "light" || stored === "dark" || stored === "system") {
          setPreferenceState(stored);
        }
      })
      .catch(() => {});
  }, []);

  const setPreference = useCallback((next: ThemePreference) => {
    setPreferenceState(next);
    void AsyncStorage.setItem(STORAGE_KEY, next);
  }, []);

  const isDark = preference === "system" ? systemScheme === "dark" : preference === "dark";
  const theme = isDark ? darkTheme : lightTheme;

  const value = useMemo(
    () => ({ preference, isDark, theme, setPreference }),
    [preference, isDark, theme, setPreference],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}
