import { ArrowLeft, Maximize, Minus, Settings, X } from "lucide-react";
import type { AgentMessages } from "../messages";
import { hideWindow, minimizeWindow, startWindowDrag, toggleMaximizeWindow } from "../windowActions";
import { AppLogo } from "./AppLogo";

type TitleBarProps = {
  title: string;
  closeOnly?: boolean;
  showBack?: boolean;
  settingsIcon?: boolean;
  labels?: Pick<AgentMessages, "back" | "minimize" | "maximize" | "closeWindow">;
  onBack?: () => void;
  onClose?: () => void;
  onMaximize?: () => void;
  onMinimize?: () => void;
};

export function TitleBar({
  title,
  closeOnly = false,
  showBack = false,
  settingsIcon = false,
  labels,
  onBack,
  onClose,
  onMaximize,
  onMinimize
}: TitleBarProps) {
  const closeAction = onClose ?? hideWindow;
  const maximizeAction = onMaximize ?? (() => void toggleMaximizeWindow());
  const minimizeAction = onMinimize ?? minimizeWindow;

  return (
    <header className="window-titlebar">
      <div className="title-identity" onMouseDown={startWindowDrag}>
        {showBack ? (
          <button className="back-button" aria-label={labels?.back ?? "Back"} onClick={onBack} onMouseDown={stopMouseDown} type="button">
            <ArrowLeft />
          </button>
        ) : settingsIcon ? (
          <Settings />
        ) : (
          <AppLogo size="tiny" />
        )}
        <span>{title}</span>
      </div>
      <div className="titlebar-drag-region" onMouseDown={startWindowDrag} />
      <div className="window-controls">
        {!closeOnly ? (
          <>
            <button aria-label={labels?.minimize ?? "Minimize"} onClick={minimizeAction} onMouseDown={stopMouseDown} type="button">
              <Minus />
            </button>
            <button aria-label={labels?.maximize ?? "Maximize"} onClick={maximizeAction} onMouseDown={stopMouseDown} type="button">
              <Maximize />
            </button>
          </>
        ) : null}
        <button aria-label={labels?.closeWindow ?? "Close"} onClick={closeAction} onMouseDown={stopMouseDown} type="button">
          <X />
        </button>
      </div>
    </header>
  );
}

function stopMouseDown(event: React.MouseEvent) {
  event.stopPropagation();
}
