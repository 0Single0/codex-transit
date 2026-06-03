import type { ComponentPropsWithoutRef } from "react";

type LoadingSurfaceProps = ComponentPropsWithoutRef<"div"> & {
  isLoading?: boolean;
  overlayClassName?: string;
  spinnerClassName?: string;
};

export function LoadingSurface(props: LoadingSurfaceProps) {
  const {
    isLoading = false,
    className,
    overlayClassName,
    spinnerClassName,
    children,
    ...rest
  } = props;

  return (
    <div
      {...rest}
      aria-busy={isLoading}
      aria-live={isLoading ? "polite" : undefined}
      className={`${isLoading ? "relative" : ""}${className ? ` ${className}` : ""}`}
    >
      {children}
      {isLoading ? (
        <div className={`absolute inset-0 z-10 flex items-center justify-center ${overlayClassName ?? "bg-white/50"}`}>
          <span
            aria-hidden
            className={`h-7 w-7 animate-spin rounded-full border-2 border-[#5c76b7] border-t-transparent ${spinnerClassName ?? ""}`.trim()}
          />
        </div>
      ) : null}
    </div>
  );
}
