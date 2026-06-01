import type {
  CreateBindCodeResponse,
  DeviceProjectsResponse,
  DeviceSummary,
  FileChangeHistory,
  LoginResponse,
  SessionMessage,
  SessionSummary,
  TerminalOutputChunk
} from "@codex-transit/shared";
import axios, { AxiosError, type AxiosInstance, type AxiosRequestConfig } from "axios";

const API_BASE = import.meta.env.VITE_API_BASE ?? "http://localhost:4000";

export class ApiClient {
  private http: AxiosInstance;

  constructor(private token: string | null, http: AxiosInstance = axios.create({ baseURL: API_BASE })) {
    this.http = http;
  }

  async login(email: string, password: string): Promise<LoginResponse> {
    return this.request("/auth/login", {
      method: "POST",
      data: { email, password }
    });
  }

  async register(email: string, password: string): Promise<LoginResponse> {
    return this.request("/auth/register", {
      method: "POST",
      data: { email, password }
    });
  }

  async devices(): Promise<DeviceSummary[]> {
    return this.request("/devices");
  }

  async createDeviceBindCode(): Promise<CreateBindCodeResponse> {
    return this.request("/devices/bind-codes", { method: "POST" });
  }

  async claimAgentLogin(pairingToken: string): Promise<{ deviceId: string }> {
    return this.request("/devices/agent-login/claim", {
      method: "POST",
      data: { pairingToken }
    });
  }

  async sessions(projectId: string): Promise<SessionSummary[]> {
    return this.request(`/projects/${projectId}/sessions`);
  }

  async sessionOutput(sessionId: string): Promise<TerminalOutputChunk[]> {
    return this.request(`/sessions/${sessionId}/output`);
  }

  async sessionFileChanges(sessionId: string): Promise<FileChangeHistory[]> {
    return this.request(`/sessions/${sessionId}/file-changes`);
  }

  async sessionMessages(sessionId: string): Promise<SessionMessage[]> {
    return this.request(`/sessions/${sessionId}/messages`);
  }

  async deviceProjects(deviceId: string): Promise<DeviceProjectsResponse> {
    return this.request(`/devices/${deviceId}/projects`);
  }

  async createSession(deviceId: string, projectId: string, title: string): Promise<SessionSummary> {
    return this.request("/sessions", {
      method: "POST",
      data: { deviceId, projectId, title }
    });
  }

  async sendSessionInput(sessionId: string, text: string): Promise<{ ok: boolean }> {
    return this.request(`/sessions/${sessionId}/input`, {
      method: "POST",
      data: { text }
    });
  }

  async startSession(sessionId: string): Promise<{ ok: boolean }> {
    return this.request(`/sessions/${sessionId}/start`, { method: "POST" });
  }

  async stopSession(sessionId: string): Promise<{ ok: boolean }> {
    return this.request(`/sessions/${sessionId}/stop`, { method: "POST" });
  }

  async requestDiff(sessionId: string, relativePath: string): Promise<{ ok: boolean; requestId: string }> {
    return this.request(`/sessions/${sessionId}/diff`, {
      method: "POST",
      data: { relativePath }
    });
  }

  async request<T>(path: string, config: AxiosRequestConfig = {}): Promise<T> {
    try {
      const response = await this.http.request<T>({
        url: path,
        ...config,
        headers: {
          "content-type": "application/json",
          ...(this.token ? { authorization: `Bearer ${this.token}` } : {}),
          ...config.headers
        }
      });
      return response.data;
    } catch (caught) {
      throw new Error(readAxiosErrorMessage(caught));
    }
  }
}

function readAxiosErrorMessage(error: unknown) {
  if (!isAxiosErrorWithData(error)) return error instanceof Error ? error.message : String(error);
  const data = error.response?.data;
  return data?.issues?.[0]?.message ?? data?.error ?? `Request failed: ${error.response?.status ?? "unknown"}`;
}

function isAxiosErrorWithData(error: unknown): error is AxiosError<{ error?: string; issues?: Array<{ message?: string }> }> {
  return axios.isAxiosError(error);
}
