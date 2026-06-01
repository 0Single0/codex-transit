import type { CodexHistoryItem, CodexHistoryMessage, DeviceSummary, ProjectSummary, RealtimeEvent, SessionSummary } from "@codex-transit/shared";
import { Bell, ChevronLeft, Languages, Menu, MonitorSmartphone, Settings, UserRound } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { ApiClient, ApiError } from "./api/client";
import { connectDeviceStream } from "./api/realtime";
import { DeviceListView } from "./components/DeviceListView";
import { LoginView } from "./components/LoginView";
import { ProjectListView } from "./components/ProjectListView";
import { SessionConsole } from "./components/SessionConsole";
import { Locale, messages } from "./i18n";
import { shouldAutoOpenStoredSession } from "./projectSessionSelection";
import { openSessionNavigation } from "./sessionNavigation";

type Tab = "devices" | "me";

export function App() {
  const [locale, setLocale] = useState<Locale>((localStorage.getItem("locale") as Locale | null) ?? "zh");
  const [token, setToken] = useState<string | null>(localStorage.getItem("token"));
  const [devices, setDevices] = useState<DeviceSummary[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<DeviceSummary | null>(null);
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [selectedProject, setSelectedProject] = useState<ProjectSummary | null>(null);
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [codexHistory, setCodexHistory] = useState<CodexHistoryItem[]>([]);
  const [codexHistoryMessages, setCodexHistoryMessages] = useState<CodexHistoryMessage[]>([]);
  const [activeCodexSessionId, setActiveCodexSessionId] = useState<string | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("devices");
  const [historyOpen, setHistoryOpen] = useState(false);
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
    setCodexHistory([]);
    setCodexHistoryMessages([]);
    setActiveCodexSessionId(null);
    setHistoryLoading(false);
    setSelectedSessionId(null);
    setActiveTab("devices");
    setHistoryOpen(false);
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
    setDevices(await new ApiClient(result.token).devices());
  }

  async function register(email: string, password: string) {
    const result = await api.register(email, password);
    localStorage.setItem("token", result.token);
    setToken(result.token);
    setDevices(await new ApiClient(result.token).devices());
  }

  async function refreshDevices() {
    await runAuthorized(async () => {
      setDevices(await api.devices());
    });
  }

  async function selectDevice(device: DeviceSummary) {
    setSelectedDevice(device);
    setSelectedProject(null);
    setSelectedSessionId(null);
    setHistoryOpen(false);
    setCodexHistory([]);
    setCodexHistoryMessages([]);
    setActiveCodexSessionId(null);
    setHistoryLoading(false);
    const response = await runAuthorized(() => api.deviceProjects(device.id));
    if (!response) return;
    setProjects(response.projects);
  }

  async function selectProject(project: ProjectSummary) {
    setSelectedProject(project);
    setHistoryOpen(false);
    setCodexHistory([]);
    setCodexHistoryMessages([]);
    setActiveCodexSessionId(null);
    const projectSessions = await runAuthorized(() => api.sessions(project.projectId));
    if (!projectSessions) return;
    setSessions(projectSessions);
    if (shouldAutoOpenStoredSession(projectSessions) && projectSessions[0]) {
      openSession(projectSessions[0]);
      return;
    }
    await createSessionForProject(project);
  }

  async function createSessionForProject(project: ProjectSummary, title = project.displayName) {
    if (!selectedDevice) return;
    const session = await runAuthorized(() => api.createSession(selectedDevice.id, project.projectId, title));
    if (!session) return;
    setSessions((current) => [session, ...current]);
    openSession(session);
  }

  async function openCodexHistory() {
    if (!token || !selectedDevice || !selectedProject) return;
    setHistoryOpen(true);
    setHistoryLoading(true);
    setError(null);
    const stream = connectDeviceStream({
      token,
      deviceId: selectedDevice.id,
      onEvent(event: RealtimeEvent) {
        if (event.type !== "codex.history.result") return;
        setHistoryLoading(false);
        if (event.ok) {
          setCodexHistory(event.sessions);
        } else {
          setError(event.error ?? labels.historyLoadFailed);
        }
        stream.close();
      }
    });
    await stream.ready;
    const request = await runAuthorized(() => api.requestCodexHistory(selectedDevice.id, selectedProject.projectId, 50));
    if (!request) {
      stream.close();
      setHistoryLoading(false);
      return;
    }
    window.setTimeout(() => {
      setHistoryLoading((current) => {
        if (current) {
          stream.close();
          setError(labels.historyLoadFailed);
        }
        return false;
      });
    }, 8000);
  }

  async function openCodexHistoryItem(item: CodexHistoryItem) {
    if (!token || !selectedDevice || !selectedProject) return;
    setHistoryLoading(true);
    setError(null);
    const stream = connectDeviceStream({
      token,
      deviceId: selectedDevice.id,
      onEvent(event: RealtimeEvent) {
        if (event.type !== "codex.history.detail.result" || event.codexSessionId !== item.codexSessionId) return;
        setHistoryLoading(false);
        stream.close();
        if (!event.ok) {
          setError(event.error ?? labels.historyLoadFailed);
          return;
        }
        setCodexHistoryMessages(event.messages);
        setActiveCodexSessionId(item.codexSessionId);
        void openOrCreateTransitSessionForHistory(item);
      }
    });
    await stream.ready;
    const request = await runAuthorized(() => api.requestCodexHistoryDetail(selectedDevice.id, item.codexSessionId));
    if (!request) {
      stream.close();
      setHistoryLoading(false);
    }
  }

  async function openOrCreateTransitSessionForHistory(item: CodexHistoryItem) {
    if (!selectedDevice || !selectedProject) return;
    const existing = sessions.find((session) => session.title === item.title);
    if (existing) {
      openSession(existing);
      return;
    }
    const session = await runAuthorized(() => api.createSession(selectedDevice.id, selectedProject.projectId, item.title));
    if (!session) return;
    setSessions((current) => [session, ...current]);
    openSession(session);
  }

  function openSession(session: SessionSummary) {
    const navigation = openSessionNavigation(session);
    setSelectedSessionId(navigation.selectedSessionId);
    setHistoryOpen(false);
    setActiveTab("devices");
  }

  function signOut() {
    localStorage.removeItem("token");
    setToken(null);
    setDevices([]);
    setSelectedDevice(null);
    setProjects([]);
    setSelectedProject(null);
    setSessions([]);
    setCodexHistory([]);
    setCodexHistoryMessages([]);
    setActiveCodexSessionId(null);
    setHistoryLoading(false);
    setSelectedSessionId(null);
    setHistoryOpen(false);
    setActiveTab("devices");
    setMessage(null);
    setError(null);
  }

  function openDevicesTab() {
    setActiveTab("devices");
    setHistoryOpen(false);
  }

  return (
    <main className="min-h-screen bg-[#050b12] text-white">
      <section className="mx-auto min-h-screen max-w-[430px] bg-[#07111c] shadow-[0_0_60px_rgba(0,0,0,0.45)]">
        {!token ? <LoginView labels={labels} onLogin={login} onRegister={register} /> : null}

        {token && activeTab === "devices" && !selectedDevice && !selectedSessionId ? (
          <>
            <MobileHeader labels={labels} onRefresh={refreshDevices} />
            <DeviceListView devices={devices} labels={labels} onSelect={selectDevice} />
          </>
        ) : null}

        {token && activeTab === "devices" && selectedDevice && !selectedProject && !selectedSessionId ? (
          <ProjectListView labels={labels} projects={projects} onBack={() => setSelectedDevice(null)} onSelect={selectProject} />
        ) : null}

        {token && activeTab === "devices" && selectedProject && historyOpen ? (
          <HistoryView
            labels={labels}
            history={codexHistory}
            loading={historyLoading}
            onBack={() => setHistoryOpen(false)}
            onSelect={openCodexHistoryItem}
          />
        ) : null}

        {token && activeTab === "devices" && selectedProject && selectedSessionId && !historyOpen ? (
          <SessionConsole
            labels={labels}
            token={token}
            sessionId={selectedSessionId}
            projectName={selectedProject.displayName}
            projectPath={selectedProject.pathAlias}
            loadMessages={async () => (await runAuthorized(() => api.sessionMessages(selectedSessionId))) ?? []}
            loadOutput={async () => (await runAuthorized(() => api.sessionOutput(selectedSessionId))) ?? []}
            onBack={() => {
              setSelectedSessionId(null);
              setSelectedProject(null);
              setHistoryOpen(false);
            }}
            onHistory={openCodexHistory}
            historyMessages={codexHistoryMessages}
            onSend={async (text) => {
              await runAuthorized(() => api.sendSessionInput(selectedSessionId, text, activeCodexSessionId ?? undefined));
            }}
          />
        ) : null}

        {token && activeTab === "me" ? (
          <MeView labels={labels} locale={locale} onLocaleChange={changeLocale} onSignOut={signOut} />
        ) : null}

        {message ? <p className="fixed left-1/2 top-4 z-20 w-[min(380px,calc(100vw-32px))] -translate-x-1/2 rounded-2xl bg-emerald-500/15 px-4 py-3 text-sm text-emerald-200">{message}</p> : null}
        {error ? <p className="fixed left-1/2 top-4 z-20 w-[min(380px,calc(100vw-32px))] -translate-x-1/2 rounded-2xl bg-red-500/15 px-4 py-3 text-sm text-red-200">{error}</p> : null}

        {token && !selectedDevice && !selectedSessionId ? (
          <BottomNav activeTab={activeTab} labels={labels} onDevices={openDevicesTab} onMe={() => setActiveTab("me")} />
        ) : null}
      </section>
    </main>
  );
}

