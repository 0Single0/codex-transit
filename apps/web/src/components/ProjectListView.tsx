import type { ProjectSummary } from "@codex-transit/shared";

export function ProjectListView(props: {
  projects: ProjectSummary[];
  onBack: () => void;
  onSelect: (project: ProjectSummary) => void;
}) {
  return (
    <section className="stack">
      <button className="secondary" onClick={props.onBack}>
        Back to devices
      </button>
      {props.projects.map((project) => (
        <button className="list-row" key={project.projectId} onClick={() => props.onSelect(project)}>
          <span>{project.displayName}</span>
          <span className={project.available ? "status online" : "status"}>
            {project.available ? "Available" : "Unavailable"}
          </span>
        </button>
      ))}
    </section>
  );
}
