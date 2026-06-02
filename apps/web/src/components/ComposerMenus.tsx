import { Check, ChevronRight, Paperclip, ShieldAlert, Sparkles, Target } from "lucide-react";

export type ApprovalPolicy = "default" | "auto" | "full";

export function ComposerPlusMenu(props: {
  open: boolean;
  planMode: boolean;
  onTogglePlanMode: () => void;
  onPickFiles: () => void;
  onOpenApprovalMenu: () => void;
}) {
  if (!props.open) return null;

  return (
    <div className="absolute bottom-[calc(100%+12px)] left-0 z-30 w-64 rounded-3xl border border-white/10 bg-[#171717] p-3 shadow-[0_22px_60px_rgba(0,0,0,0.48)]">
      <button
        className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left text-sm text-slate-100 transition hover:bg-white/[0.06]"
        onClick={props.onPickFiles}
        type="button"
      >
        <Paperclip className="h-4 w-4" />
        添加照片和文件
      </button>
      <button
        className="mt-1 flex w-full items-center justify-between rounded-2xl px-3 py-3 text-left text-sm text-slate-100 transition hover:bg-white/[0.06]"
        onClick={props.onTogglePlanMode}
        type="button"
      >
        <span className="flex items-center gap-3">
          <Sparkles className="h-4 w-4" />
          计划模式
        </span>
        <Toggle checked={props.planMode} />
      </button>
      <button
        className="mt-1 flex w-full items-center justify-between rounded-2xl px-3 py-3 text-left text-sm text-slate-100 transition hover:bg-white/[0.06]"
        type="button"
      >
        <span className="flex items-center gap-3">
          <Target className="h-4 w-4" />
          追求目标
        </span>
        <Toggle checked={false} />
      </button>
      <button
        className="mt-1 flex w-full items-center justify-between rounded-2xl px-3 py-3 text-left text-sm text-slate-100 transition hover:bg-white/[0.06]"
        onClick={props.onOpenApprovalMenu}
        type="button"
      >
        <span className="flex items-center gap-3">
          <ShieldAlert className="h-4 w-4" />
          权限设置
        </span>
        <ChevronRight className="h-4 w-4 text-slate-500" />
      </button>
    </div>
  );
}

export function ComposerApprovalMenu(props: {
  open: boolean;
  value: ApprovalPolicy;
  onSelect: (value: ApprovalPolicy) => void;
}) {
  if (!props.open) return null;

  const options: Array<{ value: ApprovalPolicy; label: string }> = [
    { value: "default", label: "默认权限" },
    { value: "auto", label: "自动审查" },
    { value: "full", label: "完全访问权限" }
  ];

  return (
    <div className="absolute bottom-[calc(100%+12px)] left-0 z-40 w-56 rounded-3xl border border-white/10 bg-[#171717] p-3 shadow-[0_22px_60px_rgba(0,0,0,0.48)]">
      {options.map((option) => (
        <button
          className="flex w-full items-center justify-between rounded-2xl px-3 py-3 text-left text-sm text-slate-100 transition hover:bg-white/[0.06]"
          key={option.value}
          onClick={() => props.onSelect(option.value)}
          type="button"
        >
          {option.label}
          {props.value === option.value ? <Check className="h-4 w-4 text-white" /> : null}
        </button>
      ))}
    </div>
  );
}

function Toggle(props: { checked: boolean }) {
  return (
    <span className={`flex h-6 w-10 items-center rounded-full px-1 transition ${props.checked ? "bg-white" : "bg-white/15"}`}>
      <span className={`h-4 w-4 rounded-full transition ${props.checked ? "translate-x-4 bg-black" : "translate-x-0 bg-white"}`} />
    </span>
  );
}
