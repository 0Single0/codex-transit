import { Check, ChevronDown } from "lucide-react";
import type { ComposerModelOption } from "./ChatComposer";

export function ModelSelect(props: {
  open: boolean;
  disabled: boolean;
  options: ComposerModelOption[];
  value: string | null;
  placeholder: string;
  onToggle: () => void;
  onSelect: (value: string) => void;
}) {
  const selectedOption = props.options.find((option) => option.id === props.value);
  const label = selectedOption?.label ?? props.placeholder;

  return (
    <div className="relative">
      <button
        className="inline-flex h-9 w-fit max-w-[48vw] items-center gap-2 rounded-full bg-[#f4f6fa] px-3.5 py-1.5 text-sm text-slate-700 transition hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-50"
        disabled={props.disabled}
        onClick={props.onToggle}
        type="button"
      >
        <span className="truncate">{label}</span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-slate-400 transition ${props.open ? "rotate-180" : ""}`} />
      </button>

      {props.open ? (
        <div className="absolute bottom-[calc(100%+12px)] left-0 z-40 min-w-full overflow-hidden rounded-[22px] bg-white p-1.5 shadow-[0_22px_48px_rgba(148,163,184,0.24)] ring-1 ring-slate-200/80">
          <div className="codex-scrollbar max-h-72 overflow-y-auto">
            {props.options.map((option) => (
              <button
                className="flex w-full items-center justify-between rounded-2xl px-3 py-2 text-left text-sm text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:text-slate-400"
                disabled={!option.available}
                key={option.id}
                onClick={() => props.onSelect(option.id)}
                type="button"
              >
                <span className="truncate">{option.label}</span>
                {props.value === option.id ? <Check className="h-4 w-4 text-sky-600" /> : null}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
