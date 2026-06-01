import type {
  FileChangeHistory,
  RealtimeEvent,
  SessionMessage,
  TerminalOutputChunk
} from "@codex-transit/shared";
import { useEffect, useState } from "react";
import { connectSessionStream } from "../api/realtime";
import type { WebMessages } from "../i18n";
import { applyDiffResult, type DiffPreview } from "../sessionDiffs";

export function SessionConsole(props: {
  labels: WebMessages;
  token: string;
  sessionId: string;
  loadOutput: () => Promise<TerminalOutputChunk[]>;
  loadFileChanges: () => Promise<FileChangeHistory[]>;
  loadMessages: () => Promise<SessionMessage[]>;
  onSend: (text: string) => Promise<void>;
  onStart: () => Promise<void>;
  onStop: () => Promise<void>;
  onRequestDiff: (relativePath: string) => Promise<void>;
}) {
  const [lines, setLines] = useState<string[]>([]);
  const [files, setFiles] = useState<string[]>([]);
  const [diffs, setDiffs] = useState<DiffPreview[]>([]);
  const [messages, setMessages] = useState<SessionMessage[]>([]);
  const [prompt, setPrompt] = useState("");
  const [sendError, setSendError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    void Promise.all([props.loadOutput(), props.loadFileChanges(), props.loadMessages()]).then(
      ([output, changes, messages]) => {
        if (!mounted) return;
        setLines(output.map((chunk) => chunk.text));
        setFiles(Array.from(new Set(changes.map((change) => change.relativePath))));
        setMessages(messages);
      }
    );

    const closeStream = connectSessionStream({
      token: props.token,
      sessionId: props.sessionId,
      onEvent(event: RealtimeEvent) {
        if (event.type === "codex.output.chunk") {
          setLines((current) => [...current, event.text]);
        }
        if (event.type === "file.changed") {
          setFiles((current) => Array.from(new Set([...current, event.relativePath])));
        }
        if (event.type === "diff.result") {
          setDiffs((current) => applyDiffResult(current, event));
        }
      }
    });
    return () => {
      mounted = false;
      closeStream();
    };
  }, [props.token, props.sessionId]);

  return (
    <section className="console-grid">
      <section className="panel stack">
        <h2>{props.labels.conversation}</h2>
        {messages.length ? (
          messages.map((message, index) => (
            <p className="message-row" key={message.id ?? index}>
              <strong>{message.role}</strong>
              <span>{message.text}</span>
            </p>
          ))
        ) : (
          <p className="empty-state">{props.labels.noPrompts}</p>
        )}
      </section>
      <pre className="console">{lines.join("\n")}</pre>
      <form
        className="panel stack"
        onSubmit={async (event) => {
          event.preventDefault();
          if (!prompt.trim()) return;
          const text = prompt;
          setSendError(null);
          try {
            await props.onSend(text);
          } catch (caught) {
            const message = caught instanceof Error && caught.message.includes("agent_offline")
              ? props.labels.agentOffline
              : props.labels.sendFailed;
            setSendError(message);
            return;
          }
          setMessages((current) => [...current, { role: "user", text }]);
          setPrompt("");
        }}
      >
        <textarea
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
          placeholder={props.labels.promptPlaceholder}
          rows={5}
        />
        {sendError ? <p className="error">{sendError}</p> : null}
        <button type="submit">{props.labels.send}</button>
        <button type="button" className="secondary" onClick={props.onStart}>
          {props.labels.startSession}
        </button>
        <button type="button" className="secondary" onClick={props.onStop}>
          {props.labels.stopSession}
        </button>
      </form>
      <aside className="panel stack">
        <h2>{props.labels.changedFiles}</h2>
        {files.map((file) => (
          <button className="file-row" key={file} onClick={() => props.onRequestDiff(file)}>
            {file}
          </button>
        ))}
      </aside>
      <section className="panel stack">
        <h2>{props.labels.diffPreview}</h2>
        {diffs.length ? (
          diffs.map((diff, index) => (
            <article className="diff-card" key={`${diff.relativePath}-${index}`}>
              <strong>{diff.relativePath}</strong>
              <pre className={diff.ok ? "diff-output" : "diff-output error"}>{diff.text}</pre>
            </article>
          ))
        ) : (
          <p className="empty-state">{props.labels.noDiffs}</p>
        )}
      </section>
    </section>
  );
}
