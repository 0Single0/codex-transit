import type { ProjectEntry } from "../agentApi";
import type { AgentMessages } from "../messages";
import { ProjectTableRow } from "../components/ProjectRows";
import { TitleBar } from "../components/TitleBar";
import type { SettingsSection } from "../uiTypes";
import { SettingsSidebar } from "./SettingsView";

type ProjectsViewProps = {
  busy: boolean;
  defaultProjectId: string | null;
  labels: AgentMessages;
  projects: ProjectEntry[];
  onAddProject: () => void;
  onBack: () => void;
  onClose: () => void;
  onNavigateSettings: (section: SettingsSection) => void;
  onRemoveProject: (projectId: string) => void;
  onSetDefault: (projectId: string) => void;
};

export function ProjectsView({
  busy,
  defaultProjectId,
  labels,
  projects,
  onAddProject,
  onBack,
  onClose,
  onNavigateSettings,
  onRemoveProject,
  onSetDefault
}: ProjectsViewProps) {
  return (
    <section className="window project-window">
      <TitleBar labels={labels} settingsIcon showBack title={labels.projects} onBack={onBack} onClose={onClose} />
      <div className="settings-layout">
        <SettingsSidebar active="projects" labels={labels} onProjectSection={() => undefined} onSelect={onNavigateSettings} />
        <div className="settings-content">
          <h2>{labels.projectsAvailable}</h2>
          <p>{labels.projectAllowlistHint}</p>
          <div className="project-table">
            {projects.length ? (
              projects.map((project) => (
                <ProjectTableRow
                  busy={busy}
                  isDefault={defaultProjectId === project.project_id}
                  key={project.project_id}
                  labels={labels}
                  onRemove={onRemoveProject}
                  onSetDefault={onSetDefault}
                  project={project}
                />
              ))
            ) : (
              <p className="empty-copy">{labels.noProjectsAdded}</p>
            )}
          </div>
          <button className="outline-button" disabled={busy} onClick={onAddProject} type="button">
            {labels.addProjectFolder}
          </button>
          <p className="note">{labels.allowlistNote}</p>
        </div>
      </div>
    </section>
  );
}
