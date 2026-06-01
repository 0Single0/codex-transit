import { invoke as tauriInvoke } from "@tauri-apps/api/core";

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
};

type Invoke = <T>(command: string, args?: Record<string, unknown>) => Promise<T>;

export type AgentApi = ReturnType<typeof createAgentApi>;

export function createAgentApi(invoke: Invoke = tauriInvoke) {
  return {
    getSettings() {
      return invoke<AgentSettings | null>("get_agent_settings");
    },

    saveSettings(settings: AgentSettings) {
      return invoke<void>("save_agent_settings", { settings });
    },

    listProjects() {
      return invoke<ProjectEntry[]>("list_projects");
    },

    addProject(path: string) {
      return invoke<ProjectEntry>("add_project", { path });
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
    }
  };
}
