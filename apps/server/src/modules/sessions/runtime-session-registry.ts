import crypto from "node:crypto";

export type RuntimeSessionStatus = "idle" | "running" | "stopped" | "failed" | "agent_disconnected" | "unknown";

export type RuntimeSessionRecord = {
  sessionId: string;
  userId: string;
  deviceId: string;
  projectId: string;
  agentProjectKey: string;
  codexSessionId?: string;
  status: RuntimeSessionStatus;
  createdAt: Date;
  lastTouchedAt: Date;
};

const ONE_MINUTE = 60 * 1000;
const TEN_MINUTES = 10 * ONE_MINUTE;
const THIRTY_MINUTES = 30 * ONE_MINUTE;
const TWENTY_FOUR_HOURS = 24 * 60 * ONE_MINUTE;

export class RuntimeSessionRegistry {
  private readonly sessions = new Map<string, RuntimeSessionRecord>();
  private cleanupTimer: NodeJS.Timeout | null = null;

  start(getViewerCount: (sessionId: string) => number) {
    if (this.cleanupTimer) return;
    this.cleanupTimer = setInterval(() => {
      this.cleanup(getViewerCount);
    }, TEN_MINUTES);
    this.cleanupTimer.unref?.();
  }

  stop() {
    if (!this.cleanupTimer) return;
    clearInterval(this.cleanupTimer);
    this.cleanupTimer = null;
  }

  create(input: {
    userId: string;
    deviceId: string;
    projectId: string;
    agentProjectKey: string;
    codexSessionId?: string;
  }) {
    const now = new Date();
    const record: RuntimeSessionRecord = {
      sessionId: crypto.randomUUID(),
      userId: input.userId,
      deviceId: input.deviceId,
      projectId: input.projectId,
      agentProjectKey: input.agentProjectKey,
      ...(input.codexSessionId ? { codexSessionId: input.codexSessionId } : {}),
      status: "idle",
      createdAt: now,
      lastTouchedAt: now
    };
    this.sessions.set(record.sessionId, record);
    return record;
  }

  find(sessionId: string) {
    return this.sessions.get(sessionId) ?? null;
  }

  findHistorySession(input: {
    userId: string;
    deviceId: string;
    projectId: string;
    codexSessionId: string;
  }) {
    for (const record of this.sessions.values()) {
      if (
        record.userId === input.userId &&
        record.deviceId === input.deviceId &&
        record.projectId === input.projectId &&
        record.codexSessionId === input.codexSessionId
      ) {
        return record;
      }
    }
    return null;
  }

  touch(sessionId: string) {
    const record = this.sessions.get(sessionId);
    if (!record) return null;
    record.lastTouchedAt = new Date();
    return record;
  }

  updateStatus(sessionId: string, status: RuntimeSessionStatus) {
    const record = this.sessions.get(sessionId);
    if (!record) return null;
    record.status = status;
    record.lastTouchedAt = new Date();
    return record;
  }

  bindCodexSession(sessionId: string, codexSessionId: string) {
    const record = this.sessions.get(sessionId);
    if (!record) return null;
    record.codexSessionId = codexSessionId;
    record.lastTouchedAt = new Date();
    return record;
  }

  remove(sessionId: string) {
    this.sessions.delete(sessionId);
  }

  private cleanup(getViewerCount: (sessionId: string) => number) {
    const now = Date.now();
    for (const [sessionId, record] of this.sessions.entries()) {
      const age = now - record.lastTouchedAt.getTime();
      if (age > TWENTY_FOUR_HOURS) {
        this.sessions.delete(sessionId);
        continue;
      }
      const hasViewers = getViewerCount(sessionId) > 0;
      if (!hasViewers && record.status !== "running" && age > THIRTY_MINUTES) {
        this.sessions.delete(sessionId);
      }
    }
  }
}

export const runtimeSessionRegistry = new RuntimeSessionRegistry();
