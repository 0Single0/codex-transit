import QRCode from "qrcode";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { AgentLoginPairing, createAgentApi, ProjectEntry } from "./agentApi";
import { Locale, messages } from "./i18n";

const API_BASE = import.meta.env.VITE_API_BASE ?? "http://localhost:4000";

export function App() {
  const api = useMemo(() => createAgentApi(), []);
  const [locale, setLocale] = useState<Locale>((localStorage.getItem("agent-locale") as Locale | null) ?? "zh");
  const [deviceId, setDeviceId] = useState("");
  const [deviceToken, setDeviceToken] = useState("");
  const [deviceName, setDeviceName] = useState(
    typeof navigator === "undefined" ? "Desktop Agent" : navigator.userAgent.includes("Mac") ? "Mac Agent" : "Windows Agent"
  );
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loginPairing, setLoginPairing] = useState<AgentLoginPairing | null>(null);
  const [loginQr, setLoginQr] = useState<string | null>(null);
  const [projects, setProjects] = useState<ProjectEntry[]>([]);
  const [runtimeRunning, setRuntimeRunning] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const configured = Boolean(deviceId && deviceToken);
  const labels = messages[locale];

  function changeLocale(nextLocale: Locale) {
    localStorage.setItem("agent-locale", nextLocale);
    setLocale(nextLocale);
  }

  useEffect(() => {
    void loadInitialState();
  }, []);

  useEffect(() => {
    if (!loginPairing || configured) return;
    const interval = window.setInterval(() => void pollLoginPairing(loginPairing.pairingToken), 1800);
    return () => window.clearInterval(interval);
  }, [loginPairing?.pairingToken, configured]);

  async function loadInitialState() {
    setBusy(true);
    setError(null);
    try {
      const [settings, runtimeStatus] = await Promise.all([api.getSettings(), api.getRuntimeStatus()]);
      if (settings) {
        setDeviceId(settings.deviceId);
        setDeviceToken(settings.deviceToken);
        setProjects(await api.listProjects());
        if (!runtimeStatus.running) {
          const status = await api.startRuntime();
          setRuntimeRunning(status.running);
          return;
        }
      }
      setRuntimeRunning(runtimeStatus.running);
    } catch (caught) {
      setError(toErrorMessage(caught));
    } finally {
      setBusy(false);
    }
  }

  async function accountLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const login = await api.login(email, password);
      const device = await api.registerLoggedInDevice(login.token, {
        name: deviceName,
        platform: detectPlatform()
      });
      await applyAgentSettings(device.deviceId, device.token);
      setMessage(labels.paired);
    } catch (caught) {
      setError(labels.loginFailed);
    } finally {
      setBusy(false);
    }
  }

  async function createQrLogin() {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const pairing = await api.createLoginPairing({ name: deviceName, platform: detectPlatform() });
      setLoginPairing(pairing);
      setLoginQr(await QRCode.toDataURL(JSON.stringify(pairing.payload), { errorCorrectionLevel: "M", margin: 1, width: 220 }));
      setMessage(labels.qrLoginCreated);
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
        setError(labels.qrLoginExpired);
        return;
      }
      await applyAgentSettings(status.deviceId, status.token);
      setLoginPairing(null);
      setLoginQr(null);
      setMessage(labels.paired);
    } catch {
      return;
    }
  }

  async function applyAgentSettings(nextDeviceId: string, nextDeviceToken: string) {
    await api.saveSettings({ serverUrl: API_BASE, deviceId: nextDeviceId, deviceToken: nextDeviceToken });
    setDeviceId(nextDeviceId);
    setDeviceToken(nextDeviceToken);
    setProjects(await api.listProjects());
    await api.syncProjectsNow();
    const status = await api.startRuntime();
    setRuntimeRunning(status.running);
  }

  async function addProjectFromPicker() {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const selectedPath = await api.chooseProjectDirectory();
      if (!selectedPath) return;
      const project = await api.addProject(selectedPath);
      setProjects((current) => [project, ...current.filter((item) => item.project_id !== project.project_id)]);
      await api.syncProjectsNow();
      if (runtimeRunning) {
        await api.stopRuntime();
      }
      const status = await api.startRuntime();
      setRuntimeRunning(status.running);
      setMessage(labels.projectAdded);
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
              {runtimeRunning ? labels.connected : configured ? labels.signedIn : labels.needsSetup}
            </span>
          </div>
        </header>

        {!configured ? (
          <div className="layout-grid">
            <section className="panel" aria-labelledby="agent-login-title">
              <h2 id="agent-login-title">{labels.agentLogin}</h2>
              <label>
                {labels.deviceName}
                <input
                  value={deviceName}
                  onChange={(event) => setDeviceName(event.target.value)}
                  placeholder={labels.deviceNamePlaceholder}
                />
              </label>
              <form className="form-grid" onSubmit={accountLogin}>
                <h2>{labels.accountLogin}</h2>
                <label>
                  {labels.email}
                  <input value={email} onChange={(event) => setEmail(event.target.value)} type="email" />
                </label>
                <label>
                  {labels.password}
                  <input value={password} onChange={(event) => setPassword(event.target.value)} type="password" />
                </label>
                <button disabled={busy || !email || !password || !deviceName} type="submit">
                  {labels.login}
                </button>
              </form>
            </section>

            <section className="panel" aria-labelledby="qr-login-title">
              <h2 id="qr-login-title">{labels.qrLogin}</h2>
              <p className="hint">{labels.qrLoginHint}</p>
              <button className="secondary" disabled={busy || !deviceName} onClick={createQrLogin} type="button">
                {labels.createLoginQr}
              </button>
              {loginQr ? (
                <div className="login-qr">
                  <img alt={labels.qrLogin} src={loginQr} />
                  <span>{labels.waitingForScan}</span>
                </div>
              ) : null}
            </section>
          </div>
        ) : (
          <div className="layout-grid">
            <section className="panel" aria-labelledby="project-title">
              <h2 id="project-title">{labels.localProjects}</h2>
              <button disabled={busy} onClick={addProjectFromPicker} type="button">
                {labels.addProject}
              </button>
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

            <section className="panel" aria-label={labels.syncProjects}>
              <p className="hint">{runtimeRunning ? labels.bridgeAutoRunning : labels.bridgeAutoStarting}</p>
            </section>
          </div>
        )}

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
