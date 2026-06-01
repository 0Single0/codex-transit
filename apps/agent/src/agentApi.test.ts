import { describe, expect, it, vi } from "vitest";
import { createAgentApi } from "./agentApi";

describe("createAgentApi", () => {
  it("saves agent settings with the Tauri command payload", async () => {
    const invoke = vi.fn().mockResolvedValue(undefined);
    const api = createAgentApi(invoke);

    await api.saveSettings({
      serverUrl: "http://localhost:4000",
      deviceId: "device-1",
      deviceToken: "token-1"
    });

    expect(invoke).toHaveBeenCalledWith("save_agent_settings", {
      settings: {
        serverUrl: "http://localhost:4000",
        deviceId: "device-1",
        deviceToken: "token-1"
      }
    });
  });

  it("adds a project path through the Tauri command", async () => {
    const invoke = vi.fn().mockResolvedValue({
      project_id: "project-1",
      display_name: "codex-transit",
      path_alias: "codex-transit",
      root: "E:\\code\\codex-transit",
      available: true
    });
    const api = createAgentApi(invoke);

    const project = await api.addProject("E:\\code\\codex-transit");

    expect(invoke).toHaveBeenCalledWith("add_project", {
      path: "E:\\code\\codex-transit"
    });
    expect(project.display_name).toBe("codex-transit");
  });
});
