import { Folder, Star, Trash2 } from "lucide-react";
import { ProjectEntry } from "../agentApi";

export function ProjectInlineRow({ project, isDefault }: { project: ProjectEntry; isDefault: boolean }) {
  return (
    <div className="inline-project-row">
      <Folder />
      <span>{String(project.root)}</span>
      {isDefault ? <em>默认</em> : null}
      <b>{project.available ? "已允许" : "不可用"}</b>
    </div>
  );
}

export function ProjectTableRow({
  busy,
  isDefault,
  project,
  onRemove,
  onSetDefault
}: {
  busy: boolean;
  isDefault: boolean;
  project: ProjectEntry;
  onRemove: (projectId: string) => void;
  onSetDefault: (projectId: string) => void;
}) {
  return (
    <div className="project-table-row">
      <Folder />
      <span>{String(project.root)}</span>
      {isDefault ? <em>默认</em> : null}
      <button aria-label={`设为默认 ${project.display_name}`} onClick={() => onSetDefault(project.project_id)} type="button">
        <Star />
      </button>
      <button aria-label={`删除 ${project.display_name}`} disabled={busy} onClick={() => onRemove(project.project_id)} type="button">
        <Trash2 />
      </button>
    </div>
  );
}
