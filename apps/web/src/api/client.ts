import type {
  CreateBindCodeResponse,
  DeviceProjectsResponse,
  DeviceSummary,
  LoginResponse,
  SessionSummary
} from "@codex-transit/shared";

const API_BASE = import.meta.env.VITE_API_BASE ?? "http://localhost:4000";

export class ApiClient {
  constructor(
    private token: string | null,
    private fetcher: typeof fetch = fetch
  ) {}

  async login(email: string, password: string): Promise<LoginResponse> {
    return this.request("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password })
    });
  }

  async devices(): Promise<DeviceSummary[]> {
    return this.request("/devices");
  }

  async createDeviceBindCode(): Promise<CreateBindCodeResponse> {
    return this.request("/devices/bind-codes", { method: "POST" });
  }

  async sessions(projectId: string): Promise<SessionSummary[]> {
    return this.request(`/projects/${projectId}/sessions`);
  }

  async deviceProjects(deviceId: string): Promise<DeviceProjectsResponse> {
    return this.request(`/devices/${deviceId}/projects`);
  }

  async createSession(deviceId: string, projectId: string, title: string): Promise<SessionSummary> {
    return this.request("/sessions", {
      method: "POST",
      body: JSON.stringify({ deviceId, projectId, title })
    });
  }

  async sendSessionInput(sessionId: string, text: string): Promise<{ ok: boolean }> {
    return this.request(`/sessions/${sessionId}/input`, {
      method: "POST",
      body: JSON.stringify({ text })
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
      body: JSON.stringify({ relativePath })
    });
  }

  async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const response = await this.fetcher(`${API_BASE}${path}`, {
      ...init,
      headers: {
        "content-type": "application/json",
        ...(this.token ? { authorization: `Bearer ${this.token}` } : {}),
        ...init.headers
      }
    });
    if (!response.ok) throw new Error(`Request failed: ${response.status}`);
    return response.json();
  }
}
