import { Home, LogOut, Settings, SquareMenu } from "lucide-react";
import { AgentDeviceOverview } from "../agentApi";
import { AppLogo } from "../components/AppLogo";
import { DeviceCard } from "../components/DeviceCard";

type TrayMenuViewProps = {
  configured: boolean;
  connectionLabel: string;
  device: AgentDeviceOverview;
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
          <h2>Codex Agent</h2>
          <p>
            <span className={`dot ${runtimeConnected ? "green" : "gray"}`} />
            {connectionLabel}
          </p>
        </div>
      </div>
      <DeviceCard device={device} active={runtimeConnected} />
      <nav className="tray-actions" aria-label="托盘菜单">
        <button onClick={onOpenMain} type="button">
          <Home />
          打开主界面
        </button>
        <button onClick={onOpenLog} type="button">
          <SquareMenu />
          查看日志
        </button>
        <button onClick={onOpenSettings} type="button">
          <Settings />
          设置
        </button>
        <button className="danger" disabled={!configured} onClick={onExit} type="button">
          <LogOut />
          退出
        </button>
      </nav>
    </section>
  );
}
