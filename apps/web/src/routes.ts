const DEFAULT_AUTH_REDIRECT = "/devices";

export function buildLoginPath() {
  return "/login";
}

export function buildDevicesPath() {
  return "/devices";
}

export function buildDeviceProjectsPath(deviceId: string) {
  return `/devices/${deviceId}/projects`;
}

export function buildProjectHomePath(deviceId: string, projectId: string) {
  return `/devices/${deviceId}/projects/${projectId}`;
}

export function buildProjectHistoryPath(deviceId: string, projectId: string) {
  return `${buildProjectHomePath(deviceId, projectId)}/history`;
}

export function buildSessionPath(deviceId: string, projectId: string, sessionId: string) {
  return `${buildProjectHomePath(deviceId, projectId)}/sessions/${sessionId}`;
}

export function buildMePath() {
  return "/me";
}

export function normalizePostLoginRedirect(value: string | null | undefined) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return DEFAULT_AUTH_REDIRECT;
  }
  return value;
}

export function readPostLoginRedirect(search: string) {
  const params = new URLSearchParams(search);
  return normalizePostLoginRedirect(params.get("redirect"));
}
