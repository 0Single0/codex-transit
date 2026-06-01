import { type FormEvent, useState } from "react";
import type { WebMessages } from "../i18n";

export function LoginView(props: {
  labels: WebMessages;
  onLogin: (email: string, password: string) => Promise<void>;
  onRegister: (email: string, password: string) => Promise<void>;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<"login" | "register">("login");

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      if (mode === "login") {
        await props.onLogin(email, password);
      } else {
        await props.onRegister(email, password);
      }
    } catch {
      setError(mode === "login" ? props.labels.loginFailed : props.labels.registerFailed);
    }
  }

  return (
    <form className="panel stack" onSubmit={submit}>
      <label>
        {props.labels.email}
        <input value={email} onChange={(event) => setEmail(event.target.value)} />
      </label>
      <label>
        {props.labels.password}
        <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
      </label>
      {error ? <p className="error">{error}</p> : null}
      <div className="actions">
        <button type="submit">{mode === "login" ? props.labels.login : props.labels.register}</button>
        <button
          className="secondary"
          type="button"
          onClick={() => setMode((current) => (current === "login" ? "register" : "login"))}
        >
          {mode === "login" ? props.labels.register : props.labels.login}
        </button>
      </div>
    </form>
  );
}
