/* @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { GaugeField } from "../fields";

function Harness({ initial = "" }: { initial?: string }) {
  const [value, setValue] = useState(initial);
  return (
    <>
      <GaugeField label="加油前油表" value={value} onChange={setValue} />
      <p data-testid="value">{value === "" ? "empty" : value}</p>
    </>
  );
}

afterEach(cleanup);

describe("GaugeField", () => {
  it("accepts a typed level", async () => {
    render(<Harness />);
    await userEvent.type(screen.getByLabelText("加油前油表"), "37");
    expect(screen.getByTestId("value").textContent).toBe("37");
    expect((screen.getByLabelText("拖动调整刻度") as HTMLInputElement).value).toBe("37");
  });

  it("sets common marks with one tap", async () => {
    render(<Harness />);
    await userEvent.click(screen.getByRole("button", { name: "¼" }));
    expect(screen.getByTestId("value").textContent).toBe("25");
    expect(screen.getByRole("button", { name: "¼" }).getAttribute("aria-pressed")).toBe("true");
    await userEvent.click(screen.getByRole("button", { name: "满" }));
    expect(screen.getByTestId("value").textContent).toBe("100");
  });

  it("clamps out-of-range input on blur and can be cleared", async () => {
    render(<Harness />);
    const input = screen.getByLabelText("加油前油表");
    await userEvent.type(input, "140");
    fireEvent.blur(input);
    expect(screen.getByTestId("value").textContent).toBe("100");
    await userEvent.click(screen.getByRole("button", { name: "清除刻度" }));
    expect(screen.getByTestId("value").textContent).toBe("empty");
  });

  it("still supports dragging", () => {
    render(<Harness initial="10" />);
    fireEvent.change(screen.getByLabelText("拖动调整刻度"), { target: { value: "62" } });
    expect(screen.getByTestId("value").textContent).toBe("62");
  });
});
