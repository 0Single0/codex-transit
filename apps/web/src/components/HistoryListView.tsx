import type { CodexHistoryItem } from "@codex-transit/shared";
import type { WebMessages } from "../i18n";
import { PageHeader } from "./PageHeader";

export function HistoryListView(props: {
  labels: WebMessages;
  history: CodexHistoryItem[];
  loading: boolean;
  onBack: () => void;
  onSelect: (item: CodexHistoryItem) => void;
}) {
  return (
    <section className="h-full min-h-full px-5 pb-28 pt-4 text-slate-900">
      <PageHeader onBack={props.onBack} title={props.labels.history} />
      <p className="mt-4 rounded-2xl bg-white px-4 py-3 text-sm leading-6 text-slate-500 shadow-[0_12px_34px_rgba(148,163,184,0.12)]">
        {props.labels.historyHint}
      </p>
      <div className="mt-4 space-y-3">
        {props.loading ? (
          <div className="rounded-[22px] bg-white px-4 py-6 text-center text-sm text-slate-500 shadow-[0_12px_34px_rgba(148,163,184,0.12)]">
            {props.labels.loadingHistory}
          </div>
        ) : null}
        {!props.loading && !props.history.length ? (
          <div className="rounded-[22px] bg-white px-4 py-6 text-center text-sm text-slate-500 shadow-[0_12px_34px_rgba(148,163,184,0.12)]">
            {props.labels.noCodexHistory}
          </div>
        ) : null}
        {props.history.map((item) => (
          <button
            className="w-full rounded-[22px] bg-white px-4 py-4 text-left shadow-[0_12px_34px_rgba(148,163,184,0.12)]"
            key={item.codexSessionId}
            onClick={() => props.onSelect(item)}
            type="button"
          >
            <strong className="block truncate text-sm font-semibold">{item.title}</strong>
            <span className="mt-1 block text-xs text-slate-500">{new Date(item.updatedAt).toLocaleString()}</span>
            {item.preview ? <span className="mt-2 line-clamp-2 block text-xs leading-5 text-slate-500">{item.preview}</span> : null}
          </button>
        ))}
      </div>
    </section>
  );
}
