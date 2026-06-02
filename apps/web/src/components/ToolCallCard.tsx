import { TerminalSquare } from "lucide-react";
import type { ToolCallItem } from "../conversationItems";
import type { WebMessages } from "../i18n";

export function ToolCallCard(props: {
  toolCall: ToolCallItem;
  labels: WebMessages;
}) {
  const { toolCall } = props;

  return (
    <section className="space-y-3 rounded-[22px] bg-white px-4 py-4 text-slate-700 shadow-[0_12px_30px_rgba(148,163,184,0.14)] ring-1 ring-slate-200/70">
      <div className="flex items-center gap-2 text-xs text-slate-500">
        <TerminalSquare className="h-4 w-4" />
        <span>{statusLabel(toolCall.status, props.labels)}</span>
      </div>
      <pre className="whitespace-pre-wrap break-words font-mono text-[12px] leading-5 text-slate-700">{toolCall.command}</pre>
      {toolCall.output ? (
        <pre className="codex-scrollbar max-h-56 overflow-auto whitespace-pre-wrap break-words rounded-2xl bg-slate-50 px-3 py-3 font-mono text-[12px] leading-5 text-slate-600">
          {toolCall.output}
        </pre>
      ) : null}
    </section>
  );
}

function statusLabel(status: ToolCallItem["status"], labels: WebMessages) {
  if (status === "in_progress") return labels.commandRunning;
  if (status === "completed") return labels.commandCompleted;
  if (status === "declined") return labels.commandDeclined;
  return labels.commandFailed;
}
