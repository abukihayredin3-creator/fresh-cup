import { screen } from "@testing-library/react-native";
import { Text } from "react-native";
import { renderWithTheme } from "../test-utils";
import { EmptyState } from "./EmptyState";

describe("EmptyState", () => {
  it("renders the title", async () => {
    await renderWithTheme(<EmptyState title="No orders yet" />);
    expect(screen.getByText("No orders yet")).toBeTruthy();
  });

  it("renders the description when given", async () => {
    await renderWithTheme(
      <EmptyState title="No orders yet" description="Place your first order" />,
    );
    expect(screen.getByText("Place your first order")).toBeTruthy();
  });

  it("omits the description when none is given", async () => {
    await renderWithTheme(<EmptyState title="No orders yet" />);
    expect(screen.queryByText("Place your first order")).toBeNull();
  });

  it("renders the action when given", async () => {
    await renderWithTheme(<EmptyState title="No orders yet" action={<Text>Browse menu</Text>} />);
    expect(screen.getByText("Browse menu")).toBeTruthy();
  });
});
