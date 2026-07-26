/* @vitest-environment jsdom */

import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { WashProductMetadataLookup } from "../WashProductMetadataLookup";

describe("WashProductMetadataLookup", () => {
  afterEach(cleanup);

  it("shows reviewable candidates and applies only the selected result", async () => {
    const user = userEvent.setup();
    const onApply = vi.fn();
    const lookup = vi.fn(async () => [
      {
        title: "KLCB A14",
        description: "Glass polishing compound.",
        imageUrl: "https://example.com/a14.jpg",
        sourceUrl: "https://example.com/a14",
        category: "玻璃去油膜",
        capacity: 150,
        capacityUnit: "ml" as const,
      },
    ]);

    render(<WashProductMetadataLookup query="KLCB A14" onApply={onApply} lookup={lookup} />);

    await user.click(screen.getByRole("button", { name: "联网查找" }));
    expect(await screen.findByText("Glass polishing compound.")).toBeTruthy();
    expect(screen.getByText(/玻璃去油膜 · 150 ml/)).toBeTruthy();
    expect(onApply).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "应用资料" }));
    expect(onApply).toHaveBeenCalledWith(expect.objectContaining({ title: "KLCB A14" }));
    expect(screen.getByRole("button", { name: "已应用" })).toBeTruthy();
  });
});
