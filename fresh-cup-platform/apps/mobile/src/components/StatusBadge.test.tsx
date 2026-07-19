import { screen } from "@testing-library/react-native";
import { renderWithTheme } from "../test-utils";
import { StatusBadge } from "./StatusBadge";

describe("StatusBadge", () => {
  it("renders the given label for every order status", async () => {
    await renderWithTheme(<StatusBadge status="PREPARING" label="Preparing" />);
    expect(screen.getByText("Preparing")).toBeTruthy();
  });

  it("renders a cancelled order's label", async () => {
    await renderWithTheme(<StatusBadge status="CANCELLED" label="Cancelled" />);
    expect(screen.getByText("Cancelled")).toBeTruthy();
  });
});
