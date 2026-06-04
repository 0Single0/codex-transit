import QRCode from "qrcode";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import {
  AgentDeviceOverview,
  AgentLoginPairing,
  AgentRuntimeStatus,
  AgentSettings,
  ProjectEntry,
  createAgentApi
} from "./agentApi";
import { LoginView } from "./views/LoginView";
import { MainView } from "./views/MainView";
import { ProjectsView } from "./views/ProjectsView";
import { SettingsView } from "./views/SettingsView";
import { TrayMenuView } from "./views/TrayMenuView";
import { defaultPreferences, Preferences, SettingsSection, Surface, surfaceSizes } from "./uiTypes";
import { getCurrentWindowLabel, hideWindow, minimizeWindow, resizeWindowIfRestored, toggleMaximizeWindow } from "./windowActions";

const API_BASE = import.meta.env.VITE_API_BASE ?? "http://localhost:4000";

const defaultDevice: AgentDeviceOverview = {
  name: "正在读取设备名称",
  platform: "unknown",
  osLabel: "正在读取系统信息",
  version: "-"
};

export function App() {
  const api = useMemo(() => createAgentApi(), []);
  const isTrayPopover = getCurrentWindowLabel() === "tray-popover";
  const [surface, setSurface] = useState<Surface>(isTrayPopover ? "tray" : "login");
  const [settingsSection, setSettingsSection] = useState<SettingsSection>("general");
  const [settings, setSettings] = useState<AgentSettings | null>(null);
  const [device, setDevice] = useState<AgentDeviceOverview>(defaultDevice);
  const [deviceName, setDeviceName] = useState(defaultDevice.name);
  const [runtime, setRuntime] = useState<AgentRuntimeStatus>({ running: false, connected: false, lastError: null });
  const [projects, setProjects] = useState<ProjectEntry[]>([]);
  const [preferences, setPreferences] = useState<Preferences>(() => loadPreferences());
  const [email, setEmail] = useState("user@example.com");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loginPairing, setLoginPairing] = useState<AgentLoginPairing | null>(null);
  const [loginQr, setLoginQr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("请先登录并绑定本机设备");
  const [error, setError] = useState<string | null>(null);

  const configured = Boolean(settings?.deviceId && settings?.deviceToken);
  const connectionLabel = runtime.connected ? "已连接" : runtime.running ? "连接中" : configured ? "已绑定，未连接" : "未连接";
  const statusTone = runtime.connected ? "online" : runtime.running ? "idle" : "offline";
  const visibleProjects = orderProjects(projects, preferences.defaultProjectId);

  useEffect(() => {
    void loadInitialState();
  }, []);

  useEffect(() => {
    const unlistenTray = safeListen("agent://show-tray-menu", () => {
      if (isTrayPopover) setSurface("tray");
    });
    const unlistenMain = safeListen("agent://show-main", () => {
      if (!isTrayPopover) setSurface(configured ? "main" : "login");
    });
    const unlistenSettings = safeListen<string>("agent://show-settings", (section) => {
      if (isTrayPopover) return;
      if (!isSettingsSection(section)) return;
      setSettingsSection(section);
      setSurface("settings");
    });
    return () => {
      void unlistenTray.then((unlisten) => unlisten?.());
      void unlistenMain.then((unlisten) => unlisten?.());
      void unlistenSettings.then((unlisten) => unlisten?.());
    };
  }, [configured, isTrayPopover]);

  useEffect(() => {
    if (isTrayPopover) return;
    const [width, height] = surfaceSizes[surface];
    void resizeWindowIfRestored(width, height);
  }, [isTrayPopover, surface]);

  useEffect(() => {
    localStorage.setItem("agent-ui-preferences", JSON.stringify(preferences));
  }, [preferences]);

  useEffect(() => {
    if (!configured) return;
    const refreshRuntimeStatus = async () => {
      try {
        setRuntime(await api.getRuntimeStatus());
      } catch {
        return;
      }
    };
    void refreshRuntimeStatus();
    const interval = window.setInterval(() => void refreshRuntimeStatus(), 1800);
    return () => window.clearInterval(interval);
  }, [api, configured]);

  useEffect(() => {
    if (!loginPairing || configured) return;
    const interval = window.setInterval(() => void pollLoginPairing(loginPairing.pairingToken), 1800);
    return () => window.clearInterval(interval);
  }, [loginPairing?.pairingToken, configured]);

  async function loadInitialState() {
    setBusy(true);
    setError(null);
    try {
      const [nextSettings, nextRuntime, nextProjects, nextDevice] = await Promise.all([
        api.getSettings(),
        api.getRuntimeStatus(),
        api.listProjects(),
        api.getDeviceOverview().catch(() => inferDeviceOverview())
      ]);
      setSettings(nextSettings);
      setRuntime(nextRuntime);
      setProjects(nextProjects);
      setDevice(nextDevice);
      setDeviceName(nextDevice.name);
      if (!isTrayPopover) setSurface(nextSettings ? "main" : "login");
      if (nextSettings && !nextRuntime.running) {
        await ensureRuntime();
      }
    } catch (caught) {
      setError(toErrorMessage(caught));
    } finally {
      setBusy(false);
    }
  }

  async function ensureRuntime() {
    try {
      const status = await api.startRuntime();
      setRuntime(status);
      return status;
    } catch (caught) {
      if (String(caught).includes("already running")) {
        const status = await api.getRuntimeStatus();
        setRuntime(status);
        return status;
      }
      throw caught;
    }
  }

  async function accountLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const login = await api.login(email, password);
      const nextDevice = await api.registerLoggedInDevice(login.token, {
        name: deviceName,
        platform: detectPlatform()
      });
      await applyAgentSettings(nextDevice.deviceId, nextDevice.token);
      setSurface("main");
      setMessage("登录成功，设备已绑定到你的账号");
    } catch {
      setError("登录失败，请检查账号、密码或服务器连接");
    } finally {
      setBusy(false);
    }
  }

  async function createQrLogin() {
    setBusy(true);
    setError(null);
    try {
      const pairing = await api.createLoginPairing({ name: deviceName, platform: detectPlatform() });
      setLoginPairing(pairing);
      setLoginQr(await QRCode.toDataURL(JSON.stringify(pairing.payload), { errorCorrectionLevel: "M", margin: 1, width: 220 }));
      setMessage("登录二维码已生成，等待手机端确认");
    } catch (caught) {
      setError(toErrorMessage(caught));
    } finally {
      setBusy(false);
    }
  }

  async function pollLoginPairing(pairingToken: string) {
    try {
      const status = await api.getLoginPairingStatus(pairingToken);
      if (status.status === "pending") return;
      if (status.status === "expired") {
        setLoginPairing(null);
        setLoginQr(null);
        setError("登录二维码已过期，请重新生成");
        return;
      }
      await applyAgentSettings(status.deviceId, status.token);
      setLoginPairing(null);
      setLoginQr(null);
      setSurface("main");
      setMessage("手机端确认成功，正在连接中转服务器");
    } catch {
      return;
    }
  }

  async function applyAgentSettings(nextDeviceId: string, nextDeviceToken: string) {
    const nextSettings = { serverUrl: API_BASE, deviceId: nextDeviceId, deviceToken: nextDeviceToken };
    await api.saveSettings(nextSettings);
    setSettings(nextSettings);
    setProjects(await api.listProjects());
    await api.syncProjectsNow().catch(() => undefined);
    await ensureRuntime();
  }

  async function addProjectFromPicker() {
    setBusy(true);
    setError(null);
    try {
      const selectedPath = await api.chooseProjectDirectory();
      if (!selectedPath) return;
      const project = await api.addProject(selectedPath);
      setProjects((current) => [project, ...current.filter((item) => item.project_id !== project.project_id)]);
      setPreferences((current) => ({
        ...current,
        defaultProjectId: current.defaultProjectId ?? project.project_id
      }));
      await api.syncProjectsNow().catch(() => undefined);
      if (runtime.running) await api.stopRuntime();
      await ensureRuntime();
      setMessage("项目目录已添加并同步");
    } catch (caught) {
      setError(toErrorMessage(caught));
    } finally {
      setBusy(false);
    }
  }

  async function removeProject(projectId: string) {
    setBusy(true);
    setError(null);
    try {
      await api.removeProject(projectId);
      setProjects((current) => current.filter((project) => project.project_id !== projectId));
      setPreferences((current) => ({
        ...current,
        defaultProjectId: current.defaultProjectId === projectId ? null : current.defaultProjectId
      }));
      await api.syncProjectsNow().catch(() => undefined);
      setMessage("项目目录已移除");
    } catch (caught) {
      setError(toErrorMessage(caught));
    } finally {
      setBusy(false);
    }
  }

  async function toggleRuntime() {
    setBusy(true);
    setError(null);
    try {
      const status = runtime.running ? await api.stopRuntime() : await ensureRuntime();
      setRuntime(status);
      setMessage(status.connected ? "中转服务器已确认连接" : status.running ? "运行时已启动，等待服务器确认" : "运行时已暂停");
    } catch (caught) {
      setError(toErrorMessage(caught));
    } finally {
      setBusy(false);
    }
  }

  async function logout() {
    setBusy(true);
    setError(null);
    try {
      await api.clearSettings();
      setSettings(null);
      setRuntime({ running: false, connected: false, lastError: null });
      setSurface("login");
      setMessage("已退出并清除本机绑定");
    } catch (caught) {
      setError(toErrorMessage(caught));
    } finally {
      setBusy(false);
    }
  }

  function exitApplication() {
    void api.exitApp();
  }

  function openMainFromTray() {
    void api.openMainWindow();
    void api.hideTrayPopover();
  }

  function openSettingsFromTray(section: SettingsSection = "general") {
    void api.openSettingsWindow(section);
  }

  function openSettings(section: SettingsSection = "general") {
    setSettingsSection(section);
    setSurface("settings");
  }

  function updatePreference<Key extends keyof Preferences>(key: Key, value: Preferences[Key]) {
    setPreferences((current) => ({ ...current, [key]: value }));
  }

  return (
    <main className={`agent-root surface-${surface}`} aria-label="Codex Agent">
      {surface === "login" ? (
        <LoginView
          busy={busy}
          email={email}
          error={error}
          loginQr={loginQr}
          password={password}
          showPassword={showPassword}
          onClose={hideWindow}
          onEmailChange={setEmail}
          onPasswordChange={setPassword}
          onQrLogin={createQrLogin}
          onServerSettings={() => openSettings("connection")}
          onSubmit={accountLogin}
          onTogglePassword={() => setShowPassword((value) => !value)}
        />
      ) : null}

      {surface === "main" ? (
        <MainView
          busy={busy}
          configured={configured}
          connectionLabel={connectionLabel}
          defaultProjectId={preferences.defaultProjectId}
          device={device}
          projects={visibleProjects}
          runtimeConnected={runtime.connected}
          runtimeRunning={runtime.running}
          statusTone={statusTone}
          onAddProject={addProjectFromPicker}
          onClose={hideWindow}
          onMaximize={() => void toggleMaximizeWindow()}
          onMinimize={minimizeWindow}
          onOpenAbout={() => openSettings("about")}
          onOpenSettings={() => openSettings("general")}
          onToggleRuntime={toggleRuntime}
        />
      ) : null}

      {surface === "tray" ? (
        <TrayMenuView
          configured={configured}
          connectionLabel={connectionLabel}
          device={device}
          runtimeConnected={runtime.connected}
          onExit={exitApplication}
          onOpenLog={() => openSettingsFromTray("connection")}
          onOpenMain={openMainFromTray}
          onOpenSettings={() => openSettingsFromTray("general")}
        />
      ) : null}

      {surface === "settings" ? (
        <SettingsView
          activeSection={settingsSection}
          busy={busy}
          error={error}
          message={message}
          preferences={preferences}
          runtime={runtime}
          settings={settings}
          onBack={() => setSurface(configured ? "main" : "login")}
          onClose={hideWindow}
          onPreferenceChange={updatePreference}
          onProjectSection={() => setSurface("projects")}
          onSectionChange={setSettingsSection}
        />
      ) : null}

      {surface === "projects" ? (
        <ProjectsView
          busy={busy}
          defaultProjectId={preferences.defaultProjectId}
          projects={visibleProjects}
          onAddProject={addProjectFromPicker}
          onBack={() => setSurface("settings")}
          onClose={hideWindow}
          onNavigateSettings={(section) => {
            setSettingsSection(section);
            setSurface("settings");
          }}
          onRemoveProject={removeProject}
          onSetDefault={(projectId) => updatePreference("defaultProjectId", projectId)}
        />
      ) : null}
    </main>
  );
}

