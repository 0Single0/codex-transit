import crypto from "node:crypto";

export function normalizeSessionTitle(title: string) {
  return title.trim().slice(0, 120);
}

export function toSessionSummary(session: {
  id: string;
  deviceId: string;
  projectId: string;
  title: string;
  status: "idle" | "running" | "stopped" | "failed" | "agent_disconnected" | "unknown";
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: session.id,
    deviceId: session.deviceId,
    projectId: session.projectId,
    title: session.title,
    status: session.status,
    createdAt: session.createdAt.toISOString(),
    updatedAt: session.updatedAt.toISOString()
  };
}

export function buildSessionRealtimeBase(session: {
  id: string;
  userId: string;
  deviceId: string;
  projectId: string;
  project?: { agentKey: string } | null;
}) {
  return {
    userId: session.userId,
    deviceId: session.deviceId,
    projectId: session.project?.agentKey ?? session.projectId,
    sessionId: session.id
  };
}

export function buildStartAndInputEvents(
  session: {
    id: string;
    userId: string;
    deviceId: string;
    projectId: string;
    project?: { agentKey: string } | null;
  },
  text: string,
  clock = {
    eventId: cryptoRandomId,
    now: () => new Date().toISOString()
  },
  codexSessionId?: string,
  model?: string
) {
  const base = buildSessionRealtimeBase(session);
  const inputEvent = {
    type: "session.input",
    eventId: clock.eventId(),
    timestamp: clock.now(),
    ...base,
    ...(codexSessionId ? { codexSessionId } : {}),
    ...(model ? { model } : {}),
    text
  };
  if (codexSessionId) {
    return [inputEvent];
  }
  return [
    {
      type: "session.start",
      eventId: clock.eventId(),
      timestamp: clock.now(),
      ...base
    },
    inputEvent
  ];
}

export function buildCodexHistoryRequestEvent(
  input: {
    userId: string;
    deviceId: string;
    projectId?: string;
    limit?: number;
  },
  clock = {
    eventId: cryptoRandomId,
    now: () => new Date().toISOString()
  }
) {
  const requestId = clock.eventId();
  return {
    type: "codex.history.request",
    eventId: requestId,
    requestId,
    timestamp: clock.now(),
    userId: input.userId,
    deviceId: input.deviceId,
    ...(input.projectId ? { projectId: input.projectId } : {}),
    limit: input.limit ?? 30
  };
}

export function buildCodexHistoryDetailRequestEvent(
  input: {
    userId: string;
    deviceId: string;
    codexSessionId: string;
  },
  clock = {
    eventId: cryptoRandomId,
    now: () => new Date().toISOString()
  }
) {
  const requestId = clock.eventId();
  return {
    type: "codex.history.detail.request",
    eventId: requestId,
    requestId,
    timestamp: clock.now(),
    userId: input.userId,
    deviceId: input.deviceId,
    codexSessionId: input.codexSessionId
  };
}

function cryptoRandomId() {
  return crypto.randomUUID();
}
