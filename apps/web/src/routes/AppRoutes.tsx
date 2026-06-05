import { Navigate, Route, Routes } from "react-router-dom";
import { AppChrome } from "../components/AppChrome";
import { useAppState } from "../features/app/AppStateContext";
import { buildDevicesPath, buildLoginPath, buildMePath } from "../routes";
import { DevicesPage } from "../pages/DevicesPage";
import { LoginPage } from "../pages/LoginPage";
import { MePage } from "../pages/MePage";
import { ProjectHistoryPage } from "../pages/ProjectHistoryPage";
import { ProjectHomePage } from "../pages/ProjectHomePage";
import { ProjectsPage } from "../pages/ProjectsPage";
import { ScanAgentPage } from "../pages/ScanAgentPage";
import { SessionPage } from "../pages/SessionPage";
import { RequireAuth } from "./RequireAuth";

export function AppRoutes() {
  const { labels, message, error, token } = useAppState();

  return (
    <Routes>
      <Route path={buildLoginPath()} element={<LoginPage />} />
      <Route path="/scan-agent" element={<ScanAgentPage />} />
      <Route
        element={(
          <RequireAuth>
            <AppChrome error={error} labels={labels} message={message} />
          </RequireAuth>
        )}
      >
        <Route path={buildDevicesPath()} element={<DevicesPage />} />
        <Route path="/devices/:deviceId/projects" element={<ProjectsPage />} />
        <Route path="/devices/:deviceId/projects/:projectId" element={<ProjectHomePage />} />
        <Route path="/devices/:deviceId/projects/:projectId/history" element={<ProjectHistoryPage />} />
        <Route path="/devices/:deviceId/projects/:projectId/sessions/:sessionId" element={<SessionPage />} />
        <Route path={buildMePath()} element={<MePage />} />
      </Route>
      <Route path="*" element={<Navigate replace to={token ? buildDevicesPath() : buildLoginPath()} />} />
    </Routes>
  );
}
