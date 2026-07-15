/* @vitest-environment jsdom */

import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { Autocomplete, type AutocompleteOption } from "../Autocomplete";

const options: AutocompleteOption[] = [
  { value: "中国石化人民路站", label: "中国石化人民路站", description: "本车 3 次" },
  { value: "中国石油城北站", label: "中国石油城北站", description: "其他车辆 2 次" },
];

describe("Autocomplete", () => {
  afterEach(cleanup);

  it("shows suggestions on focus and supports keyboard selection", async () => {
    const user = userEvent.setup();
    render(<AutocompleteHarness />);
    const input = screen.getByRole("combobox", { name: "加油站" });

    await user.click(input);
    expect(screen.getAllByRole("option")).toHaveLength(2);

    await user.keyboard("{ArrowDown}{Enter}");
    expect((input as HTMLInputElement).value).toBe("中国石油城北站");
    expect(screen.queryByRole("listbox")).toBeNull();
  });

  it("keeps free text so a new station can be entered", async () => {
    const user = userEvent.setup();
    render(<AutocompleteHarness />);
    const input = screen.getByRole("combobox", { name: "加油站" });

    await user.type(input, "新加油站");

    expect((input as HTMLInputElement).value).toBe("新加油站");
  });
});

function AutocompleteHarness() {
  const [value, setValue] = useState("");
  return <Autocomplete label="加油站" onChange={setValue} options={options} value={value} />;
}
