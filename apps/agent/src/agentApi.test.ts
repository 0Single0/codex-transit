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

  it("opens a native project folder picker through the Tauri command", async () => {
    const invoke = vi.fn().mockResolvedValue("E:\\code\\codex-transit");
    const api = createAgentApi(invoke);

    const path = await api.chooseProjectDirectory();

    expect(invoke).toHaveBeenCalledWith("choose_project_directory");
    expect(path).toBe("E:\\code\\codex-transit");
  });

  it("removes a project through the Tauri command", async () => {
    const invoke = vi.fn().mockResolvedValue(undefined);
    const api = createAgentApi(invoke);

    await api.removeProject("project-1");

    expect(invoke).toHaveBeenCalledWith("remove_project", {
      projectId: "project-1"
    });
  });

  it("reads device overview through the Tauri command", async () => {
    const invoke = vi.fn().mockResolvedValue({
      name: "DESKTOP-7G8H2K9",
      platform: "windows",
      osLabel: "Windows 10 Pro",
      version: "0.1.0"
    });
    const api = createAgentApi(invoke);

    const overview = await api.getDeviceOverview();

    expect(invoke).toHaveBeenCalledWith("get_device_overview");
    expect(overview.name).toBe("DESKTOP-7G8H2K9");
  });

  it("clears local agent settings through the Tauri command", async () => {
    const invoke = vi.fn().mockResolvedValue(undefined);
    const api = createAgentApi(invoke);

    await api.clearSettings();

    expect(invoke).toHaveBeenCalledWith("clear_agent_settings");
  });

  it("starts the agent runtime through the Tauri command", async () => {
    const invoke = vi.fn().mockResolvedValue({ running: true, connected: false, lastError: null });
    const api = createAgentApi(invoke);

    const status = await api.startRuntime();

    expect(invoke).toHaveBeenCalledWith("start_agent_runtime");
    expect(status.running).toBe(true);
    expect(status.connected).toBe(false);
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

  it("registers the agent after account login", async () => {
    const fetcher = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ deviceId: "device-1", token: "token-1" })
    });
    const api = createAgentApi(vi.fn(), fetcher as never);

    await api.registerLoggedInDevice("user-token", {
      name: "Workstation",
      platform: "windows"
    });

    expect(fetcher).toHaveBeenCalledWith("http://localhost:4000/devices/agent-login/register", {
      method: "POST",
      body: JSON.stringify({ name: "Workstation", platform: "windows" }),
      headers: {
        "content-type": "application/json",
        authorization: "Bearer user-token"
      }
    });
  });

  it("creates an agent login pairing QR payload", async () => {
    const fetcher = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          pairingToken: "pair-token",
          expiresAt: "2026-06-01T00:00:00.000Z",
          payload: { type: "codex-transit.agent-login", version: 1 }
        })
    });
    const api = createAgentApi(vi.fn(), fetcher as never);

    await api.createLoginPairing({ name: "Workstation", platform: "windows" });

    expect(fetcher).toHaveBeenCalledWith("http://localhost:4000/agent/login-pairings", {
      method: "POST",
      body: JSON.stringify({ name: "Workstation", platform: "windows" }),
      headers: {
        "content-type": "application/json"
      }
    });
  });
});
