import type { DeviceSummary, ProjectSummary, SessionSummary } from "@codex-transit/shared";
import { useMemo, useState } from "react";
import { ApiClient } from "./api/client";
import { DeviceListView } from "./components/DeviceListView";
import { LoginView } from "./components/LoginView";
import { ProjectListView } from "./components/ProjectListView";
import { SessionConsole } from "./components/SessionConsole";
import { SessionListView } from "./components/SessionListView";
import { Locale, messages } from "./i18n";

export function App() {
  const [locale, setLocale] = useState<Locale>((localStorage.getItem("locale") as Locale | null) ?? "zh");
  const [token, setToken] = useState<string | null>(localStorage.getItem("token"));
  const [devices, setDevices] = useState<DeviceSummary[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<DeviceSummary | null>(null);
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [selectedProject, setSelectedProject] = useState<ProjectSummary | null>(null);
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [bindCode, setBindCode] = useState<{ code: string; expiresAt: string } | null>(null);
  const api = useMemo(() => new ApiClient(token), [token]);
  const labels = messages[locale];

  function changeLocale(nextLocale: Locale) {
    localStorage.setItem("locale", nextLocale);
    setLocale(nextLocale);
  }

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
    setDevices(await api.devices());
  }

  async function createBindCode() {
    const response = await api.createDeviceBindCode();
    setBindCode({ code: response.bindCode, expiresAt: response.expiresAt });
  }

  async function selectDevice(device: DeviceSummary) {
    setSelectedDevice(device);
    const response = await api.deviceProjects(device.id);
    setProjects(response.projects);
  }

  async function selectProject(project: ProjectSummary) {
    setSelectedProject(project);
    setSessions(await api.sessions(project.projectId));
  }

  async function createSession(title: string) {
    if (!selectedDevice || !selectedProject) return;
    const session = await api.createSession(selectedDevice.id, selectedProject.projectId, title);
    setSessions((current) => [session, ...current]);
    setSelectedSessionId(session.id);
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
          {token ? <button onClick={refreshDevices}>{labels.refresh}</button> : null}
        </div>
      </header>

      {!token ? <LoginView labels={labels} onLogin={login} onRegister={register} /> : null}
      {token && !selectedDevice && !selectedSessionId ? (
        <DeviceListView
          bindCode={bindCode}
          devices={devices}
          labels={labels}
          onCreateBindCode={createBindCode}
          onSelect={selectDevice}
        />
      ) : null}
      {token && selectedDevice && !selectedProject && !selectedSessionId ? (
        <ProjectListView
          labels={labels}
          projects={projects}
          onBack={() => setSelectedDevice(null)}
          onSelect={selectProject}
        />
      ) : null}
      {token && selectedProject && !selectedSessionId ? (
        <SessionListView
          labels={labels}
          project={selectedProject}
          sessions={sessions}
          onBack={() => setSelectedProject(null)}
          onCreate={createSession}
          onSelect={(session) => setSelectedSessionId(session.id)}
        />
      ) : null}
      {token && selectedSessionId ? (
        <SessionConsole
          labels={labels}
          token={token}
          sessionId={selectedSessionId}
          loadFileChanges={() => api.sessionFileChanges(selectedSessionId)}
          loadMessages={() => api.sessionMessages(selectedSessionId)}
          loadOutput={() => api.sessionOutput(selectedSessionId)}
          onSend={(text) => api.sendSessionInput(selectedSessionId, text).then(() => undefined)}
          onStart={() => api.startSession(selectedSessionId).then(() => undefined)}
          onStop={() => api.stopSession(selectedSessionId).then(() => undefined)}
          onRequestDiff={(relativePath) => api.requestDiff(selectedSessionId, relativePath).then(() => undefined)}
        />
      ) : null}
    </main>
  );
}
