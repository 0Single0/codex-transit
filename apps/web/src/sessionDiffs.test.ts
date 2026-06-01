import { describe, expect, it } from "vitest";
import { applyDiffResult, type DiffPreview } from "./sessionDiffs";

describe("applyDiffResult", () => {
  it("adds the newest diff result first", () => {
    const current: DiffPreview[] = [{ relativePath: "old.ts", ok: true, text: "old diff" }];

    const next = applyDiffResult(current, {
      type: "diff.result",
      eventId: "00000000-0000-4000-8000-000000000001",
      timestamp: "2026-06-01T00:00:00.000Z",
      userId: "00000000-0000-4000-8000-000000000002",
      deviceId: "00000000-0000-4000-8000-000000000003",
      projectId: "00000000-0000-4000-8000-000000000004",
      sessionId: "00000000-0000-4000-8000-000000000005",
      requestId: "00000000-0000-4000-8000-000000000006",
      relativePath: "src/App.tsx",
      ok: true,
      diff: "@@ changed"
    });

    expect(next[0]).toEqual({ relativePath: "src/App.tsx", ok: true, text: "@@ changed" });
    expect(next[1]).toBe(current[0]);
  });
});
