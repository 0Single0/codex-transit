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
});
