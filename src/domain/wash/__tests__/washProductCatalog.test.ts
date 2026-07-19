import { describe, expect, it } from "vitest";
import { filterWashProductPresets, getWashProductPreset, washProductPresets } from "../washProductCatalog";

describe("washProductCatalog", () => {
  it("keeps preset ids unique and product metadata usable", () => {
    expect(new Set(washProductPresets.map((preset) => preset.id)).size).toBe(washProductPresets.length);
    expect(washProductPresets.length).toBeGreaterThanOrEqual(10);
    expect(washProductPresets.every((preset) => preset.imageUrl.startsWith("https://"))).toBe(true);
    expect(washProductPresets.every((preset) => preset.sourceUrl.startsWith("https://"))).toBe(true);
  });

  it("contains the requested common products", () => {
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
});
