import { LockKeyhole, Mail, MonitorCheck, QrCode, TerminalSquare } from "lucide-react";
import { type FormEvent, type ReactNode, useState } from "react";
import { authErrorMessage } from "../authErrors";
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
    if (password.length < 8) {
      setError(props.labels.passwordHint);
      return;
    }
    try {
      if (mode === "login") {
        await props.onLogin(email, password);
      } else {
        await props.onRegister(email, password);
      }
    } catch (caught) {
      setError(authErrorMessage(caught, mode, props.labels));
    }
  }

  return (
    <form className="flex h-full min-h-full flex-col bg-[#f8fbff] px-6 pb-7 pt-12 text-slate-900" onSubmit={submit}>
      <div className="mx-auto grid h-20 w-20 place-items-center rounded-[22px] bg-sky-100 text-3xl font-black text-sky-700 shadow-[0_18px_38px_rgba(14,165,233,0.14)]">
        &gt;_
      </div>
      <h1 className="mt-6 text-center text-3xl font-semibold tracking-normal">Codex App</h1>
      <p className="mt-2 text-center text-sm leading-6 text-slate-500">{props.labels.loginSubtitle}</p>

      <label className="mt-9 flex h-14 items-center gap-3 rounded-2xl bg-white px-4 text-slate-500 shadow-[0_12px_34px_rgba(148,163,184,0.12)]">
        <Mail className="h-5 w-5 text-slate-400" aria-hidden="true" />
        <input
          className="min-w-0 flex-1 bg-transparent text-[15px] text-slate-900 outline-none placeholder:text-slate-400"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder={props.labels.email}
          type="email"
        />
      </label>
      <label className="mt-4 flex h-14 items-center gap-3 rounded-2xl bg-white px-4 text-slate-500 shadow-[0_12px_34px_rgba(148,163,184,0.12)]">
        <LockKeyhole className="h-5 w-5 text-slate-400" aria-hidden="true" />
        <input
          className="min-w-0 flex-1 bg-transparent text-[15px] text-slate-900 outline-none placeholder:text-slate-400"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder={props.labels.password}
        />
      </label>
      {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
      <button
        className="mt-6 h-14 rounded-2xl bg-sky-600 text-[15px] font-semibold text-white shadow-[0_16px_38px_rgba(14,165,233,0.22)] transition hover:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-50"
        type="submit"
      >
        {mode === "login" ? props.labels.login : props.labels.register}
      </button>
      <div className="my-5 flex items-center gap-3 text-xs text-slate-400">
        <span className="h-px flex-1 bg-slate-200" />
        <span>{props.labels.noAccount}</span>
        <span className="h-px flex-1 bg-slate-200" />
      </div>
      <button
        className="flex h-14 items-center justify-center gap-3 rounded-2xl bg-white text-[15px] font-medium text-slate-700 shadow-[0_12px_34px_rgba(148,163,184,0.12)] transition hover:bg-slate-50"
        type="button"
        onClick={() => setMode((current) => (current === "login" ? "register" : "login"))}
      >
        <TerminalSquare className="h-5 w-5" aria-hidden="true" />
        {mode === "login" ? props.labels.register : props.labels.login}
      </button>

      <section className="mt-auto pt-10">
        <h2 className="text-center text-sm font-semibold text-slate-700">{props.labels.howToConnect}</h2>
        <div className="mt-5 grid grid-cols-3 gap-3 text-center">
          <Step icon={<MonitorCheck className="h-5 w-5" />} text={props.labels.installBridge} />
          <Step icon={<QrCode className="h-5 w-5" />} text={props.labels.connectDevice} />
          <Step icon={<TerminalSquare className="h-5 w-5" />} text={props.labels.useAnywhere} />
        </div>
      </section>
    </form>
  );
}

function Step(props: { icon: ReactNode; text: string }) {
  return (
    <div className="grid justify-items-center gap-2 rounded-2xl bg-white px-2 py-3 shadow-[0_10px_24px_rgba(148,163,184,0.1)]">
      <span className="grid h-9 w-9 place-items-center rounded-xl bg-slate-50 text-sky-700">{props.icon}</span>
      <p className="text-[11px] leading-4 text-slate-500">{props.text}</p>
    </div>
  );
}
