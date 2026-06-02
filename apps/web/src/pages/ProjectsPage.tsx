import type { ProjectSummary } from "@codex-transit/shared";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ProjectListView } from "../components/ProjectListView";
import { useAppState } from "../features/app/AppStateContext";
import { buildDevicesPath, buildProjectHomePath } from "../routes";

export function ProjectsPage() {
  const { deviceId = "" } = useParams();
  const { api, labels, runAuthorized } = useAppState();
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    if (!deviceId) return;
    void loadProjects();
  }, [deviceId]);

  async function loadProjects() {
    const result = await runAuthorized(() => api.deviceProjects(deviceId));
    if (!result) return;
    setProjects(result.projects);
  }

  return (
    <ProjectListView
      labels={labels}
      onBack={() => navigate(buildDevicesPath())}
      onSelect={(project) => navigate(buildProjectHomePath(deviceId, project.projectId))}
      projects={projects}
    />
  );
}
