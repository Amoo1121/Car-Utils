import { describe, expect, it } from "vitest";
import { filterWashProductPresets, getWashProductPreset, washProductPresets } from "../washProductCatalog";

const supportedCategories = new Set([
  "预洗液",
  "正洗液",
  "洗车液",
  "多用途清洁",
  "虫胶清洁",
  "铁粉去除",
  "轮毂清洁",
  "轮胎养护",
  "玻璃清洁",
  "内饰清洁",
  "蜡/封体",
  "毛巾/工具",
  "其他",
]);

describe("washProductCatalog", () => {
  it("keeps preset ids unique and product metadata usable", () => {
    expect(new Set(washProductPresets.map((preset) => preset.id)).size).toBe(washProductPresets.length);
    expect(washProductPresets.length).toBeGreaterThanOrEqual(10);
    expect(washProductPresets.every((preset) => preset.imageUrl.startsWith("https://"))).toBe(true);
    expect(washProductPresets.every((preset) => preset.sourceUrl.startsWith("https://"))).toBe(true);
    expect(washProductPresets.every((preset) => preset.shortCode)).toBe(true);
    expect(washProductPresets.every((preset) => supportedCategories.has(preset.category))).toBe(true);
  });

  it("contains the requested common products", () => {
    expect(getWashProductPreset("koch-super-foam-fruit-bowl")?.shortCode).toBe("SFF");
    expect(getWashProductPreset("koch-green-star")?.shortCode).toBe("GS");
    expect(getWashProductPreset("koch-reactive-rust-remover")?.shortCode).toBe("RRR");
    expect(getWashProductPreset("koch-pol-star")?.shortCode).toBe("PO");
    expect(getWashProductPreset("carpro-reset")?.name).toContain("Reset");
    expect(getWashProductPreset("fireball-bug-cleaner")?.brand).toContain("火球");
    expect(getWashProductPreset("adams-wheel-tire-cleaner")?.name).toContain("WTC");
  });

  it("searches Chinese aliases, model names, and brands", () => {
    expect(filterWashProductPresets("绿星").map((preset) => preset.id)).toEqual(["koch-green-star"]);
    expect(filterWashProductPresets("Reset").map((preset) => preset.id)).toEqual(["carpro-reset"]);
    expect(filterWashProductPresets("虫清", "Fireball 火球").map((preset) => preset.id)).toEqual([
      "fireball-bug-cleaner",
    ]);
  });

  it("ranks exact product codes ahead of partial matches", () => {
    expect(filterWashProductPresets("GS")[0]?.id).toBe("koch-green-star");
    expect(filterWashProductPresets("SFF")[0]?.id).toBe("koch-super-foam-fruit-bowl");
    expect(filterWashProductPresets("SFN")[0]?.id).toBe("koch-super-foam-nta-free");
  });
});
