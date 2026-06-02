import type { ProjectSummary, SessionSummary } from "@codex-transit/shared";
import { ChevronLeft, MessageSquareText, Plus } from "lucide-react";
import type { WebMessages } from "../i18n";

export function SessionListView(props: {
  labels: WebMessages;
  project: ProjectSummary;
  sessions: SessionSummary[];
  onBack: () => void;
  onCreate: (title: string) => Promise<void>;
  onSelect: (session: SessionSummary) => void;
}) {
  return (
    <section className="h-full min-h-full px-5 pb-28 pt-4 text-slate-900">
      <header className="grid grid-cols-[44px_1fr_44px] items-center gap-3">
        <button
          className="grid h-11 w-11 place-items-center rounded-full bg-white text-slate-500 shadow-[0_8px_24px_rgba(148,163,184,0.18)]"
          onClick={props.onBack}
          type="button"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <div className="min-w-0 text-center">
          <h1 className="truncate text-base font-semibold">{props.project.displayName}</h1>
          <p className="truncate text-[11px] text-slate-500">{props.project.pathAlias}</p>
        </div>
        <button
          className="grid h-11 w-11 place-items-center rounded-full bg-sky-600 text-white shadow-[0_10px_26px_rgba(14,165,233,0.2)]"
          onClick={() => props.onCreate(props.project.displayName)}
          type="button"
        >
          <Plus className="h-5 w-5" />
        </button>
      </header>

      <div className="mt-6 space-y-3">
        {props.sessions.map((session) => (
          <button
            className="flex w-full items-center gap-4 rounded-[22px] bg-white p-4 text-left shadow-[0_12px_30px_rgba(148,163,184,0.14)] ring-1 ring-slate-200/70 transition hover:bg-slate-50"
            key={session.id}
            onClick={() => props.onSelect(session)}
            type="button"
          >
            <span className="grid h-11 w-11 place-items-center rounded-2xl bg-sky-100 text-sky-700">
              <MessageSquareText className="h-5 w-5" />
            </span>
            <span className="min-w-0 flex-1">
              <strong className="block truncate text-sm font-semibold text-slate-900">{session.title}</strong>
              <small className="text-xs text-slate-500">{session.status}</small>
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}
