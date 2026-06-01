import type {
  FileChangeHistory,
  RealtimeEvent,
  SessionMessage,
  TerminalOutputChunk
} from "@codex-transit/shared";
import { useEffect, useState } from "react";
import { connectSessionStream } from "../api/realtime";

export function SessionConsole(props: {
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
  const [messages, setMessages] = useState<SessionMessage[]>([]);
  const [prompt, setPrompt] = useState("");

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
        <h2>Conversation</h2>
        {messages.length ? (
          messages.map((message, index) => (
            <p className="message-row" key={message.id ?? index}>
              <strong>{message.role}</strong>
              <span>{message.text}</span>
            </p>
          ))
        ) : (
          <p className="empty-state">No prompts have been sent in this session.</p>
        )}
      </section>
      <pre className="console">{lines.join("\n")}</pre>
      <form
        className="panel stack"
        onSubmit={async (event) => {
          event.preventDefault();
          if (!prompt.trim()) return;
          const text = prompt;
          await props.onSend(text);
          setMessages((current) => [...current, { role: "user", text }]);
          setPrompt("");
        }}
      >
        <textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} />
        <button type="submit">Send</button>
        <button type="button" className="secondary" onClick={props.onStart}>
          Start session
        </button>
        <button type="button" className="secondary" onClick={props.onStop}>
          Stop session
        </button>
      </form>
      <aside className="panel stack">
        <h2>Changed files</h2>
        {files.map((file) => (
          <button className="file-row" key={file} onClick={() => props.onRequestDiff(file)}>
            {file}
          </button>
        ))}
      </aside>
    </section>
  );
}
