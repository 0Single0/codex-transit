import { ChevronDown, ChevronRight, TerminalSquare } from "lucide-react";
import { useState } from "react";
import type { ToolCallItem } from "../conversationItems";
import type { WebMessages } from "../i18n";

export function ToolCallCard(props: {
  toolCall: ToolCallItem;
  labels: WebMessages;
}) {
  const { toolCall } = props;
  const [expanded, setExpanded] = useState(false);

  return (
    <section className="overflow-hidden rounded-[18px] bg-white/92 shadow-[0_10px_28px_rgba(148,163,184,0.12)] ring-1 ring-slate-200/80">
      <button
        className="flex w-full items-center gap-3 px-4 py-3 text-left"
        onClick={() => setExpanded((current) => !current)}
        type="button"
      >
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-slate-100 text-slate-500">
          <TerminalSquare className="h-4 w-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-slate-800">{statusLabel(toolCall.status, props.labels)}</span>
          <span className="mt-0.5 block truncate font-mono text-[11px] text-slate-500">{toolCall.command}</span>
        </span>
        <span className="shrink-0 text-slate-400">
          {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </span>
      </button>

      {expanded ? (
        <div className="space-y-3 border-t border-slate-200/80 px-4 py-4">
          <pre className="whitespace-pre-wrap break-words rounded-2xl bg-slate-50 px-3 py-3 font-mono text-[12px] leading-5 text-slate-700">
            {toolCall.command}
          </pre>
          {toolCall.output ? (
            <pre className="codex-scrollbar max-h-56 overflow-auto whitespace-pre-wrap break-words rounded-2xl bg-slate-50 px-3 py-3 font-mono text-[12px] leading-5 text-slate-600">
              {toolCall.output}
            </pre>
          ) : null}
        </div>
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
