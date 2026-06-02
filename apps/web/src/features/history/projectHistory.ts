import type { CodexHistoryItem, ProjectSummary, SessionSummary } from "@codex-transit/shared";
import type { ApiClient } from "../../api/client";
import { bindHistorySession, readTransitSessionForHistory } from "./historyResumeState";

export async function openHistoryAsTransitSession(options: {
  api: ApiClient;
  deviceId: string;
  project: ProjectSummary;
  sessions: SessionSummary[];
  historyItem: CodexHistoryItem;
}) {
  const linkedSessionId = readTransitSessionForHistory(options.project.projectId, options.historyItem.codexSessionId);
  const existingByLink = linkedSessionId
    ? options.sessions.find((session) => session.id === linkedSessionId)
    : null;
  const existingByTitle = options.sessions.find((session) => session.title === options.historyItem.title);
  const existing = existingByLink ?? existingByTitle ?? null;

  const session = existing ?? await options.api.createSession(
    options.deviceId,
    options.project.projectId,
    options.historyItem.title
  );

  bindHistorySession({
    projectId: options.project.projectId,
    codexSessionId: options.historyItem.codexSessionId,
    transitSessionId: session.id
  });

  return session;
}
