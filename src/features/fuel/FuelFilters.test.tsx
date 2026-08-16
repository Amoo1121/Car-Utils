/* @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { useMemo, useState } from "react";
import { FuelFilters } from "../../App";
import { matchesFuelDateFilter, type FuelDateFilter, type FuelRecord } from "../../shared/carData";

const dates = ["2026-01-10", "2026-03-12", "2026-08-01"];

function Harness() {
  const [dateFilter, setDateFilter] = useState<FuelDateFilter>("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [query, setQuery] = useState("");
  const visibleCount = useMemo(
    () => dates.filter((date) => matchesFuelDateFilter({ date } as FuelRecord, dateFilter, startDate, endDate)).length,
    [dateFilter, endDate, startDate],
  );

  return (
    <FuelFilters
      dateFilter={dateFilter}
      endDate={endDate}
      onDateFilterChange={setDateFilter}
      onEndDateChange={setEndDate}
      onQueryChange={setQuery}
      onStartDateChange={setStartDate}
      query={query}
      startDate={startDate}
      totalCount={dates.length}
      visibleCount={visibleCount}
    />
  );
}

describe("FuelFilters", () => {
  afterEach(cleanup);

  it("filters records through an inclusive custom date range", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(screen.getByRole("button", { name: "自定义" }));
    fireEvent.change(screen.getByLabelText("开始日期"), { target: { value: "2026-03-01" } });
    fireEvent.change(screen.getByLabelText("结束日期"), { target: { value: "2026-03-31" } });

    expect(screen.getByText("显示 1 / 3 条记录")).toBeTruthy();
  });

  it("clears custom dates together with the active filter", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(screen.getByRole("button", { name: "自定义" }));
    fireEvent.change(screen.getByLabelText("开始日期"), { target: { value: "2026-03-01" } });
    await user.click(screen.getByRole("button", { name: "清除筛选" }));

    expect(screen.queryByLabelText("开始日期")).toBeNull();
    expect(screen.getByText("显示 3 / 3 条记录")).toBeTruthy();
  });
});
