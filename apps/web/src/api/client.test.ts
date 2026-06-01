import { describe, expect, it, vi } from "vitest";
import { ApiClient } from "./client";

describe("ApiClient", () => {
  it("requests projects for a selected device", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ deviceId: "device-1", projects: [] })
    });
    const api = new ApiClient("token", fetchMock as never);

    await api.deviceProjects("device-1");

    expect(fetchMock).toHaveBeenCalledWith("http://localhost:4000/devices/device-1/projects", {
      headers: {
        "content-type": "application/json",
        authorization: "Bearer token"
      }
    });
  });

  it("creates sessions with a title", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ id: "session-1" })
    });
    const api = new ApiClient("token", fetchMock as never);

    await api.createSession("device-1", "project-1", "New task");

    expect(fetchMock).toHaveBeenCalledWith("http://localhost:4000/sessions", {
      method: "POST",
      body: JSON.stringify({ deviceId: "device-1", projectId: "project-1", title: "New task" }),
      headers: {
        "content-type": "application/json",
        authorization: "Bearer token"
      }
    });
  });

  it("creates device bind codes for the signed in user", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ bindCode: "abc12345", expiresAt: "2026-06-01T00:00:00.000Z" })
    });
    const api = new ApiClient("token", fetchMock as never);

    await api.createDeviceBindCode();

    expect(fetchMock).toHaveBeenCalledWith("http://localhost:4000/devices/bind-codes", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: "Bearer token"
      }
    });
  });

  it("loads session output history", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([{ seq: 0, stream: "stdout", text: "hello" }])
    });
    const api = new ApiClient("token", fetchMock as never);

    await api.sessionOutput("session-1");

    expect(fetchMock).toHaveBeenCalledWith("http://localhost:4000/sessions/session-1/output", {
      headers: {
        "content-type": "application/json",
        authorization: "Bearer token"
      }
    });
  });

  it("loads changed file history", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([{ relativePath: "src/main.ts", changeType: "modified" }])
    });
    const api = new ApiClient("token", fetchMock as never);

    await api.sessionFileChanges("session-1");

    expect(fetchMock).toHaveBeenCalledWith("http://localhost:4000/sessions/session-1/file-changes", {
      headers: {
        "content-type": "application/json",
        authorization: "Bearer token"
      }
    });
  });

  it("loads session message history", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([{ role: "user", text: "make a change" }])
    });
    const api = new ApiClient("token", fetchMock as never);

    await api.sessionMessages("session-1");

    expect(fetchMock).toHaveBeenCalledWith("http://localhost:4000/sessions/session-1/messages", {
      headers: {
        "content-type": "application/json",
        authorization: "Bearer token"
      }
    });
  });
});
