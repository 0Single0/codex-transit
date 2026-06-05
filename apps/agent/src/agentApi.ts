import { invoke as tauriInvoke } from "@tauri-apps/api/core";
import { maybeEncryptPayload } from "./transportCrypto";

export type AgentSettings = {
  serverUrl: string;
  deviceId: string;
  deviceToken: string;
};

export type ProjectEntry = {
  project_id: string;
  display_name: string;
  path_alias: string;
  root: string;
  available: boolean;
};

export type AgentRuntimeStatus = {
  running: boolean;
  connected: boolean;
  lastError: string | null;
  recentCommands: AgentCommandLogEntry[];
};

export type AgentCommandLogEntry = {
  itemId: string;
  command: string;
  status: string;
  output?: string | null;
  exitCode?: number | null;
};

export type AgentDeviceOverview = {
  name: string;
  platform: string;
  osLabel: string;
  version: string;
};

export type BindDeviceRequest = {
  serverUrl: string;
  bindCode: string;
  name: string;
  platform: "windows" | "macos" | "unknown";
};

export type AgentDeviceRegistration = {
  name: string;
  platform: "windows" | "macos" | "unknown";
};

export type AgentLoginPairing = {
  pairingToken: string;
  expiresAt: string;
  payload: {
    type: "codex-transit.agent-login";
    version: 1;
    serverUrl: string;
    pairingToken: string;
  };
};

export type AgentLoginPairingStatus =
  | { status: "pending" }
  | { status: "expired" }
  | { status: "claimed"; deviceId: string; token: string };

type Invoke = <T>(command: string, args?: Record<string, unknown>) => Promise<T>;

export type AgentApi = ReturnType<typeof createAgentApi>;

const API_BASE = import.meta.env.VITE_API_BASE ?? "http://localhost:4000";

export function createAgentApi(invoke: Invoke = tauriInvoke, fetcher: typeof fetch = fetch) {
  async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const response = await fetcher(`${API_BASE}${path}`, {
      ...init,
      headers: {
        "content-type": "application/json",
        ...init.headers
      }
    });
    if (!response.ok) throw new Error(`Request failed: ${response.status}`);
    return response.json();
  }

  return {
    getSettings() {
      return invoke<AgentSettings | null>("get_agent_settings");
    },

    saveSettings(settings: AgentSettings) {
      return invoke<void>("save_agent_settings", { settings });
    },

    clearSettings() {
      return invoke<void>("clear_agent_settings");
    },

    exitApp() {
      return invoke<void>("exit_app");
    },

    openMainWindow() {
      return invoke<void>("open_main_window");
    },

    openSettingsWindow(section: "general" | "logs" | "about") {
      return invoke<void>("open_settings_window", { section });
    },

    hideTrayPopover() {
      return invoke<void>("hide_tray_popover");
    },

    listProjects() {
      return invoke<ProjectEntry[]>("list_projects");
    },

    getDeviceOverview() {
      return invoke<AgentDeviceOverview>("get_device_overview");
    },

    addProject(path: string) {
      return invoke<ProjectEntry>("add_project", { path });
    },

    removeProject(projectId: string) {
      return invoke<void>("remove_project", { projectId });
    },

    chooseProjectDirectory() {
      return invoke<string | null>("choose_project_directory");
    },

    syncProjectsNow() {
      return invoke<void>("sync_projects_now");
    },

    startRuntime() {
      return invoke<AgentRuntimeStatus>("start_agent_runtime");
    },

    stopRuntime() {
      return invoke<AgentRuntimeStatus>("stop_agent_runtime");
    },

    getRuntimeStatus() {
      return invoke<AgentRuntimeStatus>("get_agent_runtime_status");
    },

    bindDevice(request: BindDeviceRequest) {
      return invoke<AgentSettings>("bind_device", { request });
    },

    async login(email: string, password: string) {
      return request<{ token: string }>("/auth/login", {
        method: "POST",
        body: JSON.stringify(maybeEncryptPayload({ email, password }))
      });
    },

    async registerLoggedInDevice(token: string, requestBody: AgentDeviceRegistration) {
      return request<{ deviceId: string; token: string }>("/devices/agent-login/register", {
        method: "POST",
        body: JSON.stringify(requestBody),
        headers: {
          authorization: `Bearer ${token}`
        }
      });
    },

    async createLoginPairing(requestBody: AgentDeviceRegistration) {
      return request<AgentLoginPairing>("/agent/login-pairings", {
        method: "POST",
        body: JSON.stringify(requestBody)
      });
    },

    async getLoginPairingStatus(pairingToken: string) {
      return request<AgentLoginPairingStatus>(`/agent/login-pairings/${pairingToken}`);
    }
  };
}
