export function normalizeSessionTitle(title: string) {
  return title.trim().slice(0, 120);
}
