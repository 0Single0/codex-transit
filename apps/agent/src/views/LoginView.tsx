import { Eye, QrCode } from "lucide-react";
import { type FormEvent } from "react";
import type { AgentMessages } from "../messages";
import { AppLogo } from "../components/AppLogo";
import { TitleBar } from "../components/TitleBar";

type LoginViewProps = {
  busy: boolean;
  email: string;
  error: string | null;
  loginQr: string | null;
  labels: AgentMessages;
  password: string;
  showPassword: boolean;
  onClose: () => void;
  onEmailChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onQrLogin: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onTogglePassword: () => void;
};

export function LoginView({
  busy,
  email,
  error,
  loginQr,
  labels,
  password,
  showPassword,
  onClose,
  onEmailChange,
  onPasswordChange,
  onQrLogin,
  onSubmit,
  onTogglePassword
}: LoginViewProps) {
  const qrMode = Boolean(loginQr);

  return (
    <section className="window login-window">
      <TitleBar closeOnly labels={labels} title={labels.appName} onClose={onClose} />
      <div className="login-body">
        <AppLogo size="large" />
        <h1>{labels.appName}</h1>
        <p>{qrMode ? labels.loginQrIntro : labels.loginIntro}</p>
        <div className="login-mode-shell">
          {qrMode ? (
            <div className="qr-login-panel">
              <img alt="Desktop login QR" src={loginQr ?? undefined} />
            </div>
          ) : (
            <form className="login-form" onSubmit={onSubmit}>
              <input
                aria-label="email"
                onChange={(event) => onEmailChange(event.target.value)}
                placeholder={labels.emailPlaceholder}
                type="email"
                value={email}
              />
              <div className="password-field">
                <input
                  aria-label="password"
                  onChange={(event) => onPasswordChange(event.target.value)}
                  placeholder={labels.passwordPlaceholder}
                  type={showPassword ? "text" : "password"}
                  value={password}
                />
                <button aria-label="toggle password visibility" onClick={onTogglePassword} type="button">
                  <Eye />
                </button>
              </div>
              <button className="primary-button" disabled={busy || !email || !password} type="submit">
                {labels.logIn}
              </button>
            </form>
          )}
        </div>
        {qrMode ? (
          <p className="register-line">
            {labels.preferAccount}
            <button onClick={onQrLogin} type="button">
              {labels.switchToAccount}
            </button>
          </p>
        ) : (
          <p className="register-line">
            {labels.wantPhoneLogin}
            <button onClick={onQrLogin} type="button">
              {labels.switchToQr}
            </button>
          </p>
        )}
        {error ? <p className="form-message error">{error}</p> : null}
        {busy && qrMode ? (
          <p className="note login-note">
            <QrCode />
            {labels.generatingQr}
          </p>
        ) : null}
      </div>
    </section>
  );
}
