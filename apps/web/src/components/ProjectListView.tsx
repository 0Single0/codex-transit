import type { ProjectSummary } from "@codex-transit/shared";
import { ChevronLeft, ChevronRight, FolderGit2 } from "lucide-react";
import type { WebMessages } from "../i18n";

export function ProjectListView(props: {
  labels: WebMessages;
  projects: ProjectSummary[];
  onBack: () => void;
  onSelect: (project: ProjectSummary) => void;
}) {
  return (
    <section className="h-full min-h-full px-5 pb-28 pt-4 text-slate-900">
      <header className="grid grid-cols-[44px_1fr_44px] items-center">
        <button
          className="grid h-11 w-11 place-items-center rounded-full bg-white text-slate-500 shadow-[0_8px_24px_rgba(148,163,184,0.18)]"
          onClick={props.onBack}
          type="button"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <h1 className="text-center text-lg font-semibold">{props.labels.projectDirectoryTitle}</h1>
        <span />
      </header>

      <div className="mt-6 space-y-3">
        {props.projects.map((project) => (
          <button
            className="group flex w-full items-center gap-4 rounded-[22px] bg-white p-4 text-left shadow-[0_12px_34px_rgba(148,163,184,0.12)] transition hover:bg-slate-50"
            key={project.projectId}
            onClick={() => props.onSelect(project)}
            type="button"
          >
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-sky-100 text-sky-700">
              <FolderGit2 className="h-6 w-6" />
            </span>
            <span className="min-w-0 flex-1">
              <strong className="block truncate text-[15px] font-semibold text-slate-900">{project.displayName}</strong>
              <small className="mt-1 block truncate text-xs text-slate-500">{project.pathAlias}</small>
            </span>
            <span className={`rounded-full px-2.5 py-1 text-[11px] ${project.available ? "bg-emerald-50 text-emerald-600" : "bg-slate-100 text-slate-500"}`}>
              {project.available ? props.labels.available : props.labels.unavailable}
            </span>
            <ChevronRight className="h-5 w-5 text-slate-400 transition group-hover:text-sky-600" />
          </button>
        ))}
      </div>

      {!props.projects.length ? (
        <div className="mt-6 grid min-h-[360px] place-items-center rounded-[26px] bg-white p-8 text-center text-sm leading-6 text-slate-500 shadow-[0_14px_34px_rgba(148,163,184,0.12)]">
          {props.labels.noProjects}
        </div>
      ) : null}
    </section>
  );
}
