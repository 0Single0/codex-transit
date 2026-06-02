import { describe, expect, it } from "vitest";
import type { SessionSummary } from "@codex-transit/shared";
import { pickProjectEntrySession, shouldCreateSessionOnProjectEntry } from "./projectAutoSession";

function makeSession(overrides: Partial<SessionSummary> = {}): SessionSummary {
  return {
    id: "00000000-0000-4000-8000-000000000001",
    deviceId: "00000000-0000-4000-8000-000000000002",
    projectId: "00000000-0000-4000-8000-000000000003",
    title: "Main session",
    status: "idle",
    createdAt: "2026-06-02T00:00:00.000Z",
    updatedAt: "2026-06-02T00:00:00.000Z",
    ...overrides
  };
}

describe("project auto session", () => {
  it("creates a transit session when none exists", () => {
    expect(shouldCreateSessionOnProjectEntry([])).toBe(true);
  });

  it("does not create an extra transit session when sessions already exist", () => {
    expect(shouldCreateSessionOnProjectEntry([makeSession()])).toBe(false);
  });

  it("picks the most recently updated session for quick entry", () => {
    const older = makeSession({
      id: "00000000-0000-4000-8000-000000000011",
      updatedAt: "2026-06-01T00:00:00.000Z"
    });
    const newer = makeSession({
      id: "00000000-0000-4000-8000-000000000012",
      updatedAt: "2026-06-03T00:00:00.000Z"
    });

    expect(pickProjectEntrySession([older, newer])?.id).toBe(newer.id);
  });
});
