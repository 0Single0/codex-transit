import { describe, expect, it } from "vitest";
import { codexOutputChunkSchema, fileChangedSchema, realtimeEventSchema } from "./events";

const base = {
  eventId: "00000000-0000-4000-8000-000000000001",
  timestamp: "2026-06-01T00:00:00.000Z",
  userId: "00000000-0000-4000-8000-000000000002",
  deviceId: "00000000-0000-4000-8000-000000000003",
  projectId: "00000000-0000-4000-8000-000000000004",
  sessionId: "00000000-0000-4000-8000-000000000005"
};

describe("realtime event schemas", () => {
  it("parses codex output chunks", () => {
    const parsed = codexOutputChunkSchema.parse({
      ...base,
      type: "codex.output.chunk",
      seq: 1,
      stream: "stdout",
      text: "hello"
    });

    expect(parsed.seq).toBe(1);
  });

  it("rejects empty file paths from file change events", () => {
    const result = fileChangedSchema.safeParse({
      ...base,
      type: "file.changed",
      relativePath: "",
      changeType: "modified"
    });

    expect(result.success).toBe(false);
  });

  it("routes discriminated union events by type", () => {
    const parsed = realtimeEventSchema.parse({
      ...base,
      type: "session.input",
      text: "change the README"
    });

    expect(parsed.type).toBe("session.input");
  });
});
