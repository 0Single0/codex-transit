import { Check, Info, Plus, Rocket, Settings } from "lucide-react";
import { AgentDeviceOverview, ProjectEntry } from "../agentApi";
import { DeviceCard } from "../components/DeviceCard";
import { ProjectInlineRow } from "../components/ProjectRows";
import { TitleBar } from "../components/TitleBar";

type MainViewProps = {
  busy: boolean;
  configured: boolean;
  connectionLabel: string;
  defaultProjectId: string | null;
  device: AgentDeviceOverview;
  projects: ProjectEntry[];
  runtimeConnected: boolean;
  runtimeRunning: boolean;
  statusTone: string;
  onAddProject: () => void;
  onClose: () => void;
  onMaximize: () => void;
  onMinimize: () => void;
  onOpenAbout: () => void;
  onOpenSettings: () => void;
  onToggleRuntime: () => void;
};

export function MainView({
  busy,
  configured,
  connectionLabel,
  defaultProjectId,
  device,
  projects,
  runtimeConnected,
  runtimeRunning,
  statusTone,
  onAddProject,
  onClose,
  onMaximize,
  onMinimize,
  onOpenAbout,
  onOpenSettings,
  onToggleRuntime
}: MainViewProps) {
  return (
    <section className="window main-window">
      <TitleBar title="Codex Agent" onClose={onClose} onMaximize={onMaximize} onMinimize={onMinimize} />
      <div className="main-panel">
        <div className="status-heading">
          <span className={`check-badge ${statusTone}`}>
            <Check />
          </span>
          <div>
            <h2>{connectionLabel}</h2>
            <p>{configured ? "设备已绑定到你的账号" : "登录后即可从手机端访问"}</p>
          </div>
        </div>
        <DeviceCard device={device} active={runtimeConnected} />
        <section className="project-card">
          <h3>允许访问的项目目录</h3>
          {projects.length ? (
            <div className="compact-projects">
              {projects.slice(0, 3).map((project) => (
                <ProjectInlineRow key={project.project_id} project={project} isDefault={defaultProjectId === project.project_id} />
              ))}
            </div>
          ) : (
            <p className="empty-copy">还没有允许访问的目录</p>
          )}
          <button className="link-button" disabled={busy} onClick={onAddProject} type="button">
            <Plus />
            添加项目目录
          </button>
        </section>
      </div>
      <footer className="status-footer">
        <span className={`dot ${runtimeConnected ? "green" : "gray"}`} />
        {runtimeConnected ? "已连接" : runtimeRunning ? "连接中" : "已暂停"}
        <div className="footer-actions">
          <button aria-label="设置" onClick={onOpenSettings} type="button">
            <Settings />
          </button>
          <button aria-label="刷新连接" onClick={onToggleRuntime} disabled={busy || !configured} type="button">
            <Rocket />
          </button>
          <button aria-label="关于" onClick={onOpenAbout} type="button">
            <Info />
          </button>
        </div>
      </footer>
    </section>
  );
}
