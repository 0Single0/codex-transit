import type { DeviceSummary } from "@codex-transit/shared";
import { useMemo, useState } from "react";
import { ApiClient } from "./api/client";
import { DeviceListView } from "./components/DeviceListView";
import { LoginView } from "./components/LoginView";
import { SessionConsole } from "./components/SessionConsole";

export function App() {
  const [token, setToken] = useState<string | null>(localStorage.getItem("token"));
  const [devices, setDevices] = useState<DeviceSummary[]>([]);
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
      {token && !selectedSessionId ? (
        <DeviceListView devices={devices} onSelect={() => setSelectedSessionId(prompt("Session ID") ?? null)} />
      ) : null}
      {token && selectedSessionId ? (
        <SessionConsole
          token={token}
          sessionId={selectedSessionId}
          onSend={(text) => api.sendSessionInput(selectedSessionId, text).then(() => undefined)}
        />
      ) : null}
    </main>
  );
}
