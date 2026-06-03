import { ChevronLeft } from "lucide-react";
import type { ReactNode } from "react";

export function PageHeader(props: {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  rightSlot?: ReactNode;
  variant?: "default" | "chat";
}) {
  const isChatVariant = props.variant === "chat";

  return (
    <header className="px-5 pb-2 pt-5 text-slate-900">
      <div className="grid grid-cols-[44px_1fr_44px] items-center gap-3">
        {props.onBack ? (
          <button
            className={`grid h-9 w-9 place-items-center rounded-full text-slate-500 ${
              isChatVariant
                ? "bg-[#f4f5f7] ring-1 ring-white/80"
                : "bg-[#f4f5f7] "
            }`}
            
            onClick={props.onBack}

            type="button"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
        ) : (
          <span />
        )}
        <div className="min-w-0 text-center">
          <h1 className={`truncate font-semibold text-slate-900 ${isChatVariant ? "text-[20px] tracking-[-0.02em]" : "text-xl"}`}>{props.title}</h1>
          {props.subtitle ? <p className="mt-1 truncate text-xs text-slate-500">{props.subtitle}</p> : null}
        </div>
        <div className="flex justify-end">{props.rightSlot ?? <span className="h-11 w-11" />}</div>
      </div>
    </header>
  );
}
