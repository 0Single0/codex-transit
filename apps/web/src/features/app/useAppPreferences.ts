import { useMemo, useState } from "react";
import type { Locale } from "../../i18n";
import { messages } from "../../i18n";

const TOKEN_KEY = "token";
const LOCALE_KEY = "locale";

export function useAppPreferences() {
  const [token, setTokenState] = useState<string | null>(localStorage.getItem(TOKEN_KEY));
  const [locale, setLocaleState] = useState<Locale>((localStorage.getItem(LOCALE_KEY) as Locale | null) ?? "zh");

  const labels = useMemo(() => messages[locale], [locale]);

  function setToken(nextToken: string | null) {
    if (nextToken) {
      localStorage.setItem(TOKEN_KEY, nextToken);
    } else {
      localStorage.removeItem(TOKEN_KEY);
    }
    setTokenState(nextToken);
  }

  function setLocale(nextLocale: Locale) {
    localStorage.setItem(LOCALE_KEY, nextLocale);
    setLocaleState(nextLocale);
  }

  return {
    token,
    setToken,
    locale,
    setLocale,
    labels
  };
}
