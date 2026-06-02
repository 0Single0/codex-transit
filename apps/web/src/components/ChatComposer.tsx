import { ChevronDown, LoaderCircle, Plus, SendHorizontal } from "lucide-react";
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

export function ChatComposer(props: {
  labels: WebMessages;
  prompt: string;
  disabled: boolean;
  sending: boolean;
  models: ComposerModelOption[];
  modelsLoading: boolean;
  selectedModel: string | null;
  attachments: AttachmentItem[];
  planMode: boolean;
  approvalPolicy: ApprovalPolicy;
  plusMenuOpen: boolean;
  approvalMenuOpen: boolean;
  onPromptChange: (value: string) => void;
  onModelChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onTogglePlusMenu: () => void;
  onOpenApprovalMenu: () => void;
  onCloseMenus: () => void;
  onTogglePlanMode: () => void;
  onPickFiles: () => void;
  onSelectApprovalPolicy: (value: ApprovalPolicy) => void;
}) {
  return (
    <form
      className="relative grid gap-3 rounded-[28px] bg-[#141414] p-3 shadow-[0_18px_45px_rgba(0,0,0,0.35)]"
      onSubmit={props.onSubmit}
    >
      {props.attachments.length ? (
        <div className="grid gap-2 rounded-[20px] bg-white/[0.03] p-2">
          {props.attachments.map((attachment) => (
            <AttachmentPreview attachment={attachment} key={attachment.id} />
          ))}
        </div>
      ) : null}

      <div className="rounded-[24px] px-2 py-2">
        <textarea
          className="min-h-24 w-full resize-none bg-transparent text-[15px] leading-7 text-white outline-none placeholder:text-slate-600"
          value={props.prompt}
          onChange={(event) => props.onPromptChange(event.target.value)}
          placeholder={props.labels.promptPlaceholder}
          rows={4}
        />
      </div>

      <div className="grid grid-cols-[auto_1fr_auto] items-center gap-3">
        <div className="relative">
          <button
            className="grid h-10 w-10 place-items-center rounded-full bg-white/[0.06] text-slate-200"
            onClick={props.onTogglePlusMenu}
            type="button"
          >
            <Plus className="h-5 w-5" />
          </button>
          <ComposerPlusMenu
            open={props.plusMenuOpen}
            planMode={props.planMode}
            onTogglePlanMode={props.onTogglePlanMode}
            onPickFiles={props.onPickFiles}
            onOpenApprovalMenu={props.onOpenApprovalMenu}
          />
          <ComposerApprovalMenu
            open={props.approvalMenuOpen}
            value={props.approvalPolicy}
            onSelect={(value) => {
              props.onSelectApprovalPolicy(value);
              props.onCloseMenus();
            }}
          />
        </div>

        <div className="flex min-w-0 items-center gap-2 text-sm text-slate-400">
          <label className="flex min-w-0 items-center gap-2 rounded-full bg-white/[0.05] px-3 py-2">
            <select
              className="min-w-0 bg-transparent text-sm text-slate-200 outline-none"
              disabled={props.modelsLoading || props.disabled}
              value={props.selectedModel ?? ""}
              onChange={(event) => props.onModelChange(event.target.value)}
            >
              <option value="" disabled>
                {props.modelsLoading ? props.labels.modelLoading : props.labels.selectModel}
              </option>
              {props.models.map((model) => (
                <option key={model.id} value={model.id} disabled={!model.available}>
                  {model.label}
                </option>
              ))}
            </select>
            <ChevronDown className="h-4 w-4 shrink-0 text-slate-500" />
          </label>
          <span className="truncate text-xs text-[#f08c49]">
            {props.approvalPolicy === "full" ? "完全访问权限" : props.approvalPolicy === "auto" ? "自动审查" : "默认权限"}
          </span>
        </div>

        <button
          aria-label={props.labels.send}
          className="grid h-10 w-10 place-items-center rounded-full bg-white text-black transition hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-40"
          disabled={!props.prompt.trim() || props.disabled}
          type="submit"
        >
          {props.sending ? <LoaderCircle className="h-5 w-5 animate-spin" /> : <SendHorizontal className="h-5 w-5" />}
        </button>
      </div>
    </form>
  );
}
