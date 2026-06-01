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
    <section className="min-h-[calc(100vh-32px)] px-5 pb-28 pt-4 text-white">
      <header className="grid grid-cols-[44px_1fr_44px] items-center">
        <button
          className="grid h-11 w-11 place-items-center rounded-full bg-white/[0.06] text-slate-200"
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
            className="group flex w-full items-center gap-4 rounded-[22px] border border-white/10 bg-[#101822] p-4 text-left transition hover:border-violet-400/40 hover:bg-[#121d29]"
            key={project.projectId}
            onClick={() => props.onSelect(project)}
            type="button"
          >
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-violet-500/10 text-violet-200">
              <FolderGit2 className="h-6 w-6" />
            </span>
            <span className="min-w-0 flex-1">
              <strong className="block truncate text-[15px] font-semibold text-slate-50">{project.displayName}</strong>
              <small className="mt-1 block truncate text-xs text-slate-500">{project.pathAlias}</small>
            </span>
            <span className={`rounded-full px-2.5 py-1 text-[11px] ${project.available ? "bg-emerald-400/10 text-emerald-300" : "bg-slate-500/10 text-slate-400"}`}>
              {project.available ? props.labels.available : props.labels.unavailable}
            </span>
            <ChevronRight className="h-5 w-5 text-slate-600 transition group-hover:text-violet-300" />
          </button>
        ))}
      </div>

      {!props.projects.length ? (
        <div className="mt-6 grid min-h-[360px] place-items-center rounded-[26px] border border-dashed border-white/10 bg-white/[0.03] p-8 text-center text-sm leading-6 text-slate-500">
          {props.labels.noProjects}
        </div>
      ) : null}
    </section>
  );
}
