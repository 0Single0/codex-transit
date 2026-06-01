import { describe, expect, it, vi } from "vitest";
import { ConnectionRegistry } from "../src/modules/realtime/connection-registry";

describe("ConnectionRegistry", () => {
  it("routes messages to a connected agent by device id", () => {
    const registry = new ConnectionRegistry();
    const send = vi.fn();
    registry.addAgent("device-1", { send: send as (message: string) => void });

    const delivered = registry.sendToAgent("device-1", { type: "ping" });

    expect(delivered).toBe(true);
    expect(send).toHaveBeenCalledWith(JSON.stringify({ type: "ping" }));
  });

  it("returns false when a device is offline", () => {
    const registry = new ConnectionRegistry();
    expect(registry.sendToAgent("missing", { type: "ping" })).toBe(false);
  });
});
