import type { ProjectSummary, SessionSummary } from "@codex-transit/shared";
import { FormEvent, useState } from "react";

export function SessionListView(props: {
  project: ProjectSummary;
  sessions: SessionSummary[];
  onBack: () => void;
  onCreate: (title: string) => Promise<void>;
  onSelect: (session: SessionSummary) => void;
}) {
  const [title, setTitle] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!title.trim()) return;
    await props.onCreate(title.trim());
    setTitle("");
  }

  return (
    <section className="stack">
      <button className="secondary" onClick={props.onBack}>
        Back to projects
      </button>
      <div className="panel stack">
        <h2>{props.project.displayName}</h2>
        <form className="stack" onSubmit={submit}>
          <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="New session title" />
          <button type="submit">New session</button>
        </form>
      </div>
      {props.sessions.map((session) => (
        <button className="list-row" key={session.id} onClick={() => props.onSelect(session)}>
          <span>{session.title}</span>
          <span className="status">{session.status}</span>
        </button>
      ))}
    </section>
  );
}
