import { Check, Paperclip } from "lucide-react";
import type { WebMessages } from "../i18n";

export type ApprovalPolicy = "default" | "auto" | "full";

export function ComposerPlusMenu(props: {
  labels: WebMessages;
  open: boolean;
  onPickFiles: () => void;
}) {
  if (!props.open) return null;

  return (
    <div className="absolute bottom-[calc(100%+12px)] left-0 z-30 w-56 rounded-3xl border border-white/10 bg-[#171717] p-3 shadow-[0_22px_60px_rgba(0,0,0,0.48)]">
      <button
        className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left text-sm text-slate-100 transition hover:bg-white/[0.06]"
        onClick={props.onPickFiles}
        type="button"
      >
        <Paperclip className="h-4 w-4" />
        {props.labels.addAttachment}
      </button>
    </div>
  );
}

export function ComposerApprovalMenu(props: {
  labels: WebMessages;
  open: boolean;
  value: ApprovalPolicy;
  onSelect: (value: ApprovalPolicy) => void;
}) {
  if (!props.open) return null;

  const options: Array<{ value: ApprovalPolicy; label: string }> = [
    { value: "default", label: props.labels.approvalDefault },
    { value: "auto", label: props.labels.approvalAuto },
    { value: "full", label: props.labels.approvalFull }
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
