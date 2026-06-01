import { FormEvent, useEffect, useMemo, useState } from "react";
import { createAgentApi, ProjectEntry } from "./agentApi";

export function App() {
  const api = useMemo(() => createAgentApi(), []);
  const [serverUrl, setServerUrl] = useState("");
  const [deviceId, setDeviceId] = useState("");
  const [deviceToken, setDeviceToken] = useState("");
  const [projectPath, setProjectPath] = useState("");
  const [projects, setProjects] = useState<ProjectEntry[]>([]);
  const [runtimeRunning, setRuntimeRunning] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const configured = Boolean(serverUrl && deviceId && deviceToken);

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
      setMessage("Connection settings saved.");
    } catch (caught) {
      setError(toErrorMessage(caught));
    } finally {
      setBusy(false);
    }
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
      setMessage("Project added.");
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
      setMessage("Projects synced to the relay server.");
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
      setMessage("Agent runtime started.");
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
      setMessage("Agent runtime stopped.");
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
            <h1>Desktop bridge</h1>
          </div>
          <span className={configured ? "status-pill ready" : "status-pill"}>
            {runtimeRunning ? "Connected" : configured ? "Configured" : "Needs setup"}
          </span>
        </header>

        <div className="layout-grid">
          <section className="panel" aria-labelledby="settings-title">
            <h2 id="settings-title">Relay connection</h2>
            <form className="form-grid" onSubmit={saveSettings}>
              <label>
                Server URL
                <input
                  value={serverUrl}
                  onChange={(event) => setServerUrl(event.target.value)}
                  placeholder="http://localhost:4000"
                  required
                />
              </label>
              <label>
                Device ID
                <input
                  value={deviceId}
                  onChange={(event) => setDeviceId(event.target.value)}
                  placeholder="device id from pairing"
                  required
                />
              </label>
              <label>
                Device token
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
                  Save
                </button>
                <button className="secondary" disabled={busy || !configured} onClick={syncProjects} type="button">
                  Sync projects
                </button>
                <button
                  className="secondary"
                  disabled={busy || !configured || runtimeRunning}
                  onClick={startRuntime}
                  type="button"
                >
                  Start bridge
                </button>
                <button
                  className="secondary"
                  disabled={busy || !runtimeRunning}
                  onClick={stopRuntime}
                  type="button"
                >
                  Stop bridge
                </button>
              </div>
            </form>
          </section>

          <section className="panel" aria-labelledby="project-title">
            <h2 id="project-title">Local projects</h2>
            <form className="form-grid" onSubmit={addProject}>
              <label>
                Project directory
                <input
                  value={projectPath}
                  onChange={(event) => setProjectPath(event.target.value)}
                  placeholder="E:\\code\\codex-transit"
                />
              </label>
              <button disabled={busy || !projectPath.trim()} type="submit">
                Add project
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
              <p className="empty-state">No local project directories have been added.</p>
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
