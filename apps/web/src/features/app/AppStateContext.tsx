import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { ApiClient } from "../../api/client";
import type { Locale, WebMessages } from "../../i18n";
import { useAppPreferences } from "./useAppPreferences";

type AppStateContextValue = {
  token: string | null;
  setToken: (token: string | null) => void;
  locale: Locale;
  setLocale: (locale: Locale) => void;
  labels: WebMessages;
  api: ApiClient;
  message: string | null;
  setMessage: (message: string | null) => void;
  error: string | null;
  setError: (error: string | null) => void;
  resetSession: (messageText?: string | null) => void;
  runAuthorized: <T>(operation: () => Promise<T>) => Promise<T | null>;
};

const AppStateContext = createContext<AppStateContextValue | null>(null);

export function AppStateProvider(props: { children: ReactNode }) {
  const { token, setToken, locale, setLocale, labels } = useAppPreferences();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const api = useMemo(() => new ApiClient(token), [token]);

  const value = useMemo<AppStateContextValue>(() => ({
    token,
    setToken,
    locale,
    setLocale,
    labels,
    api,
    message,
    setMessage,
    error,
    setError,
    resetSession(messageText) {
      setToken(null);
      setMessage(null);
      setError(messageText ?? labels.sessionExpired);
    },
    async runAuthorized<T>(operation: () => Promise<T>) {
      try {
        return await operation();
      } catch (caught) {
        if (caught instanceof Error && "status" in caught && caught.status === 401) {
          setToken(null);
          setMessage(null);
          setError(labels.sessionExpired);
          return null;
        }
        throw caught;
      }
    }
  }), [api, error, labels, locale, message, setLocale, setToken, token]);

  return (
    <AppStateContext.Provider value={value}>
      {props.children}
    </AppStateContext.Provider>
  );
}

export function useAppState() {
  const context = useContext(AppStateContext);
  if (!context) {
    throw new Error("useAppState must be used within AppStateProvider");
  }
  return context;
}
