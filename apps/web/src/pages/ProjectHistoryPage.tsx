import type { CodexHistoryItem, CodexHistoryMessage, ProjectSummary, RealtimeEvent } from "@codex-transit/shared";
import { useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { connectDeviceStream } from "../api/realtime";
import { HistoryListView } from "../components/HistoryListView";
import { useAppState } from "../features/app/AppStateContext";
import { openHistoryAsTransitSession } from "../features/history/projectHistory";
import { buildProjectHomePath, buildSessionPath } from "../routes";

export function ProjectHistoryPage() {
  const { deviceId = "", projectId = "" } = useParams();
  const { api, labels, runAuthorized, token } = useAppState();
  const [project, setProject] = useState<ProjectSummary | null>(null);
  const [history, setHistory] = useState<CodexHistoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (!deviceId || !projectId || !token) return;
    void preparePage();
  }, [deviceId, projectId, token]);

  async function preparePage() {
    const projectResult = await runAuthorized(() => api.deviceProjects(deviceId));
    if (!projectResult) return;
    setProject(projectResult.projects.find((item) => item.projectId === projectId) ?? null);
    await loadHistory();
  }

  async function loadHistory() {
    if (!token) return;
    setLoading(true);
    const stream = connectDeviceStream({
      token,
      deviceId,
      onEvent(event: RealtimeEvent) {
        if (event.type !== "codex.history.result") return;
        setLoading(false);
        setHistory(event.ok ? event.sessions : []);
        stream.close();
      }
    });
    await stream.ready;
    const response = await runAuthorized(() => api.requestCodexHistory(deviceId, projectId, 50));
    if (!response) {
      stream.close();
      setLoading(false);
    }
  }

  async function openHistoryItem(item: CodexHistoryItem) {
    if (!token || !project) return;
    setLoading(true);
    const stream = connectDeviceStream({
      token,
      deviceId,
      onEvent(event: RealtimeEvent) {
        if (event.type !== "codex.history.detail.result" || event.codexSessionId !== item.codexSessionId) return;
        stream.close();
        setLoading(false);
        if (!event.ok) return;
        void navigateToSession(item, event.messages);
      }
    });
    await stream.ready;
    const result = await runAuthorized(() => api.requestCodexHistoryDetail(deviceId, item.codexSessionId));
    if (!result) {
      stream.close();
      setLoading(false);
    }
  }

  async function navigateToSession(item: CodexHistoryItem, historyMessages: CodexHistoryMessage[]) {
    if (!project) return;
    const session = await openHistoryAsTransitSession({
      api,
      deviceId,
      historyItem: item,
      project
    });
    navigate(buildSessionPath(deviceId, projectId, session.id), {
      state: {
        historyMessages,
        codexSessionId: item.codexSessionId,
        returnToHistory: true
      }
    });
  }

  return (
    <HistoryListView
      history={history}
      labels={labels}
      loading={loading}
      onBack={() => navigate(buildProjectHomePath(deviceId, projectId))}
      onSelect={openHistoryItem}
    />
  );
}
