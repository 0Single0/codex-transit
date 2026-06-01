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
  }
) {
  const base = buildSessionRealtimeBase(session);
  return [
    {
      type: "session.start",
      eventId: clock.eventId(),
      timestamp: clock.now(),
      ...base
    },
    {
      type: "session.input",
      eventId: clock.eventId(),
      timestamp: clock.now(),
      ...base,
      text
    }
  ];
}

function cryptoRandomId() {
  return crypto.randomUUID();
}
