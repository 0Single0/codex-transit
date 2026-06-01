import type { ProjectSummary } from "@codex-transit/shared";
import type { WebMessages } from "../i18n";

export function ProjectListView(props: {
  labels: WebMessages;
  projects: ProjectSummary[];
  onBack: () => void;
  onSelect: (project: ProjectSummary) => void;
}) {
  return (
    <section className="stack">
      <button className="secondary" onClick={props.onBack}>
        {props.labels.backToDevices}
      </button>
      {props.projects.map((project) => (
        <button className="list-row" key={project.projectId} onClick={() => props.onSelect(project)}>
          <span>{project.displayName}</span>
          <span className={project.available ? "status online" : "status"}>
            {project.available ? props.labels.available : props.labels.unavailable}
          </span>
        </button>
      ))}
    </section>
  );
}
