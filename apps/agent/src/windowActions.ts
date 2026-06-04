import { getCurrentWindow, LogicalSize } from "@tauri-apps/api/window";

export function getCurrentWindowLabel() {
  return getCurrentWindow().label;
}

export function resizeWindow(width: number, height: number) {
  void getCurrentWindow().setSize(new LogicalSize(width, height)).catch(() => undefined);
}

export async function resizeWindowIfRestored(width: number, height: number) {
  const window = getCurrentWindow();
  const isMaximized = await window.isMaximized().catch(() => false);
  if (isMaximized) return;
  await window.setSize(new LogicalSize(width, height)).catch(() => undefined);
}

export function hideWindow() {
  void getCurrentWindow().hide().catch(() => undefined);
}

export function minimizeWindow() {
  void getCurrentWindow().minimize().catch(() => undefined);
}

export async function toggleMaximizeWindow() {
  const window = getCurrentWindow();
  void window.toggleMaximize().catch(async () => {
    const isMaximized = await window.isMaximized().catch(() => false);
    if (isMaximized) {
      void window.unmaximize().catch(() => undefined);
      return;
    }
    void window.maximize().catch(() => undefined);
  });
}

export function startWindowDrag() {
  void getCurrentWindow().startDragging().catch(() => undefined);
}
