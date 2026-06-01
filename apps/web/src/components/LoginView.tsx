import { type FormEvent, useState } from "react";

export function LoginView(props: { onLogin: (email: string, password: string) => Promise<void> }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      await props.onLogin(email, password);
    } catch {
      setError("Login failed");
    }
  }

  return (
    <form className="panel stack" onSubmit={submit}>
      <label>
        Email
        <input value={email} onChange={(event) => setEmail(event.target.value)} />
      </label>
      <label>
        Password
        <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
      </label>
      {error ? <p className="error">{error}</p> : null}
      <button type="submit">Log in</button>
    </form>
  );
}
