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
    <article className="w-full px-1">
      <div className="relative">
        {waiting ? <span className="mb-2 inline-flex h-1.5 w-1.5 rounded-full bg-sky-500 align-middle shadow-[0_0_0_6px_rgba(14,165,233,0.08)]" /> : null}
        <MessageRichText text={text || (waiting ? props.labels.modelThinking : "")} tone="codex" />
      </div>
    </article>
  );
}
