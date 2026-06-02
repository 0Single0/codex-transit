import { LoaderCircle, SendHorizontal } from "lucide-react";
import { type FormEvent } from "react";
import type { WebMessages } from "../i18n";

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
  onPromptChange: (value: string) => void;
  onModelChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <form
      className="grid gap-3 rounded-[28px] border border-white/10 bg-[#101822]/95 p-3 shadow-[0_18px_45px_rgba(0,0,0,0.35)]"
      onSubmit={props.onSubmit}
    >
      <div className="rounded-[24px] border border-white/6 bg-black/10 px-4 py-4">
        <textarea
          className="min-h-24 w-full resize-none bg-transparent text-sm leading-6 text-white outline-none placeholder:text-slate-600"
          value={props.prompt}
          onChange={(event) => props.onPromptChange(event.target.value)}
          placeholder={props.labels.promptPlaceholder}
          rows={4}
        />
      </div>
      <div className="grid grid-cols-[1fr_auto] items-center gap-3">
        <label className="flex h-12 items-center rounded-2xl border border-white/8 bg-black/10 px-3">
          <select
            className="w-full bg-transparent text-sm text-slate-200 outline-none"
            disabled={props.modelsLoading || props.disabled}
            value={props.selectedModel ?? ""}
            onChange={(event) => props.onModelChange(event.target.value)}
          >
            <option value="" disabled>
              {props.modelsLoading ? "模型加载中..." : "选择模型"}
            </option>
            {props.models.map((model) => (
              <option key={model.id} value={model.id} disabled={!model.available}>
                {model.label}
              </option>
            ))}
          </select>
        </label>
        <button
          aria-label={props.labels.send}
          className="grid h-12 w-12 place-items-center rounded-full bg-violet-600 text-white transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-40"
          disabled={!props.prompt.trim() || props.disabled}
          type="submit"
        >
          {props.sending ? <LoaderCircle className="h-5 w-5 animate-spin" /> : <SendHorizontal className="h-5 w-5" />}
        </button>
      </div>
    </form>
  );
}
