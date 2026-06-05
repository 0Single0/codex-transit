import { Check, ChevronDown, Folder, Info, ScrollText, Settings } from "lucide-react";
import { AgentCommandLogEntry, AgentRuntimeStatus } from "../agentApi";
import type { AgentMessages } from "../messages";
import { AppLogo } from "../components/AppLogo";
import { TitleBar } from "../components/TitleBar";
import { useEffect, useRef, useState } from "react";
import { LocalePreference, LogLevel, Preferences, SettingsSection, ThemePreference } from "../uiTypes";

type SettingsViewProps = {
  activeSection: SettingsSection;
  busy: boolean;
  error: string | null;
  labels: AgentMessages;
  preferences: Preferences;
  runtime: AgentRuntimeStatus;
  onBack: () => void;
  onClose: () => void;
  onPreferenceChange: <Key extends keyof Preferences>(key: Key, value: Preferences[Key]) => void;
  onProjectSection: () => void;
  onSectionChange: (section: SettingsSection) => void;
};

export function SettingsView({
  activeSection,
  busy,
  error,
  labels,
  preferences,
  runtime,
  onBack,
  onClose,
  onPreferenceChange,
  onProjectSection,
  onSectionChange
}: SettingsViewProps) {
  return (
    <section className="window settings-window">
      <TitleBar labels={labels} settingsIcon showBack title={labels.settings} onBack={onBack} onClose={onClose} />
      <div className="settings-layout">
        <SettingsSidebar active={activeSection} labels={labels} onProjectSection={onProjectSection} onSelect={onSectionChange} />
        {activeSection === "logs" ? (
          <LogPanel error={error} labels={labels} runtime={runtime} />
        ) : activeSection === "about" ? (
          <AboutPanel labels={labels} />
        ) : (
          <GeneralPanel busy={busy} labels={labels} preferences={preferences} onPreferenceChange={onPreferenceChange} />
        )}
      </div>
    </section>
  );
}

export function SettingsSidebar({
  active,
  labels,
  onProjectSection,
  onSelect
}: {
  active: SettingsSection | "projects";
  labels: AgentMessages;
  onProjectSection: () => void;
  onSelect: (section: SettingsSection) => void;
}) {
  const items = [
    { key: "general" as const, label: labels.general, icon: <Settings />, onClick: () => onSelect("general") },
    { key: "projects" as const, label: labels.projects, icon: <Folder />, onClick: onProjectSection },
    { key: "logs" as const, label: labels.logs, icon: <ScrollText />, onClick: () => onSelect("logs") },
    { key: "about" as const, label: labels.about, icon: <Info />, onClick: () => onSelect("about") }
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
  labels,
  preferences,
  onPreferenceChange
}: {
  busy: boolean;
  labels: AgentMessages;
  preferences: Preferences;
  onPreferenceChange: <Key extends keyof Preferences>(key: Key, value: Preferences[Key]) => void;
}) {
  return (
    <div className="settings-content">
      <h2>{labels.general}</h2>
      <div className="switch-list">
        <CheckboxRow checked={preferences.autostart} label={labels.launchOnStartup} onChange={(value) => onPreferenceChange("autostart", value)} />
        <CheckboxRow checked={preferences.minimizeToTray} label={labels.minimizeToTray} onChange={(value) => onPreferenceChange("minimizeToTray", value)} />
        <CheckboxRow checked={preferences.autoUpdate} label={labels.autoUpdate} onChange={(value) => onPreferenceChange("autoUpdate", value)} />
      </div>
      <div className="select-row">
        <span>{labels.theme}</span>
        <CustomSelect
          options={[
            { value: "system", label: labels.themeSystem },
            { value: "light", label: labels.themeLight },
            { value: "dark", label: labels.themeDark }
          ]}
          value={preferences.theme}
          onChange={(value) => onPreferenceChange("theme", value as ThemePreference)}
        />
      </div>
      <div className="select-row">
        <span>{labels.logLevel}</span>
        <CustomSelect
          options={[
            { value: "info", label: labels.info },
            { value: "debug", label: labels.debug },
            { value: "warn", label: labels.warn },
            { value: "error", label: labels.error }
          ]}
          value={preferences.logLevel}
          onChange={(value) => onPreferenceChange("logLevel", value as LogLevel)}
        />
      </div>
      <div className="select-row">
        <span>{labels.language}</span>
        <p className="language-hint">{labels.languageHint}</p>
        <CustomSelect
          options={[
            { value: "zh", label: labels.languageChinese },
            { value: "en", label: labels.languageEnglish }
          ]}
          value={preferences.locale}
          onChange={(value) => onPreferenceChange("locale", value as LocalePreference)}
        />
      </div>
    </div>
  );
}

function LogPanel({
  error,
  labels,
  runtime
}: {
  error: string | null;
  labels: AgentMessages;
  runtime: AgentRuntimeStatus;
}) {
  const recentCommands = [...runtime.recentCommands].reverse();

  return (
    <div className="settings-content">
      <h2>{labels.commandLogs}</h2>
      <div className="log-list command-log-list">
        {recentCommands.length ? recentCommands.map((entry) => <CommandLogRow entry={entry} key={entry.itemId} />) : <span>{labels.noCommandActivity}</span>}
        {runtime.lastError ? <span>[error] {runtime.lastError}</span> : null}
      </div>
      {error ? <p className="form-message error">{error}</p> : null}
    </div>
  );
}

function CommandLogRow({ entry }: { entry: AgentCommandLogEntry }) {
  const exitSuffix = typeof entry.exitCode === "number" ? ` (exit ${entry.exitCode})` : "";
  const outputSnippet = entry.output?.trim().replace(/\s+/g, " ").slice(0, 120);

  return (
    <span>
      {`[${entry.status}] ${entry.command}${exitSuffix}${outputSnippet ? ` -> ${outputSnippet}` : ""}`}
    </span>
  );
}

function AboutPanel({ labels }: { labels: AgentMessages }) {
  return (
    <div className="settings-content">
      <h2>{labels.about}</h2>
      <p>{labels.aboutCopy}</p>
      <div className="about-mark">
        <AppLogo size="large" />
        <strong>{labels.appName}</strong>
        <span>{labels.aboutTagline}</span>
      </div>
    </div>
  );
}

function CustomSelect({
  options,
  value,
  onChange
}: {
  options: ReadonlyArray<{ value: string; label: string }>;
  value: string;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const selected = options.find((option) => option.value === value) ?? options[0];

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    window.addEventListener("pointerdown", handlePointerDown);
    return () => window.removeEventListener("pointerdown", handlePointerDown);
  }, []);

  return (
    <div className={`custom-select ${open ? "open" : ""}`} ref={containerRef}>
      <button
        aria-expanded={open}
        className="custom-select-trigger"
        onClick={() => setOpen((current) => !current)}
        type="button"
      >
        <span>{selected?.label}</span>
        <ChevronDown />
      </button>
      {open ? (
        <div className="custom-select-menu" role="listbox">
          {options.map((option) => (
            <button
              aria-selected={value === option.value}
              className={value === option.value ? "active" : ""}
              key={option.value}
              onClick={() => {
                onChange(option.value);
                setOpen(false);
              }}
              role="option"
              type="button"
            >
              <span>{option.label}</span>
              {value === option.value ? <Check /> : null}
            </button>
          ))}
        </div>
      ) : null}
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
