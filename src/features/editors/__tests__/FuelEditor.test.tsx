/* @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useWorkspace } from "../../../app/workspace";
import { normalizeStore, type FuelRecord, type Vehicle } from "../../../shared/carData";
import { FuelEditor } from "../FuelEditor";

vi.mock("../../../app/workspace", () => ({ useWorkspace: vi.fn() }));

const vehicle: Vehicle = { id: "v1", userId: "u1", nickname: "Car", brand: "", model: "", year: "", plate: "", energyType: "汽油", tankSize: 50 };
const first: FuelRecord = { id: "f1", userId: "u1", vehicleId: "v1", date: "2026-11-01", odometer: 1000, fuelLevelAfter: 80, volume: 30, pricePerUnit: 8, totalCost: 240, station: "S", fullTank: false };
const second: FuelRecord = { ...first, id: "f2", date: "2026-11-10", odometer: 1500, fuelLevelBefore: 20, fuelLevelAfter: 80 };

function setup(records = [second, first], recordId?: string) {
  const mutate = vi.fn<ReturnType<typeof useWorkspace>["mutate"]>(() => true);
  const close = vi.fn();
  vi.mocked(useWorkspace).mockReturnValue({ vehicle, fuelRecords: records, allFuelRecords: records, washRecords: [], expenseRecords: [], mutate, remove: vi.fn() } as unknown as ReturnType<typeof useWorkspace>);
  render(<FuelEditor recordId={recordId} onClose={close} />);
  change("日期", "2026-11-23");
  return { user: userEvent.setup(), mutate, close };
}

function input(label: string) {
  return screen.getByLabelText(label, { exact: true }) as HTMLInputElement;
}

function change(label: string, value: string) {
  fireEvent.change(input(label), { target: { value } });
}

afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe("FuelEditor", () => {
  it("places mileage after levels and updates the estimate without overwriting a manual reading", () => {
    setup();
    change("加油前油表", "50");
    expect(input("当前里程").placeholder).toBe("1750");
    expect(input("加油前油表").compareDocumentPosition(input("当前里程")) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    change("当前里程", "1800.5");
    change("加油前油表", "20");
    expect(input("当前里程").placeholder).toBe("2000");
    expect(input("当前里程").value).toBe("1800.5");
    expect(screen.getByText(/近期油耗 6 L\/100km/)).toBeTruthy();
    change("日期", "2026-11-05");
    expect(screen.queryByText(/按加注前油位/)).toBeNull();
  });

  it("shows the fuel estimate while editing without using that entry's mileage to calculate it", () => {
    setup([{ ...second, id: "edit", date: "2026-11-23", odometer: 2200 }, second, first], "edit");
    change("加油前油表", "50");
    expect(input("当前里程").placeholder).toBe("1750");
    expect(input("当前里程").value).toBe("2200");
  });

  it("synchronizes full-tank toggles with both typed and preset levels", async () => {
    const { user } = setup();
    change("加油后油表", "80");
    const toggle = screen.getByRole("switch", { name: /^加满/ }) as HTMLInputElement;
    await user.click(toggle);
    expect(input("加油后油表").value).toBe("100");
    change("加油后油表", "75");
    expect(toggle.checked).toBe(false);
    const afterPresets = screen.getAllByRole("group", { name: "常用刻度" })[1];
    await user.click(within(afterPresets).getByRole("button", { name: "满" }));
    expect(toggle.checked).toBe(true);
    await user.click(toggle);
    expect(input("加油后油表").value).toBe("");
    change("加油后油表", "100");
    change("加油后油表", "");
    expect(toggle.checked).toBe(false);
  });

  it("retains 100% when levels are expanded after checking full tank", async () => {
    const { user } = setup([]);
    await user.click(screen.getByRole("switch", { name: /^加满/ }));
    await user.click(screen.getByRole("button", { name: /记录油表刻度/ }));
    expect(input("加油后油表").value).toBe("100");
  });

  it.each([
    ["实付金额", "加油量", "挂牌单价"],
    ["加油量", "挂牌单价", "实付金额"],
    ["挂牌单价", "实付金额", "加油量"],
  ])("preserves independently entered discounted values in order %j", async (...order) => {
    const { user, mutate } = setup();
    const values: Record<string, string> = { 实付金额: "300", 加油量: "40", 挂牌单价: "8.5" };
    for (const label of order) change(label, values[label]);
    expect(input("实付金额").value).toBe("300");
    expect(input("加油量").value).toBe("40");
    expect(input("挂牌单价").value).toBe("8.5");
    expect(input("优惠金额").value).toBe("40");
    expect(screen.getByText(/实付单价.*7.50/)).toBeTruthy();
    await user.click(screen.getByRole("button", { name: /^保存\s*⌘/ }));
    const store = normalizeStore({ users: [{ id: "u1", name: "User", email: "user@example.com" }] });
    const mutation = mutate.mock.calls[0][0];
    expect(mutation(store, store.users[0])?.fuelRecords[0]).toMatchObject({ volume: 40, pricePerUnit: 8.5, paidAmount: 300, totalCost: 340, discountAmount: 40 });
  });

  it("accepts a discount before volume and only recalculates the payment", () => {
    setup();
    change("优惠金额", "40");
    change("加油量", "40");
    change("挂牌单价", "8.5");
    expect(input("实付金额").value).toBe("300");
    change("加油量", "50");
    expect(input("实付金额").value).toBe("385");
    expect(input("优惠金额").value).toBe("40");
    change("实付金额", "350");
    expect(input("优惠金额").value).toBe("75");
    change("挂牌单价", "9");
    expect(input("实付金额").value).toBe("350");
    expect(input("加油量").value).toBe("50");
    expect(input("优惠金额").value).toBe("100");
  });

  it("preserves a discounted historical record when editing the posted price", () => {
    setup([{ ...second, paidAmount: 210 }], "f2");
    change("挂牌单价", "9");
    expect(input("实付金额").value).toBe("210");
    expect(input("加油量").value).toBe("30");
    expect(input("优惠金额").value).toBe("60");
  });

  it("uses the posted total when no payment is entered and resets discount mode for the next entry", async () => {
    const { user, mutate } = setup();
    change("加油量", "40");
    change("挂牌单价", "8");
    expect(input("实付金额").placeholder).toBe("320");
    expect(screen.getByText(/实付单价.*8.00/)).toBeTruthy();
    change("优惠金额", "20");
    await user.click(screen.getByRole("button", { name: "保存并再记一笔" }));
    expect(mutate).toHaveBeenCalledOnce();
    expect(input("优惠金额").value).toBe("");
    expect(input("实付金额").value).toBe("");
    change("加油量", "20");
    expect(input("实付金额").placeholder).toBe("160");
  });

  it("rejects discounts above the posted total and allows a fully discounted payment", async () => {
    const { user, mutate } = setup();
    change("加油量", "40");
    change("挂牌单价", "8");
    change("优惠金额", "321");
    await user.click(screen.getByRole("button", { name: /^保存\s*⌘/ }));
    expect(screen.getByText("优惠不能超过挂牌总价")).toBeTruthy();
    expect(mutate).not.toHaveBeenCalled();
    change("优惠金额", "320");
    expect(input("实付金额").value).toBe("0");
    await user.click(screen.getByRole("button", { name: /^保存\s*⌘/ }));
    expect(mutate).toHaveBeenCalledOnce();
  });
});
