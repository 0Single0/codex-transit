import type {
  CreateRuntimeSessionResponse,
  CreateBindCodeResponse,
  DeviceProjectsResponse,
  DeviceSummary,
  LoginResponse,
  SessionMessage,
  SessionSummary
} from "@codex-transit/shared";
import axios, { AxiosError, type AxiosInstance, type AxiosRequestConfig } from "axios";

const API_BASE = import.meta.env.VITE_API_BASE ?? "http://localhost:4000";

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    readonly code?: string
  ) {
    super(message);
    this.name = "ApiError";
  }
}

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

  async sessionMessages(sessionId: string): Promise<SessionMessage[]> {
    return this.request(`/sessions/${sessionId}/messages`);
  }

  async deviceProjects(deviceId: string): Promise<DeviceProjectsResponse> {
    return this.request(`/devices/${deviceId}/projects`);
  }

  async refreshDeviceModels(deviceId: string): Promise<{ ok: boolean }> {
    return this.request(`/devices/${deviceId}/models/refresh`, {
      method: "POST"
    });
  }

  async uploadAttachment(file: File): Promise<{ path: string }> {
    const formData = new FormData();
    formData.append("file", file);
    try {
      const response = await this.http.request<{ path: string }>({
        url: "/attachments",
        method: "POST",
        data: formData,
        headers: {
          ...(this.token ? { authorization: `Bearer ${this.token}` } : {})
        }
      });
      return response.data;
    } catch (caught) {
      throw readApiError(caught);
    }
  }

  async createSession(deviceId: string, projectId: string, title: string): Promise<SessionSummary> {
    return this.request("/sessions", {
      method: "POST",
      data: { deviceId, projectId, title }
    });
  }

  async createRuntimeSession(
    deviceId: string,
    projectId: string,
    input: {
      mode: "new" | "history";
      codexSessionId?: string;
    }
  ): Promise<CreateRuntimeSessionResponse> {
    return this.request(`/devices/${deviceId}/projects/${projectId}/runtime-sessions`, {
      method: "POST",
      data: input
    });
  }

  async requestCodexHistory(
    deviceId: string,
    projectId?: string,
    limit = 30
  ): Promise<{ ok: boolean; requestId: string }> {
    return this.request(`/devices/${deviceId}/codex-history`, {
      method: "POST",
      data: { projectId, limit }
    });
  }

  async requestCodexHistoryDetail(
    deviceId: string,
    codexSessionId: string
  ): Promise<{ ok: boolean; requestId: string }> {
    return this.request(`/devices/${deviceId}/codex-history/${codexSessionId}`, {
      method: "POST"
    });
  }

  async sendSessionInput(
    sessionId: string,
    text: string,
    codexSessionId?: string,
    model?: string,
    options?: {
      planMode?: boolean;
      approvalPolicy?: "default" | "auto" | "full";
      attachments?: Array<{
        name: string;
        path: string;
        mimeType?: string;
        kind: "image" | "file";
      }>;
    }
  ): Promise<{ ok: boolean }> {
    return this.request(`/sessions/${sessionId}/input`, {
      method: "POST",
      data: {
        text,
        ...(codexSessionId ? { codexSessionId } : {}),
        ...(model ? { model } : {}),
        ...(options?.planMode ? { planMode: true } : {}),
        ...(options?.approvalPolicy ? { approvalPolicy: options.approvalPolicy } : {}),
        ...(options?.attachments?.length ? { attachments: options.attachments } : {})
      }
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
      throw readApiError(caught);
    }
  }
}

function readApiError(error: unknown) {
  if (!isAxiosErrorWithData(error)) return error instanceof Error ? error : new Error(String(error));
  return new ApiError(readAxiosErrorMessage(error), error.response?.status, error.response?.data?.error);
}

function readAxiosErrorMessage(error: unknown) {
  if (!isAxiosErrorWithData(error)) return error instanceof Error ? error.message : String(error);
  const data = error.response?.data;
  return data?.issues?.[0]?.message ?? data?.error ?? `Request failed: ${error.response?.status ?? "unknown"}`;
}

function isAxiosErrorWithData(error: unknown): error is AxiosError<{ error?: string; issues?: Array<{ message?: string }> }> {
  return axios.isAxiosError(error);
}
