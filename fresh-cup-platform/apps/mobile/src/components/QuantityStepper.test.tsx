import { fireEvent, screen } from "@testing-library/react-native";
import { renderWithTheme } from "../test-utils";
import { QuantityStepper } from "./QuantityStepper";

describe("QuantityStepper", () => {
  it("calls onChange with value + 1 when the increase button is pressed", async () => {
    const onChange = jest.fn();
    await renderWithTheme(<QuantityStepper value={2} onChange={onChange} label="Quantity" />);
    await fireEvent.press(screen.getByLabelText("Increase quantity"));
    expect(onChange).toHaveBeenCalledWith(3);
  });

  it("calls onChange with value - 1 when the decrease button is pressed", async () => {
    const onChange = jest.fn();
    await renderWithTheme(<QuantityStepper value={2} onChange={onChange} label="Quantity" />);
    await fireEvent.press(screen.getByLabelText("Decrease quantity"));
    expect(onChange).toHaveBeenCalledWith(1);
  });

  it("does not go below min", async () => {
    const onChange = jest.fn();
    await renderWithTheme(
      <QuantityStepper value={1} onChange={onChange} min={1} label="Quantity" />,
    );
    await fireEvent.press(screen.getByLabelText("Decrease quantity"));
    expect(onChange).not.toHaveBeenCalled();
  });

  it("does not go above max", async () => {
    const onChange = jest.fn();
    await renderWithTheme(
      <QuantityStepper value={5} onChange={onChange} max={5} label="Quantity" />,
    );
    await fireEvent.press(screen.getByLabelText("Increase quantity"));
    expect(onChange).not.toHaveBeenCalled();
  });

  it("ignores presses while disabled", async () => {
    const onChange = jest.fn();
    await renderWithTheme(
      <QuantityStepper value={2} onChange={onChange} disabled label="Quantity" />,
    );
    await fireEvent.press(screen.getByLabelText("Increase quantity"));
    await fireEvent.press(screen.getByLabelText("Decrease quantity"));
    expect(onChange).not.toHaveBeenCalled();
  });
});
