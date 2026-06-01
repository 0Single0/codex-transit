import { describe, expect, it } from "vitest";
import { toSessionSummary } from "../src/modules/sessions/session.service";

describe("session service", () => {
  it("maps database dates to ISO strings", () => {
    const createdAt = new Date("2026-06-01T00:00:00.000Z");
    const updatedAt = new Date("2026-06-01T00:01:00.000Z");

    expect(
      toSessionSummary({
        id: "00000000-0000-4000-8000-000000000001",
        deviceId: "00000000-0000-4000-8000-000000000002",
        projectId: "00000000-0000-4000-8000-000000000003",
        title: "Task",
        status: "idle",
        createdAt,
        updatedAt
      })
    ).toEqual({
      id: "00000000-0000-4000-8000-000000000001",
      deviceId: "00000000-0000-4000-8000-000000000002",
      projectId: "00000000-0000-4000-8000-000000000003",
      title: "Task",
      status: "idle",
      createdAt: "2026-06-01T00:00:00.000Z",
      updatedAt: "2026-06-01T00:01:00.000Z"
    });
  });
});
