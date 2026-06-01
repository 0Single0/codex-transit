import type { DeviceSummary, LoginResponse, SessionSummary } from "@codex-transit/shared";

const API_BASE = import.meta.env.VITE_API_BASE ?? "http://localhost:4000";

export class ApiClient {
  constructor(private token: string | null) {}

  async login(email: string, password: string): Promise<LoginResponse> {
    return this.request("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password })
    });
  }

  async devices(): Promise<DeviceSummary[]> {
    return this.request("/devices");
  }

  async sessions(projectId: string): Promise<SessionSummary[]> {
    return this.request(`/projects/${projectId}/sessions`);
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
    const response = await fetch(`${API_BASE}${path}`, {
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
