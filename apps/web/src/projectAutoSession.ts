import type { SessionSummary } from "@codex-transit/shared";

export function shouldCreateSessionOnProjectEntry(sessions: SessionSummary[]) {
  return sessions.length === 0;
}

export function pickProjectEntrySession(sessions: SessionSummary[]) {
  return [...sessions].sort((left, right) => (
    new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime()
  ))[0] ?? null;
}
