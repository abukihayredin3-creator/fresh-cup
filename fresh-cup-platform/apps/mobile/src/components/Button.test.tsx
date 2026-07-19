import { fireEvent, screen } from "@testing-library/react-native";
import { renderWithTheme } from "../test-utils";
import { Button } from "./Button";

describe("Button", () => {
  it("renders its label and calls onPress when tapped", async () => {
    const onPress = jest.fn();
    await renderWithTheme(<Button onPress={onPress}>Place order</Button>);
    await fireEvent.press(screen.getByRole("button", { name: "Place order" }));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("does not call onPress while disabled", async () => {
    const onPress = jest.fn();
    await renderWithTheme(
      <Button onPress={onPress} disabled>
        Place order
      </Button>,
    );
    await fireEvent.press(screen.getByRole("button", { name: "Place order" }));
    expect(onPress).not.toHaveBeenCalled();
  });

  it("does not call onPress while loading", async () => {
    const onPress = jest.fn();
    await renderWithTheme(
      <Button onPress={onPress} loading>
        Place order
      </Button>,
    );
    await fireEvent.press(screen.getByRole("button", { name: "Place order" }));
    expect(onPress).not.toHaveBeenCalled();
  });

  it("marks itself busy for assistive tech while loading", async () => {
    await renderWithTheme(<Button loading>Place order</Button>);
    expect(screen.getByRole("button", { name: "Place order" })).toBeBusy();
  });
});
