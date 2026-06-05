export type Surface = "login" | "main" | "tray" | "settings" | "projects";

export type SettingsSection = "general" | "logs" | "about";

export type ThemePreference = "system" | "light" | "dark";

export type LogLevel = "info" | "debug" | "warn" | "error";

export type LocalePreference = "en" | "zh";

export type Preferences = {
  autostart: boolean;
  minimizeToTray: boolean;
  autoUpdate: boolean;
  theme: ThemePreference;
  logLevel: LogLevel;
  locale: LocalePreference;
  defaultProjectId: string | null;
};

export const defaultPreferences: Preferences = {
  autostart: true,
  minimizeToTray: true,
  autoUpdate: true,
  theme: "system",
  logLevel: "info",
  locale: "zh",
  defaultProjectId: null
};

export const appWindowSize: [number, number] = [545, 507];
export const trayPopoverSize: [number, number] = [318, 354];

export const surfaceSizes: Record<Surface, [number, number]> = {
  login: appWindowSize,
  main: appWindowSize,
  settings: appWindowSize,
  projects: appWindowSize,
  tray: trayPopoverSize
};
