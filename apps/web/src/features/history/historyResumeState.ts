const CODEX_SESSION_KEY = "codex-session-by-transit-session";
const TRANSIT_SESSION_KEY = "transit-session-by-history";

type SessionMappingRecord = Record<string, string>;

function readRecord(key: string): SessionMappingRecord {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed as SessionMappingRecord : {};
  } catch {
    return {};
  }
}

function writeRecord(key: string, value: SessionMappingRecord) {
  localStorage.setItem(key, JSON.stringify(value));
}

export function bindHistorySession(options: {
  projectId: string;
  codexSessionId: string;
  transitSessionId: string;
}) {
  const transitByHistory = readRecord(TRANSIT_SESSION_KEY);
  transitByHistory[`${options.projectId}:${options.codexSessionId}`] = options.transitSessionId;
  writeRecord(TRANSIT_SESSION_KEY, transitByHistory);

  const codexBySession = readRecord(CODEX_SESSION_KEY);
  codexBySession[options.transitSessionId] = options.codexSessionId;
  writeRecord(CODEX_SESSION_KEY, codexBySession);
}

export function readTransitSessionForHistory(projectId: string, codexSessionId: string) {
  const transitByHistory = readRecord(TRANSIT_SESSION_KEY);
  return transitByHistory[`${projectId}:${codexSessionId}`] ?? null;
}

export function readCodexSessionForTransitSession(sessionId: string) {
  const codexBySession = readRecord(CODEX_SESSION_KEY);
  return codexBySession[sessionId] ?? null;
}
