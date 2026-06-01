import type { SessionSummary } from "@codex-transit/shared";

export function shouldAutoOpenStoredSession(sessions: SessionSummary[]) {
  const _sessions = sessions;
  return false;
}
