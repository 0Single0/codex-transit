export type SessionNavigationState = {
  activeTab: "sessions";
  selectedSessionId: string;
};

export function openSessionNavigation(session: { id: string }): SessionNavigationState {
  return {
    activeTab: "sessions",
    selectedSessionId: session.id
  };
}
