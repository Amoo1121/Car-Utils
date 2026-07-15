/* @vitest-environment jsdom */

import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AppNavigation, type AppNavigationProps } from "../AppNavigation";

describe("AppNavigation", () => {
  afterEach(cleanup);

  it("marks the active workspace and changes tabs through the shared navigation", async () => {
    const user = userEvent.setup();
    const props = createProps();
    render(<AppNavigation {...props} />);

    expect(screen.getByRole("button", { name: "概览" }).getAttribute("aria-current")).toBe("page");
    expect(screen.getByText("Dylan")).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "加油" }));

    expect(props.onChange).toHaveBeenCalledWith("fuel");
    expect(props.onCloseMobile).toHaveBeenCalledOnce();
  });

  it("exposes mobile open and close controls without changing desktop behavior", async () => {
    const user = userEvent.setup();
    const props = createProps({ mobileOpen: true });
    render(<AppNavigation {...props} />);

    await user.click(screen.getByRole("button", { name: "打开导航" }));
    expect(props.onOpenMobile).toHaveBeenCalledOnce();

    await user.click(screen.getAllByRole("button", { name: "关闭导航" })[0]);
    expect(props.onCloseMobile).toHaveBeenCalledOnce();
  });
});

function createProps(overrides: Partial<AppNavigationProps> = {}): AppNavigationProps {
  return {
    activeTab: "overview",
    collapsed: false,
    mobileOpen: false,
    userName: "Dylan",
    onChange: vi.fn(),
    onCloseMobile: vi.fn(),
    onLogout: vi.fn(),
    onOpenMobile: vi.fn(),
    onToggleCollapsed: vi.fn(),
    ...overrides,
  };
}
