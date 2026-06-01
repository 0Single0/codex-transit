import type { DeviceSummary, ProjectSummary, SessionSummary } from "@codex-transit/shared";
import { useEffect, useMemo, useState } from "react";
import { ApiClient, ApiError } from "./api/client";
import { DeviceListView } from "./components/DeviceListView";
import { LoginView } from "./components/LoginView";
import { ProjectListView } from "./components/ProjectListView";
import { SessionConsole } from "./components/SessionConsole";
import { SessionListView } from "./components/SessionListView";
import { Locale, messages } from "./i18n";
import { parseAgentLoginPayload } from "./pairing";

type Tab = "devices" | "sessions" | "me";

export function App() {
  const [locale, setLocale] = useState<Locale>((localStorage.getItem("locale") as Locale | null) ?? "zh");
  const [token, setToken] = useState<string | null>(localStorage.getItem("token"));
  const [devices, setDevices] = useState<DeviceSummary[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<DeviceSummary | null>(null);
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [selectedProject, setSelectedProject] = useState<ProjectSummary | null>(null);
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("devices");
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scanPayload, setScanPayload] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const api = useMemo(() => new ApiClient(token), [token]);
  const labels = messages[locale];

  function changeLocale(nextLocale: Locale) {
    localStorage.setItem("locale", nextLocale);
    setLocale(nextLocale);
  }

  function resetSession(messageText = labels.sessionExpired) {
    localStorage.removeItem("token");
    setToken(null);
    setDevices([]);
    setSelectedDevice(null);
    setProjects([]);
    setSelectedProject(null);
    setSessions([]);
    setSelectedSessionId(null);
    setActiveTab("devices");
    setScannerOpen(false);
    setScanPayload("");
    setMessage(null);
    setError(messageText);
  }

  async function runAuthorized<T>(operation: () => Promise<T>): Promise<T | null> {
    try {
      return await operation();
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 401) {
        resetSession();
        return null;
      }
      throw caught;
    }
  }

  useEffect(() => {
    if (!token) return;
    void runAuthorized(async () => {
      setDevices(await api.devices());
    });
  }, [api, token]);

  async function login(email: string, password: string) {
    const result = await api.login(email, password);
    localStorage.setItem("token", result.token);
    setToken(result.token);
    const deviceList = await new ApiClient(result.token).devices();
    setDevices(deviceList);
  }

  async function register(email: string, password: string) {
    const result = await api.register(email, password);
    localStorage.setItem("token", result.token);
    setToken(result.token);
    const deviceList = await new ApiClient(result.token).devices();
    setDevices(deviceList);
  }

  async function refreshDevices() {
    await runAuthorized(async () => {
      setDevices(await api.devices());
    });
  }

  async function claimScannedAgent() {
    setError(null);
    setMessage(null);
    const payload = parseAgentLoginPayload(scanPayload.trim());
    if (!payload) {
      setError(labels.invalidAgentQr);
      return;
    }
    const claimed = await runAuthorized(() => api.claimAgentLogin(payload.pairingToken));
    if (!claimed) return;
    setScanPayload("");
    setScannerOpen(false);
    setMessage(labels.pairingClaimed);
    await refreshDevices();
  }

  async function selectDevice(device: DeviceSummary) {
    setSelectedDevice(device);
    const response = await runAuthorized(() => api.deviceProjects(device.id));
    if (!response) return;
    setProjects(response.projects);
  }

  async function selectProject(project: ProjectSummary) {
    setSelectedProject(project);
    await runAuthorized(async () => {
      setSessions(await api.sessions(project.projectId));
    });
  }

  async function createSession(title: string) {
    if (!selectedDevice || !selectedProject) return;
    const session = await runAuthorized(() => api.createSession(selectedDevice.id, selectedProject.projectId, title));
    if (!session) return;
    setSessions((current) => [session, ...current]);
    setSelectedSessionId(session.id);
    setActiveTab("sessions");
  }

  return (
    <main className="app-shell">
      <header className="top-bar">
        <div>
          <p className="eyebrow">Codex Transit</p>
          <h1>{labels.appTitle}</h1>
        </div>
        <div className="actions">
          <label className="language-select">
            {labels.language}
            <select value={locale} onChange={(event) => changeLocale(event.target.value as Locale)}>
              <option value="zh">{labels.chinese}</option>
              <option value="en">{labels.english}</option>
            </select>
          </label>
          {token ? <button onClick={() => setScannerOpen(true)}>{labels.scanAgent}</button> : null}
          {token ? <button onClick={refreshDevices}>{labels.refresh}</button> : null}
        </div>
      </header>

      {!token ? <LoginView labels={labels} onLogin={login} onRegister={register} /> : null}
      {token && scannerOpen ? (
        <section className="panel stack">
          <h2>{labels.scanAgentTitle}</h2>
          <p className="hint">{labels.scanAgentHint}</p>
          <label>
            {labels.scanPayload}
            <textarea value={scanPayload} onChange={(event) => setScanPayload(event.target.value)} rows={5} />
          </label>
          <div className="actions">
            <button disabled={!scanPayload.trim()} onClick={claimScannedAgent} type="button">
              {labels.confirmPairing}
            </button>
            <button className="secondary" onClick={() => setScannerOpen(false)} type="button">
              {labels.backToDevices}
            </button>
          </div>
        </section>
      ) : null}
      {token && activeTab === "devices" && !scannerOpen && !selectedDevice && !selectedSessionId ? (
        <DeviceListView devices={devices} labels={labels} onSelect={selectDevice} />
      ) : null}
      {token && activeTab === "devices" && selectedDevice && !selectedProject && !selectedSessionId ? (
        <ProjectListView
          labels={labels}
          projects={projects}
          onBack={() => setSelectedDevice(null)}
          onSelect={selectProject}
        />
      ) : null}
      {token && activeTab === "devices" && selectedProject && !selectedSessionId ? (
        <SessionListView
          labels={labels}
          project={selectedProject}
          sessions={sessions}
          onBack={() => setSelectedProject(null)}
          onCreate={createSession}
          onSelect={(session) => setSelectedSessionId(session.id)}
        />
      ) : null}
      {token && activeTab === "sessions" && !selectedSessionId ? (
        <section className="panel stack">
          <h2>{labels.tabSessions}</h2>
          <p className="empty-state">{labels.noPrompts}</p>
        </section>
      ) : null}
      {token && activeTab === "sessions" && selectedSessionId ? (
        <SessionConsole
          labels={labels}
          token={token}
          sessionId={selectedSessionId}
          loadFileChanges={async () => (await runAuthorized(() => api.sessionFileChanges(selectedSessionId))) ?? []}
          loadMessages={async () => (await runAuthorized(() => api.sessionMessages(selectedSessionId))) ?? []}
          loadOutput={async () => (await runAuthorized(() => api.sessionOutput(selectedSessionId))) ?? []}
          onSend={async (text) => {
            await runAuthorized(() => api.sendSessionInput(selectedSessionId, text));
          }}
          onStart={async () => {
            await runAuthorized(() => api.startSession(selectedSessionId));
          }}
          onStop={async () => {
            await runAuthorized(() => api.stopSession(selectedSessionId));
          }}
          onRequestDiff={async (relativePath) => {
            await runAuthorized(() => api.requestDiff(selectedSessionId, relativePath));
          }}
        />
      ) : null}
      {token && activeTab === "me" ? (
        <section className="panel stack">
          <h2>{labels.tabMe}</h2>
          <label className="language-select">
            {labels.language}
            <select value={locale} onChange={(event) => changeLocale(event.target.value as Locale)}>
              <option value="zh">{labels.chinese}</option>
              <option value="en">{labels.english}</option>
            </select>
          </label>
        </section>
      ) : null}
      {message ? <p className="message">{message}</p> : null}
      {error ? <p className="message error">{error}</p> : null}
      {token ? (
        <nav className="bottom-nav">
          <button className={activeTab === "devices" ? "active" : ""} onClick={() => setActiveTab("devices")}>
            {labels.tabDevices}
          </button>
          <button className={activeTab === "sessions" ? "active" : ""} onClick={() => setActiveTab("sessions")}>
            {labels.tabSessions}
          </button>
          <button className={activeTab === "me" ? "active" : ""} onClick={() => setActiveTab("me")}>
            {labels.tabMe}
          </button>
        </nav>
      ) : null}
    </main>
  );
}
