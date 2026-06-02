import { TerminalSquare } from "lucide-react";
import type { ToolCallItem } from "../conversationItems";

export function ToolCallCard(props: { toolCall: ToolCallItem }) {
  const { toolCall } = props;

  return (
    <section className="space-y-2 rounded-2xl bg-white/[0.04] px-3 py-3 text-slate-200">
      <div className="flex items-center gap-2 text-xs text-slate-400">
        <TerminalSquare className="h-4 w-4" />
        <span>{statusLabel(toolCall.status)}</span>
      </div>
      <pre className="whitespace-pre-wrap break-words font-mono text-[12px] leading-5 text-slate-300">{toolCall.command}</pre>
      {toolCall.output ? (
        <pre className="max-h-56 overflow-auto whitespace-pre-wrap break-words rounded-xl bg-black/20 px-3 py-2 font-mono text-[12px] leading-5 text-slate-400">
          {toolCall.output}
        </pre>
      ) : null}
    </section>
  );
}

function statusLabel(status: ToolCallItem["status"]) {
  if (status === "in_progress") return "正在执行命令";
  if (status === "completed") return "命令已完成";
  if (status === "declined") return "命令被拒绝";
  return "命令执行失败";
}
