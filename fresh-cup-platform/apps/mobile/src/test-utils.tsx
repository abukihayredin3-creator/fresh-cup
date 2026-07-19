import { render, type RenderOptions } from "@testing-library/react-native";
import type { ReactElement } from "react";
import { ThemeProvider } from "./theme/ThemeProvider";

/**
 * Wraps components under test with the same ThemeProvider the app renders inside.
 * `render()` is async in this version of RTL — always `await` this helper's result.
 */
export function renderWithTheme(ui: ReactElement, options?: RenderOptions) {
  return render(ui, { wrapper: ThemeProvider, ...options });
}
