import { describe, expect, it } from "vitest";
import { codexHistoryDetailResultSchema, codexHistoryRequestSchema, codexHistoryResultSchema, codexOutputChunkSchema, codexTurnCompletedSchema, codexTurnFailedSchema, fileChangedSchema, realtimeEventSchema } from "./events";

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

  it("parses codex turn completed events", () => {
    const parsed = codexTurnCompletedSchema.parse({
      ...base,
      type: "codex.turn.completed",
      turnId: "turn_1"
    });

    expect(parsed.turnId).toBe("turn_1");
  });

  it("parses codex turn failed events", () => {
    const parsed = codexTurnFailedSchema.parse({
      ...base,
      type: "codex.turn.failed",
      message: "service unavailable",
      turnId: "turn_1"
    });

    expect(parsed.message).toBe("service unavailable");
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

  it("parses codex history request and result events", () => {
    const request = codexHistoryRequestSchema.parse({
      ...base,
      type: "codex.history.request",
      requestId: "00000000-0000-4000-8000-000000000010",
      limit: 20
    });
    const result = codexHistoryResultSchema.parse({
      ...base,
      type: "codex.history.result",
      requestId: request.requestId,
      ok: true,
      sessions: [
        {
          codexSessionId: "019e8268-8f45-7422-aff8-5524d4c6990b",
          title: "查看对话代理历史跳转逻辑",
          updatedAt: "2026-06-01T08:59:41.440Z"
        }
      ]
    });

    expect(result.sessions[0]?.codexSessionId).toBe("019e8268-8f45-7422-aff8-5524d4c6990b");
  });

  it("parses codex history detail result events with messages", () => {
    const result = codexHistoryDetailResultSchema.parse({
      ...base,
      type: "codex.history.detail.result",
      requestId: "00000000-0000-4000-8000-000000000010",
      codexSessionId: "019e8268-8f45-7422-aff8-5524d4c6990b",
      ok: true,
      messages: [
        {
          id: "message-1",
          role: "user",
          text: "继续"
        }
      ]
    });

    expect(result.messages[0]?.text).toBe("继续");
  });
});
