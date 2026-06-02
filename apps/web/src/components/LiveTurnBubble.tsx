import type { LiveTurnState } from "../conversationItems";
import type { WebMessages } from "../i18n";
import { MessageRichText } from "./MessageRichText";

export function LiveTurnBubble(props: {
  liveTurn: LiveTurnState;
  labels: WebMessages;
}) {
  const text = props.liveTurn.errorMessage ?? props.liveTurn.text ?? "";
  const waiting = props.liveTurn.status === "waiting";

  return (
    <article className="w-full px-1 text-left">
      <div className="inline-flex max-w-[88%] items-center gap-3 rounded-full bg-white/88 px-4 py-2 text-sm text-slate-500 shadow-[0_8px_22px_rgba(148,163,184,0.1)] ring-1 ring-slate-200/70">
        {waiting ? (
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-sky-300" />
            <span className="h-2 w-2 rounded-full bg-sky-400" />
            <span className="h-2 w-2 rounded-full bg-sky-300" />
          </span>
        ) : null}
        <span className="min-w-0 text-sm leading-6">
          <MessageRichText text={text || (waiting ? props.labels.modelThinking : "")} tone="codex" />
        </span>
      </div>
    </article>
  );
}
