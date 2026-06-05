import { Folder, Star, Trash2 } from "lucide-react";
import type { AgentMessages } from "../messages";
import type { ProjectEntry } from "../agentApi";

export function ProjectInlineRow({
  labels,
  project,
  isDefault
}: {
  labels: Pick<AgentMessages, "defaultTag" | "available" | "unavailable">;
  project: ProjectEntry;
  isDefault: boolean;
}) {
  return (
    <div className="inline-project-row">
      <Folder />
      <span>{String(project.root)}</span>
      {isDefault ? <em>{labels.defaultTag}</em> : null}
      <b>{project.available ? labels.available : labels.unavailable}</b>
    </div>
  );
}

export function ProjectTableRow({
  busy,
  isDefault,
  labels,
  project,
  onRemove,
  onSetDefault
}: {
  busy: boolean;
  isDefault: boolean;
  labels: Pick<AgentMessages, "defaultTag" | "setDefault" | "remove">;
  project: ProjectEntry;
  onRemove: (projectId: string) => void;
  onSetDefault: (projectId: string) => void;
}) {
  return (
    <div className="project-table-row">
      <Folder />
      <span>{String(project.root)}</span>
      {isDefault ? <em>{labels.defaultTag}</em> : null}
      <button aria-label={`${labels.setDefault} ${project.display_name}`} onClick={() => onSetDefault(project.project_id)} type="button">
        <Star />
      </button>
      <button aria-label={`${labels.remove} ${project.display_name}`} disabled={busy} onClick={() => onRemove(project.project_id)} type="button">
        <Trash2 />
      </button>
    </div>
  );
}
