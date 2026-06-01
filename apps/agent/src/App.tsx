import { FormEvent, useEffect, useMemo, useState } from "react";
import { createAgentApi, ProjectEntry } from "./agentApi";
import { Locale, messages } from "./i18n";
import { parsePairingPayload } from "./pairing";

export function App() {
  const api = useMemo(() => createAgentApi(), []);
  const [locale, setLocale] = useState<Locale>((localStorage.getItem("agent-locale") as Locale | null) ?? "zh");
  const [serverUrl, setServerUrl] = useState("");
  const [deviceId, setDeviceId] = useState("");
  const [deviceToken, setDeviceToken] = useState("");
  const [qrPayload, setQrPayload] = useState("");
  const [bindCode, setBindCode] = useState("");
  const [deviceName, setDeviceName] = useState(
    typeof navigator === "undefined" ? "Desktop Agent" : navigator.userAgent.includes("Mac") ? "Mac Agent" : "Windows Agent"
  );
  const [projectPath, setProjectPath] = useState("");
  const [projects, setProjects] = useState<ProjectEntry[]>([]);
  const [runtimeRunning, setRuntimeRunning] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const configured = Boolean(serverUrl && deviceId && deviceToken);
  const labels = messages[locale];

  function changeLocale(nextLocale: Locale) {
    localStorage.setItem("agent-locale", nextLocale);
    setLocale(nextLocale);
  }

  useEffect(() => {
    void loadInitialState();
  }, []);

  async function loadInitialState() {
    setBusy(true);
    setError(null);
    try {
      const [settings, projectList, runtimeStatus] = await Promise.all([
        api.getSettings(),
        api.listProjects(),
        api.getRuntimeStatus()
      ]);
      if (settings) {
        setServerUrl(settings.serverUrl);
        setDeviceId(settings.deviceId);
        setDeviceToken(settings.deviceToken);
      }
      setProjects(projectList);
      setRuntimeRunning(runtimeStatus.running);
    } catch (caught) {
      setError(toErrorMessage(caught));
    } finally {
      setBusy(false);
    }
  }

  async function saveSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await api.saveSettings({ serverUrl, deviceId, deviceToken });
      setMessage(labels.settingsSaved);
    } catch (caught) {
      setError(toErrorMessage(caught));
    } finally {
      setBusy(false);
    }
  }

  async function bindDevice(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const settings = await api.bindDevice({
        serverUrl,
        bindCode,
        name: deviceName,
        platform: detectPlatform()
      });
      setDeviceId(settings.deviceId);
      setDeviceToken(settings.deviceToken);
      setBindCode("");
      setMessage(labels.paired);
    } catch (caught) {
      setError(toErrorMessage(caught));
    } finally {
      setBusy(false);
    }
  }

  function applyQrPayload() {
    setError(null);
    setMessage(null);
    const payload = parsePairingPayload(qrPayload.trim());
    if (!payload) {
      setError(labels.qrPayloadInvalid);
      return;
    }
    setServerUrl(payload.serverUrl);
    setBindCode(payload.bindCode);
    setQrPayload("");
    setMessage(labels.qrPayloadApplied);
  }

  async function addProject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedPath = projectPath.trim();
    if (!trimmedPath) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const project = await api.addProject(trimmedPath);
      setProjects((current) => [project, ...current]);
      setProjectPath("");
      setMessage(labels.projectAdded);
    } catch (caught) {
      setError(toErrorMessage(caught));
    } finally {
      setBusy(false);
    }
  }

  async function syncProjects() {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await api.syncProjectsNow();
      setMessage(labels.projectsSynced);
    } catch (caught) {
      setError(toErrorMessage(caught));
    } finally {
      setBusy(false);
    }
  }

  async function startRuntime() {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const status = await api.startRuntime();
      setRuntimeRunning(status.running);
      setMessage(labels.runtimeStarted);
    } catch (caught) {
      setError(toErrorMessage(caught));
    } finally {
      setBusy(false);
    }
  }

  async function stopRuntime() {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const status = await api.stopRuntime();
      setRuntimeRunning(status.running);
      setMessage(labels.runtimeStopped);
    } catch (caught) {
      setError(toErrorMessage(caught));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="agent-shell">
      <section className="agent-frame">
        <header className="top-bar">
          <div>
            <p className="eyebrow">Codex Transit Agent</p>
            <h1>{labels.title}</h1>
          </div>
          <div className="actions">
            <label className="language-select">
              {labels.language}
              <select value={locale} onChange={(event) => changeLocale(event.target.value as Locale)}>
                <option value="zh">{labels.chinese}</option>
                <option value="en">{labels.english}</option>
              </select>
            </label>
            <span className={configured ? "status-pill ready" : "status-pill"}>
              {runtimeRunning ? labels.connected : configured ? labels.configured : labels.needsSetup}
            </span>
          </div>
        </header>

        <div className="layout-grid">
          <section className="panel" aria-labelledby="settings-title">
            <h2 id="settings-title">{labels.relayConnection}</h2>
            <div className="form-grid">
              <label>
                {labels.qrPayload}
                <textarea
                  value={qrPayload}
                  onChange={(event) => setQrPayload(event.target.value)}
                  placeholder={labels.qrPayloadPlaceholder}
                  rows={4}
                />
              </label>
              <button className="secondary" disabled={busy || !qrPayload.trim()} onClick={applyQrPayload} type="button">
                {labels.applyQrPayload}
              </button>
            </div>
            <form className="form-grid" onSubmit={bindDevice}>
              <label>
                {labels.pairingCode}
                <input
                  value={bindCode}
                  onChange={(event) => setBindCode(event.target.value)}
                  placeholder={labels.pairingPlaceholder}
                />
              </label>
              <label>
                {labels.deviceName}
                <input
                  value={deviceName}
                  onChange={(event) => setDeviceName(event.target.value)}
                  placeholder={labels.deviceNamePlaceholder}
                />
              </label>
              <button disabled={busy || !serverUrl || !bindCode || !deviceName} type="submit">
                {labels.pairComputer}
              </button>
            </form>
            <p className="hint">{labels.manualHint}</p>
            <form className="form-grid" onSubmit={saveSettings}>
              <label>
                {labels.serverUrl}
                <input
                  value={serverUrl}
                  onChange={(event) => setServerUrl(event.target.value)}
                  placeholder="http://localhost:4000"
                  required
                />
              </label>
              <label>
                {labels.deviceId}
                <input
                  value={deviceId}
                  onChange={(event) => setDeviceId(event.target.value)}
                  placeholder="device id from pairing"
                  required
                />
              </label>
              <label>
                {labels.deviceToken}
                <input
                  value={deviceToken}
                  onChange={(event) => setDeviceToken(event.target.value)}
                  placeholder="device token from pairing"
                  type="password"
                  required
                />
              </label>
              <div className="actions">
                <button disabled={busy} type="submit">
                  {labels.save}
                </button>
                <button className="secondary" disabled={busy || !configured} onClick={syncProjects} type="button">
                  {labels.syncProjects}
                </button>
                <button
                  className="secondary"
                  disabled={busy || !configured || runtimeRunning}
                  onClick={startRuntime}
                  type="button"
                >
                  {labels.startBridge}
                </button>
                <button
                  className="secondary"
                  disabled={busy || !runtimeRunning}
                  onClick={stopRuntime}
                  type="button"
                >
                  {labels.stopBridge}
                </button>
              </div>
            </form>
          </section>

          <section className="panel" aria-labelledby="project-title">
            <h2 id="project-title">{labels.localProjects}</h2>
            <form className="form-grid" onSubmit={addProject}>
              <label>
                {labels.projectDirectory}
                <input
                  value={projectPath}
                  onChange={(event) => setProjectPath(event.target.value)}
                  placeholder="E:\\code\\codex-transit"
                />
              </label>
              <button disabled={busy || !projectPath.trim()} type="submit">
                {labels.addProject}
              </button>
            </form>
            {projects.length ? (
              <ul className="project-list">
                {projects.map((project) => (
                  <li className="project-row" key={project.project_id}>
                    <span className="project-title">{project.display_name}</span>
                    <span className="project-path">{String(project.root)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="empty-state">{labels.noProjects}</p>
            )}
          </section>
        </div>

        {message ? <p className="message">{message}</p> : null}
        {error ? <p className="message error">{error}</p> : null}
      </section>
    </main>
  );
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
