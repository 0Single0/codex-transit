import { buildDevicesPath, buildLoginPath, normalizePostLoginRedirect } from "../../routes";

export function buildLoginRedirectPath(targetPath: string) {
  const normalized = normalizePostLoginRedirect(targetPath);
  const loginPath = buildLoginPath();
  if (normalized === buildDevicesPath()) {
    return loginPath;
  }
  return `${loginPath}?redirect=${encodeURIComponent(normalized)}`;
}
