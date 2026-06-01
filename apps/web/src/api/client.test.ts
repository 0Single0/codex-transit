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

  it("loads session history endpoints", async () => {
    const http = createHttpMock([]);
    const api = new ApiClient("token", http);

    await api.sessionOutput("session-1");
    await api.sessionFileChanges("session-1");
    await api.sessionMessages("session-1");

    expect(http.request).toHaveBeenCalledWith(expect.objectContaining({ url: "/sessions/session-1/output" }));
    expect(http.request).toHaveBeenCalledWith(expect.objectContaining({ url: "/sessions/session-1/file-changes" }));
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
