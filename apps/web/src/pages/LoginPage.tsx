import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ApiClient } from "../api/client";
import { LoginView } from "../components/LoginView";
import { useAppState } from "../features/app/AppStateContext";
import { buildDevicesPath, readPostLoginRedirect } from "../routes";

export function LoginPage() {
  const { labels, setToken, setError } = useAppState();
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const redirect = readPostLoginRedirect(location.search);

  async function onAuthComplete(token: string) {
    setToken(token);
    setError(null);
    navigate(redirect || buildDevicesPath(), { replace: true });
  }

  return (
    <LoginView
      labels={labels}
      onLogin={async (email, password) => {
        setBusy(true);
        try {
          const result = await new ApiClient(null).login(email, password);
          await onAuthComplete(result.token);
        } finally {
          setBusy(false);
        }
      }}
      onRegister={async (email, password) => {
        setBusy(true);
        try {
          const result = await new ApiClient(null).register(email, password);
          await onAuthComplete(result.token);
        } finally {
          setBusy(false);
        }
      }}
    />
  );
}
