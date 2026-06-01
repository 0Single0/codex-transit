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
    <section className="min-h-[calc(100vh-32px)] px-5 pb-28 pt-4 text-white">
      <header className="grid grid-cols-[44px_1fr_44px] items-center gap-3">
        <button className="grid h-11 w-11 place-items-center rounded-full bg-white/[0.06]" onClick={props.onBack} type="button">
          <ChevronLeft className="h-5 w-5" />
        </button>
        <div className="min-w-0 text-center">
          <h1 className="truncate text-base font-semibold">{props.project.displayName}</h1>
          <p className="truncate text-[11px] text-slate-500">{props.project.pathAlias}</p>
        </div>
        <button
          className="grid h-11 w-11 place-items-center rounded-full bg-violet-600"
          onClick={() => props.onCreate(props.project.displayName)}
          type="button"
        >
          <Plus className="h-5 w-5" />
        </button>
      </header>

      <div className="mt-6 space-y-3">
        {props.sessions.map((session) => (
          <button
            className="flex w-full items-center gap-4 rounded-[22px] border border-white/10 bg-[#101822] p-4 text-left"
            key={session.id}
            onClick={() => props.onSelect(session)}
            type="button"
          >
            <span className="grid h-11 w-11 place-items-center rounded-2xl bg-violet-500/10 text-violet-200">
              <MessageSquareText className="h-5 w-5" />
            </span>
            <span className="min-w-0 flex-1">
              <strong className="block truncate text-sm font-semibold">{session.title}</strong>
              <small className="text-xs text-slate-500">{session.status}</small>
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}
