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
    <article className="mr-auto max-w-[92%]">
      <pre className="whitespace-pre-wrap break-words font-sans text-[15px] leading-7 text-slate-100">
        {text || (waiting ? props.labels.modelThinking : "")}
      </pre>
    </article>
  );
}
