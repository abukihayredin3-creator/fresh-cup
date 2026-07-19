import { screen } from "@testing-library/react-native";
import { renderWithTheme } from "../test-utils";
import { PriceTag } from "./PriceTag";

describe("PriceTag", () => {
  it("formats ETB minor units for the English locale", async () => {
    await renderWithTheme(<PriceTag amount={4550} locale="en" />);
    expect(screen.getByText("ETB 45.50")).toBeTruthy();
  });

  it("formats ETB minor units for the Amharic locale", async () => {
    await renderWithTheme(<PriceTag amount={12000} locale="am" />);
    expect(screen.getByText("ETB 120.00")).toBeTruthy();
  });

  it("defaults to the English locale when none is given", async () => {
    await renderWithTheme(<PriceTag amount={100} />);
    expect(screen.getByText("ETB 1.00")).toBeTruthy();
  });
});
