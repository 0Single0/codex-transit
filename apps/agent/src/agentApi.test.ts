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

  it("starts the agent runtime through the Tauri command", async () => {
    const invoke = vi.fn().mockResolvedValue({ running: true });
    const api = createAgentApi(invoke);

    const status = await api.startRuntime();

    expect(invoke).toHaveBeenCalledWith("start_agent_runtime");
    expect(status.running).toBe(true);
  });

  it("binds the agent with a pairing code", async () => {
    const invoke = vi.fn().mockResolvedValue({
      serverUrl: "http://localhost:4000",
      deviceId: "device-1",
      deviceToken: "token-1"
    });
    const api = createAgentApi(invoke);

    const result = await api.bindDevice({
      serverUrl: "http://localhost:4000",
      bindCode: "pair-code",
      name: "Workstation",
      platform: "windows"
    });

    expect(invoke).toHaveBeenCalledWith("bind_device", {
      request: {
        serverUrl: "http://localhost:4000",
        bindCode: "pair-code",
        name: "Workstation",
        platform: "windows"
      }
    });
    expect(result.deviceToken).toBe("token-1");
  });
});
