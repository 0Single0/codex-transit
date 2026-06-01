import type { WebMessages } from "./i18n";

type AuthMode = "login" | "register";

export function authErrorMessage(error: unknown, mode: AuthMode, labels: WebMessages) {
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes("email_already_registered")) return labels.emailAlreadyRegistered;
  if (message.includes("invalid_credentials")) return labels.invalidCredentials;
  return mode === "login" ? labels.loginFailed : labels.registerFailed;
}
