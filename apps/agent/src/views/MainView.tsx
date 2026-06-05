import { Check, Info, Plus, Rocket, Settings } from "lucide-react";
import type { AgentDeviceOverview, ProjectEntry } from "../agentApi";
import type { AgentMessages } from "../messages";
import { DeviceCard } from "../components/DeviceCard";
import { ProjectInlineRow } from "../components/ProjectRows";
import { TitleBar } from "../components/TitleBar";

type MainViewProps = {
  busy: boolean;
  configured: boolean;
  connectionLabel: string;
  defaultProjectId: string | null;
  device: AgentDeviceOverview;
  labels: AgentMessages;
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
  labels,
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
      <TitleBar labels={labels} title={labels.appName} onClose={onClose} onMaximize={onMaximize} onMinimize={onMinimize} />
      <div className="main-panel">
        <div className="status-heading">
          <span className={`check-badge ${statusTone}`}>
            <Check />
          </span>
          <div>
            <h2>{connectionLabel}</h2>
            <p>{configured ? labels.boundToAccount : labels.signInForMobile}</p>
          </div>
        </div>
        <DeviceCard active={runtimeConnected} device={device} labels={labels} />
        <section className="project-card">
          <h3>{labels.accessibleProjects}</h3>
          {projects.length ? (
            <div className="compact-projects">
              {projects.slice(0, 3).map((project) => (
                <ProjectInlineRow isDefault={defaultProjectId === project.project_id} key={project.project_id} labels={labels} project={project} />
              ))}
            </div>
          ) : (
            <p className="empty-copy">{labels.noProjectsShared}</p>
          )}
          <button className="link-button" disabled={busy} onClick={onAddProject} type="button">
            <Plus />
            {labels.addProjectFolder}
          </button>
        </section>
      </div>
      <footer className="status-footer">
        <span className={`dot ${runtimeConnected ? "green" : "gray"}`} />
        {runtimeConnected ? labels.connected : runtimeRunning ? labels.connecting : labels.paused}
        <div className="footer-actions">
          <button aria-label={labels.settings} onClick={onOpenSettings} type="button">
            <Settings />
          </button>
          <button aria-label={labels.connected} disabled={busy || !configured} onClick={onToggleRuntime} type="button">
            <Rocket />
          </button>
          <button aria-label={labels.about} onClick={onOpenAbout} type="button">
            <Info />
          </button>
        </div>
      </footer>
    </section>
  );
}
