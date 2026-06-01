export function toProjectPathAlias(displayName: string) {
  return displayName.trim() || "Project";
}

export function toProjectSummary(project: {
  id: string;
  displayName: string;
  pathAlias: string;
  available: boolean;
}) {
  return {
    projectId: project.id,
    displayName: project.displayName,
    pathAlias: project.pathAlias,
    available: project.available
  };
}
