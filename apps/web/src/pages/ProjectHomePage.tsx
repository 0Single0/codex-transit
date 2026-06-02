import type { ProjectSummary } from "@codex-transit/shared";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAppState } from "../features/app/AppStateContext";
import { useDeviceModels } from "../features/devices/useDeviceModels";
import { SessionConsoleContainer } from "../features/session/SessionConsoleContainer";
import { buildDeviceProjectsPath, buildProjectHistoryPath, buildSessionPath } from "../routes";

export function ProjectHomePage() {
  const { deviceId = "", projectId = "" } = useParams();
  const { api, labels, runAuthorized, token } = useAppState();
  const [project, setProject] = useState<ProjectSummary | null>(null);
  const navigate = useNavigate();
  const models = useDeviceModels({
    api,
    deviceId: deviceId || null,
    fallbackError: labels.modelLoadFailed,
    token
  });

  useEffect(() => {
    if (!deviceId || !projectId) return;
    void loadProjectPage();
  }, [deviceId, projectId]);

  async function loadProjectPage() {
    const projectResult = await runAuthorized(() => api.deviceProjects(deviceId));
    if (!projectResult) return;
    const nextProject = projectResult.projects.find((item) => item.projectId === projectId) ?? null;
    setProject(nextProject);
  }

  if (!project) {
    return <section className="h-full min-h-full px-5 pt-6 text-sm text-slate-500">{labels.loadingHistory}</section>;
  }

  return (
    <SessionConsoleContainer
      allowDraft
      historyMessages={[]}
      labels={labels}
      modelError={models.error}
      models={models.models}
      modelsLoading={models.loading}
      onBack={() => navigate(buildDeviceProjectsPath(deviceId))}
      onCreateRuntimeSession={async () => {
        const result = await runAuthorized(() => api.createRuntimeSession(deviceId, projectId, { mode: "new" }));
        if (!result) throw new Error(labels.sendFailed);
        return result.sessionId;
      }}
      onDraftSessionReady={(sessionId, initialMessage) => {
        navigate(buildSessionPath(deviceId, projectId, sessionId), {
          replace: true,
          state: {
            pendingInitialMessage: initialMessage
          }
        });
      }}
      onHistory={() => navigate(buildProjectHistoryPath(deviceId, projectId))}
      onSelectModel={() => undefined}
      onSend={async () => {
        throw new Error("draft_mode_requires_runtime_session");
      }}
      onUploadAttachment={async (file) => {
        const result = await runAuthorized(() => api.uploadAttachment(file));
        if (!result) throw new Error(labels.sendFailed);
        return result;
      }}
      projectName={project.displayName}
      projectPath={project.pathAlias}
      selectedModel={models.defaultModel ?? null}
      token={token ?? ""}
    />
  );
}
