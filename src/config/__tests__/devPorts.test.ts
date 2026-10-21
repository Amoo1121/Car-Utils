import { describe, expect, it } from "vitest";
import { resolveDevPorts } from "../devPorts";

describe("resolveDevPorts", () => {
  it("proxies the API to the native app service by default", () => {
    expect(resolveDevPorts({})).toEqual({ webPort: 5173, apiPort: 4173 });
    expect(resolveDevPorts({ CAR_UTILS_APP_PORT: "4180" })).toEqual({ webPort: 5173, apiPort: 4180 });
  });

  it("reads configurable frontend and backend ports", () => {
    expect(
      resolveDevPorts({
        CAR_UTILS_WEB_PORT: "5180",
        CAR_UTILS_API_PORT: "3101",
      }),
    ).toEqual({ webPort: 5180, apiPort: 3101 });
  });

  it.each(["0", "65536", "3001.5", "not-a-port"])("rejects invalid port %s", (value) => {
    expect(() => resolveDevPorts({ CAR_UTILS_WEB_PORT: value })).toThrow(/CAR_UTILS_WEB_PORT/);
  });
});
