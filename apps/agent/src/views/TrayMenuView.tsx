import { Home, LogOut, Settings, SquareMenu } from "lucide-react";
import { AgentDeviceOverview } from "../agentApi";
import type { AgentMessages } from "../messages";
import { AppLogo } from "../components/AppLogo";
import { DeviceCard } from "../components/DeviceCard";

type TrayMenuViewProps = {
  configured: boolean;
  connectionLabel: string;
  device: AgentDeviceOverview;
  labels: AgentMessages;
  runtimeConnected: boolean;
  onExit: () => void;
  onOpenLog: () => void;
  onOpenMain: () => void;
  onOpenSettings: () => void;
};

export function TrayMenuView({
  configured,
  connectionLabel,
  device,
  labels,
  runtimeConnected,
  onExit,
  onOpenLog,
  onOpenMain,
  onOpenSettings
}: TrayMenuViewProps) {
  return (
    <section className="tray-menu">
      <div className="tray-head">
        <AppLogo />
        <div>
          <h2>{labels.appName}</h2>
          <p>
            <span className={`dot ${runtimeConnected ? "green" : "gray"}`} />
            {connectionLabel}
          </p>
        </div>
      </div>
      <DeviceCard active={runtimeConnected} device={device} labels={labels} />
      <nav className="tray-actions" aria-label={labels.trayMenu}>
        <button onClick={onOpenMain} type="button">
          <Home />
          {labels.openMainWindow}
        </button>
        <button onClick={onOpenLog} type="button">
          <SquareMenu />
          {labels.executionLogs}
        </button>
        <button onClick={onOpenSettings} type="button">
          <Settings />
          {labels.settings}
        </button>
        <button className="danger" disabled={!configured} onClick={onExit} type="button">
          <LogOut />
          {labels.exit}
        </button>
      </nav>
    </section>
  );
}
