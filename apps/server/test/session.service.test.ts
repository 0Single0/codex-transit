import { describe, expect, it } from "vitest";
import {
  buildCodexHistoryDetailRequestEvent,
  buildCodexHistoryRequestEvent,
  buildSessionRealtimeBase,
  buildStartAndInputEvents,
  toSessionSummary
} from "../src/modules/sessions/session.service";

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

  it("uses the agent project key in realtime events", () => {
    const session = {
      id: "00000000-0000-4000-8000-000000000001",
      userId: "00000000-0000-4000-8000-000000000002",
      deviceId: "00000000-0000-4000-8000-000000000003",
      projectId: "00000000-0000-4000-8000-000000000004",
      project: {
        agentKey: "00000000-0000-4000-8000-000000000099"
      }
    };

    expect(buildSessionRealtimeBase(session)).toMatchObject({
      userId: session.userId,
      deviceId: session.deviceId,
      projectId: "00000000-0000-4000-8000-000000000099",
      sessionId: session.id
    });
  });

  it("builds start and input events for first prompt delivery", () => {
    const session = {
      id: "00000000-0000-4000-8000-000000000001",
      userId: "00000000-0000-4000-8000-000000000002",
      deviceId: "00000000-0000-4000-8000-000000000003",
      projectId: "00000000-0000-4000-8000-000000000004",
      project: {
        agentKey: "00000000-0000-4000-8000-000000000099"
      }
    };

    const events = buildStartAndInputEvents(session, "帮我改登录页", {
      eventId: () => "00000000-0000-4000-8000-000000000010",
      now: () => "2026-06-01T00:00:00.000Z"
    });

    expect(events).toEqual([
      {
        type: "session.start",
        eventId: "00000000-0000-4000-8000-000000000010",
        timestamp: "2026-06-01T00:00:00.000Z",
        userId: session.userId,
        deviceId: session.deviceId,
        projectId: "00000000-0000-4000-8000-000000000099",
        sessionId: session.id
      },
      {
        type: "session.input",
        eventId: "00000000-0000-4000-8000-000000000010",
        timestamp: "2026-06-01T00:00:00.000Z",
        userId: session.userId,
        deviceId: session.deviceId,
        projectId: "00000000-0000-4000-8000-000000000099",
        sessionId: session.id,
        text: "帮我改登录页"
      }
    ]);
  });

  it("builds session input events with an optional model", () => {
    const session = {
      id: "00000000-0000-4000-8000-000000000001",
      userId: "00000000-0000-4000-8000-000000000002",
      deviceId: "00000000-0000-4000-8000-000000000003",
      projectId: "00000000-0000-4000-8000-000000000004",
      project: {
        agentKey: "00000000-0000-4000-8000-000000000099"
      }
    };

    const events = buildStartAndInputEvents(
      session,
      "hello",
      {
        eventId: () => "00000000-0000-4000-8000-000000000010",
        now: () => "2026-06-02T00:00:00.000Z"
      },
      undefined,
      "gpt-5.3-codex"
    );

    expect(events[1]).toMatchObject({
      type: "session.input",
      model: "gpt-5.3-codex"
    });
  });

  it("builds a device-level codex history request event", () => {
    const event = buildCodexHistoryRequestEvent({
      userId: "00000000-0000-4000-8000-000000000002",
      deviceId: "00000000-0000-4000-8000-000000000003",
      projectId: "00000000-0000-4000-8000-000000000004",
      limit: 15
    }, {
      eventId: () => "00000000-0000-4000-8000-000000000010",
      now: () => "2026-06-01T00:00:00.000Z"
    });

    expect(event).toEqual({
      type: "codex.history.request",
      eventId: "00000000-0000-4000-8000-000000000010",
      requestId: "00000000-0000-4000-8000-000000000010",
      timestamp: "2026-06-01T00:00:00.000Z",
      userId: "00000000-0000-4000-8000-000000000002",
      deviceId: "00000000-0000-4000-8000-000000000003",
      projectId: "00000000-0000-4000-8000-000000000004",
      limit: 15
    });
  });

  it("builds a device-level codex history detail request event", () => {
    const event = buildCodexHistoryDetailRequestEvent({
      userId: "00000000-0000-4000-8000-000000000002",
      deviceId: "00000000-0000-4000-8000-000000000003",
      codexSessionId: "019e8268-8f45-7422-aff8-5524d4c6990b"
    }, {
      eventId: () => "00000000-0000-4000-8000-000000000010",
      now: () => "2026-06-01T00:00:00.000Z"
    });

    expect(event).toEqual({
      type: "codex.history.detail.request",
      eventId: "00000000-0000-4000-8000-000000000010",
      requestId: "00000000-0000-4000-8000-000000000010",
      timestamp: "2026-06-01T00:00:00.000Z",
      userId: "00000000-0000-4000-8000-000000000002",
      deviceId: "00000000-0000-4000-8000-000000000003",
      codexSessionId: "019e8268-8f45-7422-aff8-5524d4c6990b"
    });
  });
});
