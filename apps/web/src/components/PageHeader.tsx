import { ChevronLeft } from "lucide-react";
import type { ReactNode } from "react";

export function PageHeader(props: {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  rightSlot?: ReactNode;
}) {
  return (
    <header className="px-5 pb-2 pt-5 text-slate-900">
      <div className="grid grid-cols-[44px_1fr_44px] items-center gap-3">
        {props.onBack ? (
          <button
            className="grid h-11 w-11 place-items-center rounded-full bg-white text-slate-500 shadow-[0_8px_24px_rgba(148,163,184,0.18)]"
            onClick={props.onBack}
            type="button"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
        ) : (
          <span />
        )}
        <div className="min-w-0 text-center">
          <h1 className="truncate text-xl font-semibold">{props.title}</h1>
          {props.subtitle ? <p className="mt-1 truncate text-xs text-slate-500">{props.subtitle}</p> : null}
        </div>
        <div className="flex justify-end">{props.rightSlot ?? <span className="h-11 w-11" />}</div>
      </div>
    </header>
  );
}
