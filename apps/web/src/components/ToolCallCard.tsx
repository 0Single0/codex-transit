import { TerminalSquare } from "lucide-react";
import type { ToolCallItem } from "../conversationItems";

export function ToolCallCard(props: { toolCall: ToolCallItem }) {
  const { toolCall } = props;

  return (
    <section className="space-y-3 rounded-[22px] border border-white/10 bg-white/[0.03] px-4 py-4 text-slate-200">
      <div className="flex items-center gap-2 text-xs text-slate-400">
        <TerminalSquare className="h-4 w-4" />
        <span>{statusLabel(toolCall.status)}</span>
      </div>
      <pre className="whitespace-pre-wrap break-words font-mono text-[12px] leading-5 text-slate-300">{toolCall.command}</pre>
      {toolCall.output ? (
        <pre className="max-h-56 overflow-auto whitespace-pre-wrap break-words rounded-2xl bg-black/25 px-3 py-3 font-mono text-[12px] leading-5 text-slate-400">
          {toolCall.output}
        </pre>
      ) : null}
    </section>
  );
}

function statusLabel(status: ToolCallItem["status"]) {
  if (status === "in_progress") return "正在执行命令";
  if (status === "completed") return "命令已完成";
  if (status === "declined") return "命令已拒绝";
  return "命令执行失败";
}