function MobileHeader(props: { labels: typeof messages.zh; onRefresh: () => void }) {
  return (
    <header className="px-5 pb-2 pt-5 text-white">
      <div className="grid grid-cols-[44px_1fr_44px] items-center">
        <button className="grid h-11 w-11 place-items-center rounded-full bg-white/[0.06]" type="button">
          <Menu className="h-5 w-5" />
        </button>
        <h1 className="text-center text-xl font-semibold">{props.labels.myDevices}</h1>
        <button className="grid h-11 w-11 place-items-center rounded-full bg-white/[0.06]" onClick={props.onRefresh} type="button">
          <Bell className="h-5 w-5" />
        </button>
      </div>
    </header>
  );
}

function HistoryView(props: {
  labels: typeof messages.zh;
  history: CodexHistoryItem[];
  loading: boolean;
  onBack: () => void;
  onSelect: (item: CodexHistoryItem) => void;
}) {
  return (
    <section className="min-h-[calc(100vh-32px)] px-5 pb-28 pt-4 text-white">
      <header className="grid grid-cols-[44px_1fr_44px] items-center">
        <button className="grid h-11 w-11 place-items-center rounded-full bg-white/[0.06]" onClick={props.onBack} type="button">
          <ChevronLeft className="h-5 w-5" />
        </button>
        <h1 className="text-center text-lg font-semibold">{props.labels.history}</h1>
        <span />
      </header>
      <p className="mt-4 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm leading-6 text-slate-400">
        {props.labels.historyHint}
      </p>
      <div className="mt-4 space-y-3">
        {props.loading ? (
          <div className="rounded-[22px] border border-white/10 bg-[#101822] px-4 py-6 text-center text-sm text-slate-400">
            {props.labels.loadingHistory}
          </div>
        ) : null}
        {!props.loading && !props.history.length ? (
          <div className="rounded-[22px] border border-white/10 bg-[#101822] px-4 py-6 text-center text-sm text-slate-400">
            {props.labels.noCodexHistory}
          </div>
        ) : null}
        {props.history.map((item) => (
          <button
            className="w-full rounded-[22px] border border-white/10 bg-[#101822] px-4 py-4 text-left"
            key={item.codexSessionId}
            onClick={() => props.onSelect(item)}
            type="button"
          >
            <strong className="block truncate text-sm font-semibold">{item.title}</strong>
            <span className="mt-1 block text-xs text-slate-500">{new Date(item.updatedAt).toLocaleString()}</span>
            {item.preview ? <span className="mt-2 line-clamp-2 block text-xs leading-5 text-slate-400">{item.preview}</span> : null}
          </button>
        ))}
      </div>
    </section>
  );
}

