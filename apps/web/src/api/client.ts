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

  async register(email: string, password: string): Promise<LoginResponse> {
    return this.request("/auth/register", {
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

  async claimAgentLogin(pairingToken: string): Promise<{ deviceId: string }> {
    return this.request("/devices/agent-login/claim", {
      method: "POST",
      body: JSON.stringify({ pairingToken })
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
    if (!response.ok) {
      let message = `Request failed: ${response.status}`;
      try {
        const body = (await response.json()) as { error?: string; issues?: Array<{ message?: string }> };
        message = body.issues?.[0]?.message ?? body.error ?? message;
      } catch {
        // Keep the generic HTTP status message when the response body is not JSON.
      }
      throw new Error(message);
    }
    return response.json();
  }
}
