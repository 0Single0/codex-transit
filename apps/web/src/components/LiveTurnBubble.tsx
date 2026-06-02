import type { LiveTurnState } from "../conversationItems";

export function LiveTurnBubble(props: {
  liveTurn: LiveTurnState;
}) {
  const text = props.liveTurn.errorMessage
    ?? props.liveTurn.text
    ?? "";
  const waiting = props.liveTurn.status === "waiting";
  return (
    <article className="mr-auto grid max-w-[88%] gap-2 rounded-[22px] border border-white/10 bg-[#101822] px-4 py-3 text-slate-100">
      <pre className="whitespace-pre-wrap break-words font-mono text-[13px] leading-6">
        {text || (waiting ? "思考中..." : "")}
      </pre>
    </article>
  );
}
