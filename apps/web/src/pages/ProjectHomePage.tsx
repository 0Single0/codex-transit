import type { ProjectSummary, SessionSummary } from "@codex-transit/shared";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { SessionListView } from "../components/SessionListView";
import { useAppState } from "../features/app/AppStateContext";
import { pickProjectEntrySession, shouldCreateSessionOnProjectEntry } from "../projectAutoSession";
import { buildDeviceProjectsPath, buildSessionPath } from "../routes";

export function ProjectHomePage() {
  const { deviceId = "", projectId = "" } = useParams();
  const { api, labels, runAuthorized } = useAppState();
  const [project, setProject] = useState<ProjectSummary | null>(null);
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    if (!deviceId || !projectId) return;
    void loadProjectPage();
  }, [deviceId, projectId]);

  async function loadProjectPage() {
    const projectResult = await runAuthorized(() => api.deviceProjects(deviceId));
    if (!projectResult) return;
    const nextProject = projectResult.projects.find((item) => item.projectId === projectId) ?? null;
    setProject(nextProject);
    if (!nextProject) return;

    let nextSessions = await loadSessions();
    if (shouldCreateSessionOnProjectEntry(nextSessions)) {
      await api.createSession(deviceId, projectId, nextProject.displayName);
      nextSessions = await loadSessions();
    }
    setSessions(nextSessions);
  }

  async function loadSessions() {
    return (await runAuthorized(() => api.sessions(projectId))) ?? [];
  }

  if (!project) {
    return <section className="h-full min-h-full px-5 pt-6 text-sm text-slate-500">{labels.loadingHistory}</section>;
  }

  return (
    <SessionListView
      labels={labels}
      onBack={() => navigate(buildDeviceProjectsPath(deviceId))}
      onCreate={async (title) => {
        const session = await api.createSession(deviceId, projectId, title);
        setSessions((current) => [session, ...current]);
      }}
      onSelect={(session) => navigate(buildSessionPath(deviceId, projectId, session.id))}
      project={project}
      sessions={sessions}
    />
  );
}
