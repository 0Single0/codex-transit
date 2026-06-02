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

  it("routes messages to every viewer connected to a device", () => {
    const registry = new ConnectionRegistry();
    const first = vi.fn();
    const second = vi.fn();
    registry.addDeviceViewer("device-1", { send: first as (message: string) => void });
    registry.addDeviceViewer("device-1", { send: second as (message: string) => void });

    const count = registry.broadcastToDeviceViewers("device-1", { type: "codex.history.result" });

    expect(count).toBe(2);
    expect(first).toHaveBeenCalledWith(JSON.stringify({ type: "codex.history.result" }));
    expect(second).toHaveBeenCalledWith(JSON.stringify({ type: "codex.history.result" }));
  });

  it("routes device model updates to every viewer connected to a device", () => {
    const registry = new ConnectionRegistry();
    const first = vi.fn();
    const second = vi.fn();
    const payload = {
      type: "device.models.updated",
      eventId: "00000000-0000-4000-8000-000000000001",
      timestamp: "2026-06-02T00:00:00.000Z",
      userId: "00000000-0000-4000-8000-000000000002",
      deviceId: "device-1",
      models: [{ id: "gpt-5.3-codex", label: "gpt-5.3-codex", provider: "custom", available: true }]
    };
    registry.addDeviceViewer("device-1", { send: first as (message: string) => void });
    registry.addDeviceViewer("device-1", { send: second as (message: string) => void });

    const count = registry.broadcastToDeviceViewers("device-1", payload);

    expect(count).toBe(2);
    expect(first).toHaveBeenCalledWith(JSON.stringify(payload));
    expect(second).toHaveBeenCalledWith(JSON.stringify(payload));
  });

  it("replays only the cached device model update to late device viewers", () => {
    const registry = new ConnectionRegistry();
    const earlyViewer = vi.fn();
    const lateViewer = vi.fn();
    const modelsPayload = {
      type: "device.models.updated",
      eventId: "00000000-0000-4000-8000-000000000011",
      timestamp: "2026-06-02T00:00:00.000Z",
      userId: "00000000-0000-4000-8000-000000000012",
      deviceId: "device-1",
      models: [{ id: "gpt-5.4", label: "gpt-5.4", provider: "custom", available: true }]
    };

    registry.addDeviceViewer("device-1", { send: earlyViewer as (message: string) => void });
    registry.cacheLatestDeviceModels("device-1", modelsPayload);
    registry.broadcastToDeviceViewers("device-1", { type: "codex.history.result" });

    registry.addDeviceViewer("device-1", { send: lateViewer as (message: string) => void });

    expect(lateViewer).toHaveBeenCalledTimes(1);
    expect(lateViewer).toHaveBeenCalledWith(JSON.stringify(modelsPayload));
  });
});
