import { describe, expect, it, vi } from "vitest";
import { RuntimeSessionRegistry } from "./runtime-session-registry";

describe("RuntimeSessionRegistry", () => {
  it("reuses matching history bridge sessions in memory", () => {
    const registry = new RuntimeSessionRegistry();
    const created = registry.create({
      userId: "user-1",
      deviceId: "device-1",
      projectId: "project-1",
      agentProjectKey: "agent-project-1",
      codexSessionId: "codex-1"
    });

    const found = registry.findHistorySession({
      userId: "user-1",
      deviceId: "device-1",
      projectId: "project-1",
      codexSessionId: "codex-1"
    });

    expect(found?.sessionId).toBe(created.sessionId);
  });

  it("drops idle sessions during cleanup when they are stale and unobserved", () => {
    vi.useFakeTimers();
    const registry = new RuntimeSessionRegistry();
    const created = registry.create({
      userId: "user-1",
      deviceId: "device-1",
      projectId: "project-1",
      agentProjectKey: "agent-project-1"
    });

    registry.start(() => 0);
    vi.advanceTimersByTime(31 * 60 * 1000);

    expect(registry.find(created.sessionId)).toBeNull();
    registry.stop();
    vi.useRealTimers();
  });
});
