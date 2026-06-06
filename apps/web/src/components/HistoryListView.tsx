import type { CodexHistoryItem } from "@codex-transit/shared";
import type { WebMessages } from "../i18n";
import { LoadingSurface } from "./LoadingSurface";
import { PageHeader } from "./PageHeader";

export function HistoryListView(props: {
  labels: WebMessages;
  history: CodexHistoryItem[];
  loading: boolean;
  onBack: () => void;
  onSelect: (item: CodexHistoryItem) => void;
}) {
  return (
    <section className="grid h-full min-h-full grid-rows-[auto_minmax(0,1fr)] overflow-hidden bg-[radial-gradient(circle_at_top,_#ffffff_0%,_#f7fafe_38%,_#edf3f8_100%)] text-slate-900">
        <PageHeader onBack={props.onBack} title={props.labels.history} variant="chat" />
      <LoadingSurface
        className="h-full min-h-0 overflow-hidden"
        isLoading={props.loading}
        overlayClassName="absolute inset-0 z-10 flex items-center justify-center bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.72)_0%,_rgba(247,250,254,0.78)_38%,_rgba(237,243,248,0.82)_100%)]"
      >
        <div className="codex-scrollbar h-full min-h-0 overflow-y-auto px-5 pb-8">
          <div className="space-y-3">
            {!props.loading && !props.history.length ? (
              <div className="rounded-[22px] bg-white/92 px-4 py-5 text-center text-sm leading-6 text-slate-500 shadow-[0_12px_30px_rgba(148,163,184,0.1)] ring-1 ring-white/80">
                {props.labels.noCodexHistory}
              </div>
            ) : null}
            {props.history.map((item) => (
              <button
                className="w-full rounded-[15px] bg-white/94 px-4 py-4 text-left shadow-[0_12px_30px_rgba(148,163,184,0.1)] ring-1 ring-white/80 transition hover:bg-white"
                key={item.codexSessionId}
                onClick={() => props.onSelect(item)}
                type="button"
              >
                <strong className="block truncate text-[15px] font-semibold leading-6 text-slate-900">{item.title}</strong>
                <span className="mt-1.5 block text-[12px] text-[#61759a]">{new Date(item.updatedAt).toLocaleString()}</span>
                {item.preview ? <span className="mt-1.5 line-clamp-2 block text-[12px] leading-5 text-slate-500">{item.preview}</span> : null}
              </button>
            ))}
          </div>
        </div>
      </LoadingSurface>
    </section>
  );
}
