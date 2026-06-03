import type { LiveTurnState } from "../conversationItems";
import type { WebMessages } from "../i18n";

export function LiveTurnBubble(props: {
  liveTurn: LiveTurnState;
  labels: WebMessages;
}) {
  const waiting = props.liveTurn.status === "waiting" || props.liveTurn.status === "streaming";
  const failed = props.liveTurn.status === "failed";

  return (
    <article className="w-full px-1 text-left">
      <style>{`
        @keyframes codex-thinking-dot {
          0%, 80%, 100% {
            opacity: 0.28;
            transform: scale(0.72);
          }
          40% {
            opacity: 1;
            transform: scale(1);
          }
        }
      `}</style>
      {waiting ? (
        <div className="inline-flex items-center gap-1.5 px-1 py-1">
          {[0, 1, 2].map((index) => (
            <span
              className="h-1.5 w-1.5 rounded-full bg-[#8dbbff]"
              key={index}
              style={{
                animation: "codex-thinking-dot 1s ease-in-out infinite",
                animationDelay: `${index * 0.16}s`
              }}
            />
          ))}
        </div>
      ) : null}
      {failed ? (
        <div className="text-sm leading-6 text-rose-500">
          {props.liveTurn.errorMessage ?? props.liveTurn.text ?? props.labels.sendFailed}
        </div>
      ) : null}
    </article>
  );
}
