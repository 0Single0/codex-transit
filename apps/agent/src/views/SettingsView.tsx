import { Folder, Info, Settings } from "lucide-react";
import { AgentRuntimeStatus, AgentSettings } from "../agentApi";
import { AppLogo } from "../components/AppLogo";
import { TitleBar } from "../components/TitleBar";
import { LogLevel, Preferences, SettingsSection, ThemePreference } from "../uiTypes";

type SettingsViewProps = {
  activeSection: SettingsSection;
  busy: boolean;
  error: string | null;
  message: string;
  preferences: Preferences;
  runtime: AgentRuntimeStatus;
  settings: AgentSettings | null;
  onBack: () => void;
  onClose: () => void;
  onPreferenceChange: <Key extends keyof Preferences>(key: Key, value: Preferences[Key]) => void;
  onProjectSection: () => void;
  onSectionChange: (section: SettingsSection) => void;
};

const API_BASE = import.meta.env.VITE_API_BASE ?? "http://localhost:4000";

export function SettingsView({
  activeSection,
  busy,
  error,
  message,
  preferences,
  runtime,
  settings,
  onBack,
  onClose,
  onPreferenceChange,
  onProjectSection,
  onSectionChange
}: SettingsViewProps) {
  return (
    <section className="window settings-window">
      <TitleBar showBack settingsIcon title="设置" onBack={onBack} onClose={onClose} />
      <div className="settings-layout">
        <SettingsSidebar active={activeSection} onProjectSection={onProjectSection} onSelect={onSectionChange} />
        {activeSection === "connection" ? (
          <ConnectionPanel error={error} message={message} runtime={runtime} settings={settings} />
        ) : activeSection === "about" ? (
          <AboutPanel />
        ) : (
          <GeneralPanel busy={busy} preferences={preferences} onClose={onBack} onPreferenceChange={onPreferenceChange} />
        )}
      </div>
    </section>
  );
}

export function SettingsSidebar({
  active,
  onProjectSection,
  onSelect
}: {
  active: SettingsSection | "projects";
  onProjectSection: () => void;
  onSelect: (section: SettingsSection) => void;
}) {
  const items = [
    { key: "general" as const, label: "通用", icon: <Settings />, onClick: () => onSelect("general") },
    { key: "projects" as const, label: "项目目录", icon: <Folder />, onClick: onProjectSection },
    { key: "connection" as const, label: "连接", icon: <Settings />, onClick: () => onSelect("connection") },
    { key: "about" as const, label: "关于", icon: <Info />, onClick: () => onSelect("about") }
  ];

  return (
    <nav className="settings-sidebar">
      {items.map((item) => (
        <button className={active === item.key ? "active" : ""} key={item.key} onClick={item.onClick} type="button">
          {item.icon}
          {item.label}
        </button>
      ))}
    </nav>
  );
}

function GeneralPanel({
  busy,
  preferences,
  onClose,
  onPreferenceChange
}: {
  busy: boolean;
  preferences: Preferences;
  onClose: () => void;
  onPreferenceChange: <Key extends keyof Preferences>(key: Key, value: Preferences[Key]) => void;
}) {
  return (
    <div className="settings-content">
      <h2>通用</h2>
      <div className="switch-list">
        <CheckboxRow checked={preferences.autostart} label="开机自启动" onChange={(value) => onPreferenceChange("autostart", value)} />
        <CheckboxRow checked={preferences.minimizeToTray} label="最小化到系统托盘" onChange={(value) => onPreferenceChange("minimizeToTray", value)} />
        <CheckboxRow checked={preferences.autoUpdate} label="有更新时自动检查" onChange={(value) => onPreferenceChange("autoUpdate", value)} />
      </div>
      <label className="select-row">
        外观
        <select value={preferences.theme} onChange={(event) => onPreferenceChange("theme", event.target.value as ThemePreference)}>
          <option value="system">跟随系统</option>
          <option value="light">浅色</option>
          <option value="dark">深色</option>
        </select>
      </label>
      <label className="select-row">
        日志级别
        <select value={preferences.logLevel} onChange={(event) => onPreferenceChange("logLevel", event.target.value as LogLevel)}>
          <option value="info">信息</option>
          <option value="debug">调试</option>
          <option value="warn">警告</option>
          <option value="error">错误</option>
        </select>
      </label>
      <div className="form-actions">
        <button className="ghost-button" disabled={busy} onClick={onClose} type="button">
          取消
        </button>
        <button className="primary-small" disabled={busy} onClick={onClose} type="button">
          保存
        </button>
      </div>
    </div>
  );
}

function ConnectionPanel({
  error,
  message,
  runtime,
  settings
}: {
  error: string | null;
  message: string;
  runtime: AgentRuntimeStatus;
  settings: AgentSettings | null;
}) {
  const runtimeText = runtime.connected ? "服务器已确认连接" : runtime.running ? "运行中，等待服务器确认" : "运行时未启动";

  return (
    <div className="settings-content">
      <h2>连接</h2>
      <p>服务器与运行时日志状态会根据本机绑定动态显示</p>
      <div className="server-card">
        <span>服务器地址</span>
        <strong>{settings?.serverUrl || API_BASE}</strong>
      </div>
      <div className="server-card">
        <span>中转连接</span>
        <strong>{runtimeText}</strong>
      </div>
      <div className="log-list">
        <span>{runtimeText}</span>
        {runtime.lastError ? <span>最近错误：{runtime.lastError}</span> : null}
        <span>{settings ? "设备已绑定到当前服务器" : "尚未保存设备绑定"}</span>
      </div>
      {message ? <p className="form-message">{message}</p> : null}
      {error ? <p className="form-message error">{error}</p> : null}
    </div>
  );
}

function AboutPanel() {
  return (
    <div className="settings-content">
      <h2>关于</h2>
      <p>Codex Agent 负责把本机项目安全桥接到移动端。</p>
      <div className="about-mark">
        <AppLogo size="large" />
        <strong>Codex Agent</strong>
        <span>Desktop bridge prototype</span>
      </div>
    </div>
  );
}

function CheckboxRow({ checked, label, onChange }: { checked: boolean; label: string; onChange: (checked: boolean) => void }) {
  return (
    <label className="checkbox-row">
      <input checked={checked} onChange={(event) => onChange(event.target.checked)} type="checkbox" />
      <span>{label}</span>
    </label>
  );
}
