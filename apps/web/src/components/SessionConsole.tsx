import type {
  RealtimeEvent,
  SessionMessage,
  TerminalOutputChunk
} from "@codex-transit/shared";
import { useEffect, useMemo, useState } from "react";
import { connectSessionStream } from "../api/realtime";
import { buildConversationItems } from "../conversationItems";
import type { WebMessages } from "../i18n";

export function SessionConsole(props: {
  labels: WebMessages;
  token: string;
  sessionId: string;
  loadOutput: () => Promise<TerminalOutputChunk[]>;
  loadMessages: () => Promise<SessionMessage[]>;
  onSend: (text: string) => Promise<void>;
}) {
  const [output, setOutput] = useState<TerminalOutputChunk[]>([]);
  const [messages, setMessages] = useState<SessionMessage[]>([]);
  const [prompt, setPrompt] = useState("");
  const [sendError, setSendError] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const conversation = useMemo(() => buildConversationItems(messages, output), [messages, output]);

  useEffect(() => {
    let mounted = true;
    void Promise.all([props.loadOutput(), props.loadMessages()]).then(
      ([output, messages]) => {
        if (!mounted) return;
        setOutput(output);
        setMessages(messages);
      }
    );

    const closeStream = connectSessionStream({
      token: props.token,
      sessionId: props.sessionId,
      onEvent(event: RealtimeEvent) {
        if (event.type === "codex.output.chunk") {
          setOutput((current) => [...current, event]);
        }
      }
    });
    return () => {
      mounted = false;
      closeStream();
    };
  }, [props.token, props.sessionId]);

  return (
    <section className="chat-shell">
      <div className="chat-scroll">
        {conversation.length ? (
          conversation.map((item) => (
            <article className={`chat-bubble ${item.role}`} key={item.id}>
              <strong>{item.role === "user" ? props.labels.you : "Codex"}</strong>
              <pre>{item.text}</pre>
            </article>
          ))
        ) : (
          <section className="chat-empty">
            <div className="terminal-mark">&gt;_</div>
            <h2>{props.labels.startCodexChat}</h2>
            <p>{props.labels.startCodexChatHint}</p>
          </section>
        )}
      </div>
      <form
        className="chat-composer"
        onSubmit={async (event) => {
          event.preventDefault();
          const text = prompt.trim();
          if (!text || isSending) return;
          setSendError(null);
          setIsSending(true);
          setMessages((current) => [...current, { role: "user", text }]);
          setPrompt("");
          try {
            await props.onSend(text);
          } catch (caught) {
            const message = caught instanceof Error && caught.message.includes("agent_offline")
              ? props.labels.agentOffline
              : props.labels.sendFailed;
            setSendError(message);
          } finally {
            setIsSending(false);
          }
        }}
      >
        <textarea
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
          placeholder={props.labels.promptPlaceholder}
          rows={3}
        />
        <button aria-label={props.labels.send} disabled={!prompt.trim() || isSending} type="submit">
          {props.labels.send}
        </button>
      </form>
      {sendError ? <p className="chat-error">{sendError}</p> : null}
    </section>
  );
}
