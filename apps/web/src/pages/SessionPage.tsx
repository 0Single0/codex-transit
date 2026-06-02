import type { CodexHistoryMessage, ProjectSummary, SessionSummary } from "@codex-transit/shared";
import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { connectDeviceStream } from "../api/realtime";
import { useAppState } from "../features/app/AppStateContext";
import { useDeviceModels } from "../features/devices/useDeviceModels";
import { bindHistorySession, readCodexSessionForTransitSession } from "../features/history/historyResumeState";
import { SessionConsoleContainer } from "../features/session/SessionConsoleContainer";
import { buildProjectHistoryPath, buildProjectHomePath } from "../routes";

type SessionPageLocationState = {
  historyMessages?: CodexHistoryMessage[];
  codexSessionId?: string;
};

export function SessionPage() {
  const { deviceId = "", projectId = "", sessionId = "" } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { api, labels, runAuthorized, token } = useAppState();
  const [project, setProject] = useState<ProjectSummary | null>(null);
  const [historyMessages, setHistoryMessages] = useState<CodexHistoryMessage[]>((location.state as SessionPageLocationState | null)?.historyMessages ?? []);
  const [selectedModel, setSelectedModel] = useState<string | null>(null);
  const persistedCodexSessionId = useMemo(
    () => readCodexSessionForTransitSession(sessionId),
    [sessionId]
  );
  const locationState = location.state as SessionPageLocationState | null;
  const codexSessionId = locationState?.codexSessionId ?? persistedCodexSessionId;
  const models = useDeviceModels({
    api,
    deviceId: deviceId || null,
    fallbackError: labels.modelLoadFailed,
    token
  });

  useEffect(() => {
    if (!deviceId || !projectId) return;
    void loadProject();
  }, [deviceId, projectId]);

  useEffect(() => {
    if (!token || !deviceId || !codexSessionId) return;
    if (historyMessages.length) {
      bindHistorySession({
        projectId,
        codexSessionId,
        transitSessionId: sessionId
      });
      return;
    }

    const stream = connectDeviceStream({
      token,
      deviceId,
      onEvent(event) {
        if (event.type !== "codex.history.detail.result" || event.codexSessionId !== codexSessionId) return;
        stream.close();
        if (event.ok) {
          setHistoryMessages(event.messages);
          bindHistorySession({
            projectId,
            codexSessionId,
            transitSessionId: sessionId
          });
        }
      }
    });

    void stream.ready.then(async () => {
      const result = await runAuthorized(() => api.requestCodexHistoryDetail(deviceId, codexSessionId));
      if (!result) {
        stream.close();
      }
    });

    return () => stream.close();
  }, [api, codexSessionId, deviceId, historyMessages.length, projectId, runAuthorized, sessionId, token]);

  async function loadProject() {
    const result = await runAuthorized(() => api.deviceProjects(deviceId));
    if (!result) return;
    setProject(result.projects.find((item) => item.projectId === projectId) ?? null);
  }

  if (!token || !project) {
    return <section className="h-full min-h-full px-5 pt-6 text-sm text-slate-500">{labels.modelLoading}</section>;
  }

  return (
    <SessionConsoleContainer
      historyMessages={historyMessages}
      labels={labels}
      modelError={models.error}
      models={models.models}
      modelsLoading={models.loading}
      onBack={() => navigate(buildProjectHomePath(deviceId, projectId))}
      onHistory={() => navigate(buildProjectHistoryPath(deviceId, projectId))}
      onSelectModel={setSelectedModel}
      onSend={async (text, model, options) => {
        await runAuthorized(() => api.sendSessionInput(
          sessionId,
          text,
          codexSessionId ?? undefined,
          model ?? undefined,
          {
            approvalPolicy: options.approvalPolicy,
            attachments: options.attachments.map((attachment) => ({
              name: attachment.name,
              path: attachment.uploadedPath ?? attachment.path,
              ...(attachment.mimeType ? { mimeType: attachment.mimeType } : {}),
              kind: attachment.kind
            }))
          }
        ));
      }}
      onUploadAttachment={async (file) => {
        const result = await runAuthorized(() => api.uploadAttachment(file));
        if (!result) throw new Error(labels.sendFailed);
        return result;
      }}
      projectName={project.displayName}
      projectPath={project.pathAlias}
      selectedModel={selectedModel ?? models.defaultModel ?? null}
      sessionId={sessionId}
      token={token}
    />
  );
}
