import type { CodexHistoryItem, ProjectSummary } from "@codex-transit/shared";
import type { ApiClient } from "../../api/client";
import { bindHistorySession, readTransitSessionForHistory } from "./historyResumeState";

export async function openHistoryAsTransitSession(options: {
  api: ApiClient;
  deviceId: string;
  project: ProjectSummary;
  historyItem: CodexHistoryItem;
}) {
  const runtimeSession = await options.api.createRuntimeSession(
    options.deviceId,
    options.project.projectId,
    {
      mode: "history",
      codexSessionId: options.historyItem.codexSessionId
    }
  );

  bindHistorySession({
    projectId: options.project.projectId,
    codexSessionId: options.historyItem.codexSessionId,
    transitSessionId: runtimeSession.sessionId
  });

  return { id: runtimeSession.sessionId };
}
