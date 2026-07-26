/* @vitest-environment jsdom */

import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { WashProductPresetPicker } from "../WashProductPresetPicker";

describe("WashProductPresetPicker", () => {
  afterEach(cleanup);

  it("filters common products and returns the selected preset", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    const { rerender } = render(<WashProductPresetPicker onSelect={onSelect} />);

    await user.click(screen.getByText("从常用产品库选择"));
    await user.type(screen.getByRole("searchbox", { name: "搜索产品" }), "Reset");

    const resetButton = screen.getByRole("button", { name: /使用 CARPRO 卡普 Reset/ });
    expect(resetButton).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Green Star/ })).toBeNull();

    await user.click(resetButton);
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ id: "carpro-reset" }));
    rerender(<WashProductPresetPicker selectedPresetId="carpro-reset" onSelect={onSelect} />);
    expect(screen.getByText("已选择：Reset Intensive Car Shampoo")).toBeTruthy();
    expect(screen.getByText("已选择：Reset Intensive Car Shampoo").closest("details")?.open).toBe(false);
  });

  it("supports filtering by brand", async () => {
    const user = userEvent.setup();
    render(<WashProductPresetPicker onSelect={vi.fn()} />);

    await user.click(screen.getByText("从常用产品库选择"));
    await user.selectOptions(screen.getByRole("combobox", { name: "品牌" }), "Fireball 火球");

    expect(screen.getByRole("button", { name: /Fireball 火球 Bug Cleaner/ })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /CARPRO 卡普 Reset/ })).toBeNull();
  });

  it("shows exact Koch-Chemie codes and full product names", async () => {
    const user = userEvent.setup();
    render(<WashProductPresetPicker onSelect={vi.fn()} />);

    await user.click(screen.getByText("从常用产品库选择"));
    await user.type(screen.getByRole("searchbox", { name: "搜索产品" }), "SFF");

    expect(screen.getByText("SFF")).toBeTruthy();
    expect(screen.getByText("Super Foam Fruit Bowl")).toBeTruthy();
    expect(screen.getByRole("button", { name: /Super Foam Fruit Bowl/ })).toBeTruthy();
  });
});
