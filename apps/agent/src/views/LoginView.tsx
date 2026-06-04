import { Eye, Settings } from "lucide-react";
import { FormEvent } from "react";
import { AppLogo } from "../components/AppLogo";
import { TitleBar } from "../components/TitleBar";

type LoginViewProps = {
  busy: boolean;
  email: string;
  error: string | null;
  loginQr: string | null;
  password: string;
  showPassword: boolean;
  onClose: () => void;
  onEmailChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onQrLogin: () => void;
  onServerSettings: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onTogglePassword: () => void;
};

export function LoginView({
  busy,
  email,
  error,
  loginQr,
  password,
  showPassword,
  onClose,
  onEmailChange,
  onPasswordChange,
  onQrLogin,
  onServerSettings,
  onSubmit,
  onTogglePassword
}: LoginViewProps) {
  return (
    <section className="window login-window">
      <TitleBar closeOnly title="Codex Agent" onClose={onClose} />
      <div className="login-body">
        <AppLogo size="large" />
        <h1>Codex Agent</h1>
        <p>连接服务器，随时随地使用 Codex</p>
        <form className="login-form" onSubmit={onSubmit}>
          <input aria-label="邮箱" value={email} onChange={(event) => onEmailChange(event.target.value)} placeholder="user@example.com" type="email" />
          <div className="password-field">
            <input
              aria-label="密码"
              value={password}
              onChange={(event) => onPasswordChange(event.target.value)}
              placeholder="请输入密码"
              type={showPassword ? "text" : "password"}
            />
            <button aria-label="显示或隐藏密码" onClick={onTogglePassword} type="button">
              <Eye />
            </button>
          </div>
          <button className="primary-button" disabled={busy || !email || !password} type="submit">
            登录
          </button>
        </form>
        <p className="register-line">
          还没有账号？
          <button type="button" onClick={onQrLogin}>
            注册
          </button>
        </p>
        {loginQr ? (
          <div className="qr-popover">
            <img alt="登录二维码" src={loginQr} />
            <span>手机端扫码确认</span>
          </div>
        ) : null}
        {error ? <p className="form-message error">{error}</p> : null}
        <button className="server-button" type="button" onClick={onServerSettings}>
          <Settings />
          服务器设置
        </button>
      </div>
    </section>
  );
}
