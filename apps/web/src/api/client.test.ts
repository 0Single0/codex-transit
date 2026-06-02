import type { AxiosInstance } from "axios";
import { describe, expect, it, vi } from "vitest";
import { ApiClient, ApiError } from "./client";

function createHttpMock(data: unknown = {}) {
  return {
    request: vi.fn().mockResolvedValue({ data })
  } as unknown as AxiosInstance & { request: ReturnType<typeof vi.fn> };
}

describe("ApiClient", () => {
  it("requests projects for a selected device", async () => {
    const http = createHttpMock({ deviceId: "device-1", projects: [] });
    const api = new ApiClient("token", http);

    await api.deviceProjects("device-1");

    expect(http.request).toHaveBeenCalledWith({
      url: "/devices/device-1/projects",
      headers: {
        "content-type": "application/json",
        authorization: "Bearer token"
      }
    });
  });

  it("creates sessions with a title", async () => {
    const http = createHttpMock({ id: "session-1" });
    const api = new ApiClient("token", http);

    await api.createSession("device-1", "project-1", "New task");

    expect(http.request).toHaveBeenCalledWith({
      url: "/sessions",
      method: "POST",
      data: { deviceId: "device-1", projectId: "project-1", title: "New task" },
      headers: {
        "content-type": "application/json",
        authorization: "Bearer token"
      }
    });
  });

  it("creates runtime bridge sessions for new chats", async () => {
    const http = createHttpMock({ sessionId: "session-1", reused: false });
    const api = new ApiClient("token", http);

    await api.createRuntimeSession("device-1", "project-1", { mode: "new" });

    expect(http.request).toHaveBeenCalledWith({
      url: "/devices/device-1/projects/project-1/runtime-sessions",
      method: "POST",
      data: { mode: "new" },
      headers: {
        "content-type": "application/json",
        authorization: "Bearer token"
      }
    });
  });

  it("requests Codex history from a selected device", async () => {
    const http = createHttpMock({ ok: true, requestId: "request-1" });
    const api = new ApiClient("token", http);

    await api.requestCodexHistory("device-1", "project-1", 20);

    expect(http.request).toHaveBeenCalledWith({
      url: "/devices/device-1/codex-history",
      method: "POST",
      data: { projectId: "project-1", limit: 20 },
      headers: {
        "content-type": "application/json",
        authorization: "Bearer token"
      }
    });
  });

  it("requests Codex history details from a selected device", async () => {
    const http = createHttpMock({ ok: true, requestId: "request-1" });
    const api = new ApiClient("token", http);

    await api.requestCodexHistoryDetail("device-1", "codex-session-1");

    expect(http.request).toHaveBeenCalledWith({
      url: "/devices/device-1/codex-history/codex-session-1",
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: "Bearer token"
      }
    });
  });

  it("sends session input with a Codex resume session id", async () => {
    const http = createHttpMock({ ok: true });
    const api = new ApiClient("token", http);

    await api.sendSessionInput("session-1", "continue", "codex-session-1");

    expect(http.request).toHaveBeenCalledWith({
      url: "/sessions/session-1/input",
      method: "POST",
      data: { text: "continue", codexSessionId: "codex-session-1" },
      headers: {
        "content-type": "application/json",
        authorization: "Bearer token"
      }
    });
  });

  it("sends session input with a selected model", async () => {
    const http = createHttpMock({ ok: true });
    const api = new ApiClient("token", http);

    await api.sendSessionInput("session-1", "continue", "codex-session-1", "gpt-5.3-codex");

    expect(http.request).toHaveBeenCalledWith({
      url: "/sessions/session-1/input",
      method: "POST",
      data: { text: "continue", codexSessionId: "codex-session-1", model: "gpt-5.3-codex" },
      headers: {
        "content-type": "application/json",
        authorization: "Bearer token"
      }
    });
  });

  it("sends session input with plan mode, approval policy, and attachments", async () => {
    const http = createHttpMock({ ok: true });
    const api = new ApiClient("token", http);

    await api.sendSessionInput("session-1", "continue", "codex-session-1", "gpt-5.4", {
      planMode: true,
      approvalPolicy: "full",
      attachments: [{ name: "ui.png", path: "C:/tmp/ui.png", kind: "image" }]
    });

    expect(http.request).toHaveBeenCalledWith({
      url: "/sessions/session-1/input",
      method: "POST",
      data: {
        text: "continue",
        codexSessionId: "codex-session-1",
        model: "gpt-5.4",
        planMode: true,
        approvalPolicy: "full",
        attachments: [{ name: "ui.png", path: "C:/tmp/ui.png", kind: "image" }]
      },
      headers: {
        "content-type": "application/json",
        authorization: "Bearer token"
      }
    });
  });

  it("claims Agent login QR pairings for the signed in user", async () => {
    const http = createHttpMock({ deviceId: "device-1" });
    const api = new ApiClient("token", http);

    await api.claimAgentLogin("pair-token");

    expect(http.request).toHaveBeenCalledWith({
      url: "/devices/agent-login/claim",
      method: "POST",
      data: { pairingToken: "pair-token" },
      headers: {
        "content-type": "application/json",
        authorization: "Bearer token"
      }
    });
  });

  it("registers new users", async () => {
    const http = createHttpMock({ token: "token", user: { id: "user-1", email: "new@example.com" } });
    const api = new ApiClient(null, http);

    await api.register("new@example.com", "password123");

    expect(http.request).toHaveBeenCalledWith({
      url: "/auth/register",
      method: "POST",
      data: { email: "new@example.com", password: "password123" },
      headers: {
        "content-type": "application/json"
      }
    });
  });

  it("loads session messages endpoint", async () => {
    const http = createHttpMock([]);
    const api = new ApiClient("token", http);

    await api.sessionMessages("session-1");

    expect(http.request).toHaveBeenCalledWith(expect.objectContaining({ url: "/sessions/session-1/messages" }));
  });

  it("throws server validation messages from failed requests", async () => {
    const error = {
      isAxiosError: true,
      status: 400,
      response: {
        status: 400,
        data: { error: "validation_error", issues: [{ message: "Password is too short" }] }
      }
    };
    const http = {
      request: vi.fn().mockRejectedValue(error)
    } as unknown as AxiosInstance & { request: ReturnType<typeof vi.fn> };
    const api = new ApiClient(null, http);

    await expect(api.register("new@example.com", "123")).rejects.toThrow("Password is too short");
  });

  it("preserves response status codes on failed requests", async () => {
    const error = {
      isAxiosError: true,
      response: {
        status: 401,
        data: { error: "invalid_token" }
      }
    };
    const http = {
      request: vi.fn().mockRejectedValue(error)
    } as unknown as AxiosInstance & { request: ReturnType<typeof vi.fn> };
    const api = new ApiClient("old-token", http);

    await expect(api.devices()).rejects.toMatchObject({
      message: "invalid_token",
      status: 401,
      code: "invalid_token"
    } satisfies Partial<ApiError>);
  });
});
