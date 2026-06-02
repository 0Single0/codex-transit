import { LoaderCircle, Plus, SendHorizontal, ShieldAlert } from "lucide-react";
import { type FormEvent, useEffect, useRef, useState } from "react";
import type { AttachmentItem } from "../conversationItems";
import type { WebMessages } from "../i18n";
import { AttachmentPreview } from "./AttachmentPreview";
import { ComposerApprovalMenu, ComposerPlusMenu, type ApprovalPolicy } from "./ComposerMenus";
import { ModelSelect } from "./ModelSelect";

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
  const [modelMenuOpen, setModelMenuOpen] = useState(false);
  const rootRef = useRef<HTMLFormElement | null>(null);

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setModelMenuOpen(false);
        props.onCloseMenus();
      }
    }

    window.addEventListener("pointerdown", handlePointerDown);
    return () => window.removeEventListener("pointerdown", handlePointerDown);
  }, [props.onCloseMenus]);

  return (
    <form
      className="relative grid gap-4 rounded-[20px] bg-white px-4 pb-4 pt-4 shadow-[0_18px_44px_rgba(148,163,184,0.16)] ring-1 ring-slate-200/80"
      onSubmit={props.onSubmit}
      ref={rootRef}
    >
      {props.attachments.length ? (
        <div className="grid gap-2 rounded-[22px] bg-slate-50 p-2">
          {props.attachments.map((attachment) => (
            <AttachmentPreview attachment={attachment} key={attachment.id} />
          ))}
        </div>
      ) : null}
        <textarea
          className="min-h-[40px] w-full resize-none bg-transparent text-[14px] leading-7 text-slate-900 outline-none placeholder:text-[#9aa6bf]"
          value={props.prompt}
          onChange={(event) => props.onPromptChange(event.target.value)}
          placeholder={props.labels.promptPlaceholder}
          rows={2}
        />
      <div className="grid grid-cols-[1fr_auto] items-end gap-3">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <div className="relative">
            <button
              className="grid h-8 w-8 place-items-center rounded-full bg-[#f4f5f7] text-slate-600 transition hover:bg-slate-200"
              onClick={() => {
                setModelMenuOpen(false);
                props.onTogglePlusMenu();
              }}
              type="button"
            >
              <Plus className="h-5 w-5" />
            </button>
            <ComposerPlusMenu labels={props.labels} onPickFiles={props.onPickFiles} open={props.plusMenuOpen} />
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
            className="inline-flex h-9 items-center gap-2 rounded-full bg-amber-50 px-3.5 text-[12px] font-medium text-amber-700 transition hover:bg-amber-100"
            onClick={() => {
              setModelMenuOpen(false);
              props.onOpenApprovalMenu();
            }}
            type="button"
          >
            <ShieldAlert className="h-4 w-4" />
            <span className="truncate">{currentApprovalLabel}</span>
          </button>

          <ModelSelect
            disabled={props.modelsLoading || props.disabled}
            open={modelMenuOpen}
            options={props.models}
            placeholder={
              props.modelsLoading
                ? props.labels.modelLoading
                : props.modelError
                  ? props.labels.modelLoadFailed
                  : props.labels.selectModel
            }
            value={props.selectedModel}
            onSelect={(value) => {
              props.onModelChange(value);
              setModelMenuOpen(false);
            }}
            onToggle={() => setModelMenuOpen((current) => !current)}
          />
        </div>

        <button
          aria-label={props.labels.send}
          className="grid h-9 w-9 place-items-center self-end rounded-full bg-[#3b82f6] text-white shadow-[0_14px_30px_rgba(59,130,246,0.26)] transition hover:bg-[#2f76ea] disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none"
          disabled={!props.prompt.trim() || props.disabled}
          type="submit"
        >
          {props.sending ? <LoaderCircle className="h-5 w-5 animate-spin" /> : <SendHorizontal className="h-5 w-5" />}
        </button>
      </div>
    </form>
  );
}
