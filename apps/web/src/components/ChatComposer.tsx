import { ChevronDown, LoaderCircle, Plus, SendHorizontal, ShieldAlert } from "lucide-react";
import { type FormEvent } from "react";
import type { AttachmentItem } from "../conversationItems";
import type { WebMessages } from "../i18n";
import { AttachmentPreview } from "./AttachmentPreview";
import { ComposerApprovalMenu, ComposerPlusMenu, type ApprovalPolicy } from "./ComposerMenus";

export type ComposerModelOption = {
  id: string;
  label: string;
  available: boolean;
};

function approvalLabel(labels: WebMessages, value: ApprovalPolicy) {
  if (value === "full") return labels.approvalFull;
  if (value === "auto") return labels.approvalAuto;
  return labels.approvalDefault;
}

export function ChatComposer(props: {
  labels: WebMessages;
  prompt: string;
  disabled: boolean;
  sending: boolean;
  models: ComposerModelOption[];
  modelsLoading: boolean;
  modelError: string | null;
  selectedModel: string | null;
  attachments: AttachmentItem[];
  approvalPolicy: ApprovalPolicy;
  plusMenuOpen: boolean;
  approvalMenuOpen: boolean;
  onPromptChange: (value: string) => void;
  onModelChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onTogglePlusMenu: () => void;
  onOpenApprovalMenu: () => void;
  onCloseMenus: () => void;
  onPickFiles: () => void;
  onSelectApprovalPolicy: (value: ApprovalPolicy) => void;
}) {
  const currentApprovalLabel = approvalLabel(props.labels, props.approvalPolicy);

  return (
    <form
      className="relative grid gap-3 rounded-[28px] border border-white/10 bg-[#11161d]/96 px-3 pb-3 pt-3 shadow-[0_-12px_40px_rgba(0,0,0,0.24)] backdrop-blur"
      onSubmit={props.onSubmit}
    >
      {props.attachments.length ? (
        <div className="grid gap-2 rounded-[20px] bg-white/[0.03] p-2">
          {props.attachments.map((attachment) => (
            <AttachmentPreview attachment={attachment} key={attachment.id} />
          ))}
        </div>
      ) : null}

      <div className="rounded-[22px] bg-white/[0.05] px-3 py-2">
        <textarea
          className="min-h-[72px] w-full resize-none bg-transparent text-[15px] leading-7 text-white outline-none placeholder:text-slate-500"
          value={props.prompt}
          onChange={(event) => props.onPromptChange(event.target.value)}
          placeholder={props.labels.promptPlaceholder}
          rows={3}
        />
      </div>

      <div className="grid grid-cols-[1fr_auto] items-center gap-3">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <div className="relative">
            <button
              className="grid h-10 w-10 place-items-center rounded-full bg-white/[0.06] text-slate-200 transition hover:bg-white/[0.1]"
              onClick={props.onTogglePlusMenu}
              type="button"
            >
              <Plus className="h-5 w-5" />
            </button>
            <ComposerPlusMenu
              labels={props.labels}
              open={props.plusMenuOpen}
              onPickFiles={props.onPickFiles}
            />
            <ComposerApprovalMenu
              labels={props.labels}
              open={props.approvalMenuOpen}
              value={props.approvalPolicy}
              onSelect={(value) => {
                props.onSelectApprovalPolicy(value);
                props.onCloseMenus();
              }}
            />
          </div>

          <button
            className="inline-flex h-10 items-center gap-2 rounded-full border border-[#f08c49]/20 bg-[#f08c49]/10 px-3 text-xs font-medium text-[#f6a66f] transition hover:bg-[#f08c49]/14"
            onClick={props.onOpenApprovalMenu}
            type="button"
          >
            <ShieldAlert className="h-4 w-4" />
            <span className="truncate">{currentApprovalLabel}</span>
          </button>

          <label className="inline-flex min-w-0 max-w-full items-center gap-2 rounded-full bg-white/[0.05] px-3 py-2 text-sm text-slate-300">
            <select
              className="w-auto min-w-0 max-w-full appearance-none bg-transparent pr-1 text-sm text-slate-200 outline-none"
              disabled={props.modelsLoading || props.disabled}
              value={props.selectedModel ?? ""}
              onChange={(event) => props.onModelChange(event.target.value)}
            >
              <option value="" disabled>
                {props.modelsLoading
                  ? props.labels.modelLoading
                  : props.modelError
                    ? props.labels.modelLoadFailed
                    : props.labels.selectModel}
              </option>
              {props.models.map((model) => (
                <option key={model.id} value={model.id} disabled={!model.available}>
                  {model.label}
                </option>
              ))}
            </select>
            <ChevronDown className="h-4 w-4 shrink-0 text-slate-500" />
          </label>
        </div>

        <button
          aria-label={props.labels.send}
          className="grid h-11 w-11 place-items-center rounded-full bg-white text-black transition hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-40"
          disabled={!props.prompt.trim() || props.disabled}
          type="submit"
        >
          {props.sending ? <LoaderCircle className="h-5 w-5 animate-spin" /> : <SendHorizontal className="h-5 w-5" />}
        </button>
      </div>
    </form>
  );
}