function MeView(props: {
  labels: typeof messages.zh;
  locale: Locale;
  onLocaleChange: (locale: Locale) => void;
  onSignOut: () => void;
}) {
  return (
    <section className="min-h-screen px-5 pb-28 pt-6 text-white">
      <h1 className="text-center text-xl font-semibold">{props.labels.tabMe}</h1>
      <div className="mt-8 space-y-4">
        <section className="rounded-[26px] border border-white/10 bg-[#101822] p-5">
          <div className="flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-2xl bg-violet-500/10 text-violet-200">
              <Settings className="h-5 w-5" />
            </span>
            <h2 className="text-base font-semibold">{props.labels.settings}</h2>
          </div>
          <label className="mt-5 flex items-center justify-between rounded-2xl bg-white/[0.05] px-4 py-3">
            <span className="flex items-center gap-2 text-sm text-slate-300">
              <Languages className="h-4 w-4" />
              {props.labels.language}
            </span>
            <select
              className="rounded-xl border border-white/10 bg-[#07111c] px-3 py-2 text-sm text-white outline-none"
              value={props.locale}
              onChange={(event) => props.onLocaleChange(event.target.value as Locale)}
            >
              <option value="zh">{props.labels.chinese}</option>
              <option value="en">{props.labels.english}</option>
            </select>
          </label>
        </section>
        <button className="h-14 w-full rounded-2xl bg-red-500/15 text-sm font-semibold text-red-200" onClick={props.onSignOut} type="button">
          {props.labels.logout}
        </button>
      </div>
    </section>
  );
}

function BottomNav(props: {
  activeTab: Tab;
  labels: typeof messages.zh;
  onDevices: () => void;
  onMe: () => void;
}) {
  return (
    <nav className="fixed bottom-0 left-1/2 grid w-full max-w-[430px] -translate-x-1/2 grid-cols-2 border-t border-white/10 bg-[#07111c]/95 px-8 pb-5 pt-3 backdrop-blur">
      <button
        className={`grid justify-items-center gap-1 text-xs ${props.activeTab === "devices" ? "text-violet-200" : "text-slate-500"}`}
        onClick={props.onDevices}
        type="button"
      >
        <MonitorSmartphone className="h-5 w-5" />
        {props.labels.tabDevices}
      </button>
      <button
        className={`grid justify-items-center gap-1 text-xs ${props.activeTab === "me" ? "text-violet-200" : "text-slate-500"}`}
        onClick={props.onMe}
        type="button"
      >
        <UserRound className="h-5 w-5" />
        {props.labels.tabMe}
      </button>
    </nav>
  );
}
