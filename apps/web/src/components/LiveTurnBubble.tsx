import type { LiveTurnState } from "../conversationItems";
import type { WebMessages } from "../i18n";

export function LiveTurnBubble(props: {
  liveTurn: LiveTurnState;
  labels: WebMessages;
}) {
  const text = props.liveTurn.errorMessage
    ?? props.liveTurn.text
    ?? "";
  const waiting = props.liveTurn.status === "waiting";

  return (
    <article className="mr-auto grid max-w-[88%] gap-2 rounded-[22px] border border-white/10 bg-[#101822] px-4 py-3 text-slate-100">
      <pre className="whitespace-pre-wrap break-words font-mono text-[13px] leading-6">
        {text || (waiting ? props.labels.modelThinking : "")}
      </pre>
    </article>
  );
}
