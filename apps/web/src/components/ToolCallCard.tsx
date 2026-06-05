import { TerminalSquare } from "lucide-react";
import type { ToolCallItem } from "../conversationItems";
import type { WebMessages } from "../i18n";

export function ToolCallCard(props: {
  toolCall: ToolCallItem;
  labels: WebMessages;
}) {
  const { toolCall } = props;
  const status = statusMeta(toolCall.status, props.labels);
  const duration = durationText(toolCall);

  return (
    <section className="w-full text-left">
      <div className="flex items-center gap-2 text-[13px] leading-6 text-slate-400">
        <span className={`grid h-4 w-4 shrink-0 place-items-center rounded-[4px] ${status.iconClass}`}>
          <TerminalSquare className="h-3 w-3" />
        </span>
        <span className="min-w-0 truncate">
          <span className={status.labelClass}>{status.label}</span>
          <span className="ml-1 truncate text-slate-400">{toolCall.command}</span>
          {duration ? <span className="ml-1 text-slate-400">{duration}</span> : null}
        </span>
      </div>
    </section>
  );
}

function statusMeta(status: ToolCallItem["status"], labels: WebMessages) {
  if (status === "in_progress") {
    return {
      label: labels.commandRunning,
      labelClass: "text-slate-500",
      iconClass: "bg-slate-100 text-slate-500"
    };
  }

  if (status === "completed") {
    return {
      label: labels.commandCompleted,
      labelClass: "text-slate-400",
      iconClass: "bg-slate-100 text-slate-400"
    };
  }

  if (status === "declined") {
    return {
      label: labels.commandDeclined,
      labelClass: "text-amber-500",
      iconClass: "bg-amber-50 text-amber-500"
    };
  }

  return {
    label: labels.commandFailed,
    labelClass: "text-rose-500",
    iconClass: "bg-rose-50 text-rose-500"
  };
}

function durationText(toolCall: ToolCallItem) {
  if (toolCall.status !== "in_progress") return null;
  return "已持续 1s";
}
