import type { DeviceSummary, ProjectSummary, SessionSummary } from "@codex-transit/shared";
import { useMemo, useState } from "react";
import { ApiClient } from "./api/client";
import { DeviceListView } from "./components/DeviceListView";
import { LoginView } from "./components/LoginView";
import { ProjectListView } from "./components/ProjectListView";
import { SessionConsole } from "./components/SessionConsole";
import { SessionListView } from "./components/SessionListView";

export function App() {
  const [token, setToken] = useState<string | null>(localStorage.getItem("token"));
  const [devices, setDevices] = useState<DeviceSummary[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<DeviceSummary | null>(null);
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [selectedProject, setSelectedProject] = useState<ProjectSummary | null>(null);
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const api = useMemo(() => new ApiClient(token), [token]);

  async function login(email: string, password: string) {
    const result = await api.login(email, password);
    localStorage.setItem("token", result.token);
    setToken(result.token);
    const deviceList = await new ApiClient(result.token).devices();
    setDevices(deviceList);
  }

  async function refreshDevices() {
    setDevices(await api.devices());
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
          <h1>Remote sessions</h1>
        </div>
        {token ? <button onClick={refreshDevices}>Refresh</button> : null}
      </header>

      {!token ? <LoginView onLogin={login} /> : null}
      {token && !selectedDevice && !selectedSessionId ? (
        <DeviceListView devices={devices} onSelect={selectDevice} />
      ) : null}
      {token && selectedDevice && !selectedProject && !selectedSessionId ? (
        <ProjectListView
          projects={projects}
          onBack={() => setSelectedDevice(null)}
          onSelect={selectProject}
        />
      ) : null}
      {token && selectedProject && !selectedSessionId ? (
        <SessionListView
          project={selectedProject}
          sessions={sessions}
          onBack={() => setSelectedProject(null)}
          onCreate={createSession}
          onSelect={(session) => setSelectedSessionId(session.id)}
        />
      ) : null}
      {token && selectedSessionId ? (
        <SessionConsole
          token={token}
          sessionId={selectedSessionId}
          onSend={(text) => api.sendSessionInput(selectedSessionId, text).then(() => undefined)}
          onStart={() => api.startSession(selectedSessionId).then(() => undefined)}
          onStop={() => api.stopSession(selectedSessionId).then(() => undefined)}
          onRequestDiff={(relativePath) => api.requestDiff(selectedSessionId, relativePath).then(() => undefined)}
        />
      ) : null}
    </main>
  );
}
