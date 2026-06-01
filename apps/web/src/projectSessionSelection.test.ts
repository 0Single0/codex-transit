import { describe, expect, it } from "vitest";
import { shouldAutoOpenStoredSession } from "./projectSessionSelection";

describe("shouldAutoOpenStoredSession", () => {
  it("does not reopen persisted transit sessions when a project is selected", () => {
    expect(
      shouldAutoOpenStoredSession([
        {
          id: "00000000-0000-4000-8000-000000000001",
          deviceId: "00000000-0000-4000-8000-000000000002",
          projectId: "00000000-0000-4000-8000-000000000003",
          title: "old app session",
          status: "idle",
          createdAt: "2026-06-01T00:00:00.000Z",
          updatedAt: "2026-06-01T00:00:00.000Z"
        }
      ])
    ).toBe(false);
  });
});
