import { ProjectEntry } from "../agentApi";
import { ProjectTableRow } from "../components/ProjectRows";
import { TitleBar } from "../components/TitleBar";
import { SettingsSection } from "../uiTypes";
import { SettingsSidebar } from "./SettingsView";

type ProjectsViewProps = {
  busy: boolean;
  defaultProjectId: string | null;
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
      <TitleBar showBack settingsIcon title="项目目录" onBack={onBack} onClose={onClose} />
      <div className="settings-layout">
        <SettingsSidebar active="projects" onProjectSection={() => undefined} onSelect={onNavigateSettings} />
        <div className="settings-content">
          <h2>允许 Codex 访问的项目目录</h2>
          <p>这些目录下的项目可以通过手机端访问和操作</p>
          <div className="project-table">
            {projects.length ? (
              projects.map((project) => (
                <ProjectTableRow
                  busy={busy}
                  isDefault={defaultProjectId === project.project_id}
                  key={project.project_id}
                  project={project}
                  onRemove={onRemoveProject}
                  onSetDefault={onSetDefault}
                />
              ))
            ) : (
              <p className="empty-copy">尚未添加项目目录</p>
            )}
          </div>
          <button className="outline-button" disabled={busy} onClick={onAddProject} type="button">
            添加项目目录
          </button>
          <p className="note">注意：仅在白名单中的目录才会被暴露给远程连接</p>
        </div>
      </div>
    </section>
  );
}