function loadPreferences(): Preferences {
  try {
    const raw = localStorage.getItem("agent-ui-preferences");
    return raw ? { ...defaultPreferences, ...JSON.parse(raw) } : defaultPreferences;
  } catch {
    return defaultPreferences;
  }
}

function orderProjects(projects: ProjectEntry[], defaultProjectId: string | null) {
  return [...projects].sort((left, right) => {
    if (left.project_id === defaultProjectId) return -1;
    if (right.project_id === defaultProjectId) return 1;
    return String(left.root).localeCompare(String(right.root));
  });
}

function inferDeviceOverview(): AgentDeviceOverview {
  const platform = detectPlatform();
  return {
    name: "未知设备",
    platform,
    osLabel: "未知系统信息",
    version: "-"
  };
}

function toErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function detectPlatform(): "windows" | "macos" | "unknown" {
  if (typeof navigator === "undefined") return "unknown";
  const value = navigator.userAgent.toLowerCase();
  if (value.includes("windows")) return "windows";
  if (value.includes("mac")) return "macos";
  return "unknown";
}

function isSettingsSection(value: string): value is SettingsSection {
  return value === "general" || value === "connection" || value === "about";
}

async function safeListen<Payload = void>(event: string, handler: (payload: Payload) => void) {
  try {
    return await listen<Payload>(event, (payload) => handler(payload.payload));
  } catch {
    return undefined;
  }
}
