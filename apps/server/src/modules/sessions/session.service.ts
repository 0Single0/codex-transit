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
