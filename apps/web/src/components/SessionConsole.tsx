import type { CodexHistoryMessage, RealtimeEvent, TerminalOutputChunk } from "@codex-transit/shared";
import { ChevronLeft, Clock3, SendHorizontal, TerminalSquare } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { connectSessionStream } from "../api/realtime";
import { buildConversationItems } from "../conversationItems";
import type { WebMessages } from "../i18n";

type UserMessage = {
  id: string;
  role: "user";
  text: string;
};

export function SessionConsole(props: {
  labels: WebMessages;
  token: string;
  sessionId: string;
  projectName: string;
  projectPath: string;
  historyMessages: CodexHistoryMessage[];
  onBack: () => void;
  onHistory: () => void;
  onSend: (text: string) => Promise<void>;
}) {
  const [output, setOutput] = useState<TerminalOutputChunk[]>([]);
  const [prompt, setPrompt] = useState("");
  const [sendError, setSendError] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [isRealtimeConnected, setIsRealtimeConnected] = useState(false);
  const [isWaitingResponse, setIsWaitingResponse] = useState(false);
  const [lastSendAt, setLastSendAt] = useState<number | null>(null);
  const [userMessages, setUserMessages] = useState<UserMessage[]>([]);
  const userMessageSeq = useRef(0);
  const submitLock = useRef(false);
  const lastSubmit = useRef<{ text: string; at: number } | null>(null);
  const timeoutHandle = useRef<number | null>(null);
  const waitingStartAt = useRef<number | null>(null);
  const conversation = useMemo(() => buildConversationItems([], output), [output]);
  const historyConversation = props.historyMessages.map((message) => ({
    id: message.id,
    role: message.role === "user" ? "user" as const : "codex" as const,
    text: message.text
  }));
  const visibleConversation = [
    ...historyConversation,
    ...userMessages,
    ...conversation
  ];

  useEffect(() => {
    setOutput([]);
    setUserMessages([]);
    userMessageSeq.current = 0;
    setIsWaitingResponse(false);
    if (timeoutHandle.current) {
      window.clearTimeout(timeoutHandle.current);
      timeoutHandle.current = null;
    }
  }, [props.sessionId]);

  useEffect(() => {
    const stream = connectSessionStream({
      token: props.token,
      sessionId: props.sessionId,
      onConnected: () => setIsRealtimeConnected(true),
      onDisconnected: () => setIsRealtimeConnected(false),
      onError: () => setIsRealtimeConnected(false),
      onEvent(event: RealtimeEvent) {
        if (event.type === "codex.output.chunk") {
          if (timeoutHandle.current) {
            window.clearTimeout(timeoutHandle.current);
            timeoutHandle.current = null;
          }
          setOutput((current) => [...current, event]);
          return;
        }
        if (event.type === "codex.turn.completed") {
          if (timeoutHandle.current) {
            window.clearTimeout(timeoutHandle.current);
            timeoutHandle.current = null;
          }
          setIsWaitingResponse(false);
        }
      }
    });
    return () => {
      if (timeoutHandle.current) {
        window.clearTimeout(timeoutHandle.current);
        timeoutHandle.current = null;
      }
      stream.close();
    };
  }, [props.token, props.sessionId]);

  return (
    <section className="grid min-h-[calc(100vh-32px)] grid-rows-[auto_1fr_auto] px-4 pb-4 pt-4 text-white">
      <header className="grid grid-cols-[44px_1fr_44px] items-center gap-3">
        <button
          className="grid h-11 w-11 place-items-center rounded-full bg-white/[0.06] text-slate-200"
          onClick={props.onBack}
          type="button"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <div className="min-w-0 text-center">
          <h1 className="truncate text-base font-semibold">{props.projectName}</h1>
          <p className="mt-0.5 truncate text-[11px] text-slate-500">{props.projectPath}</p>
          <p className={`mt-1 text-[11px] ${isRealtimeConnected ? "text-emerald-300" : "text-amber-300"}`}>
            {isRealtimeConnected ? "实时通道已连接" : "实时通道未连接"}
          </p>
        </div>
        <button
          className="grid h-11 w-11 place-items-center rounded-full bg-white/[0.06] text-slate-200"
          onClick={props.onHistory}
          type="button"
        >
          <Clock3 className="h-5 w-5" />
        </button>
      </header>

      <div className="mt-4 min-h-0 space-y-4 overflow-y-auto pb-4 pr-1">
        {isWaitingResponse ? (
          <div className="rounded-2xl border border-amber-300/20 bg-amber-500/10 px-4 py-3 text-xs text-amber-200">
            正在等待 Codex 输出...
          </div>
        ) : null}
        {visibleConversation.length ? (
          visibleConversation.map((item) => (
            <article
              className={`grid max-w-[88%] gap-2 rounded-[22px] px-4 py-3 ${
                item.role === "user"
                  ? "ml-auto bg-violet-600 text-white"
                  : "mr-auto border border-white/10 bg-[#101822] text-slate-100"
              }`}
              key={item.id}
            >
              <strong className="text-xs font-semibold opacity-70">{item.role === "user" ? props.labels.you : "Codex"}</strong>
              <pre className="whitespace-pre-wrap break-words font-mono text-[13px] leading-6">{item.text}</pre>
            </article>
          ))
        ) : (
          <section className="grid h-full min-h-[440px] place-items-center text-center">
            <div>
              <div className="mx-auto grid h-20 w-20 place-items-center rounded-[24px] border border-violet-400/40 bg-violet-500/10 text-violet-200 shadow-violet-glow">
                <TerminalSquare className="h-9 w-9" />
              </div>
              <h2 className="mt-5 text-xl font-semibold">{props.labels.startCodexChat}</h2>
              <p className="mx-auto mt-2 max-w-[280px] text-sm leading-6 text-slate-500">{props.labels.startCodexChatHint}</p>
            </div>
          </section>
        )}
      </div>

      <form
        className="rounded-[26px] border border-white/10 bg-[#101822]/95 p-3 shadow-[0_18px_45px_rgba(0,0,0,0.35)]"
        onSubmit={async (event) => {
          event.preventDefault();
          const text = prompt.trim();
          if (!text || isSending || isWaitingResponse || submitLock.current) return;
          const now = Date.now();
          if (lastSubmit.current && lastSubmit.current.text === text && now - lastSubmit.current.at < 1200) {
            return;
          }
          submitLock.current = true;
          lastSubmit.current = { text, at: now };
          setSendError(null);
          setIsSending(true);
          setPrompt("");
          const messageId = `local-user-${props.sessionId}-${userMessageSeq.current++}`;
          setUserMessages((current) => [
            ...current,
            { id: messageId, role: "user", text }
          ]);
          try {
            await props.onSend(text);
            setLastSendAt(Date.now());
            setIsWaitingResponse(true);
            waitingStartAt.current = Date.now();
            if (timeoutHandle.current) {
              window.clearTimeout(timeoutHandle.current);
            }
            timeoutHandle.current = window.setTimeout(() => {
              setSendError("消息已发送，暂未收到 Codex 输出，仍在等待中。");
            }, 45000);
          } catch (caught) {
            const message = caught instanceof Error && caught.message.includes("agent_offline")
              ? props.labels.agentOffline
              : props.labels.sendFailed;
            setSendError(message);
            setIsWaitingResponse(false);
            if (timeoutHandle.current) {
              window.clearTimeout(timeoutHandle.current);
              timeoutHandle.current = null;
            }
          } finally {
            setIsSending(false);
            submitLock.current = false;
          }
        }}
      >
        <div className="flex items-end gap-3">
          <textarea
            className="max-h-32 min-h-12 flex-1 resize-none bg-transparent px-2 py-3 text-sm leading-6 text-white outline-none placeholder:text-slate-600"
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            placeholder={props.labels.promptPlaceholder}
            rows={1}
          />
          <button
            aria-label={props.labels.send}
            className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-violet-600 text-white transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-40"
            disabled={!prompt.trim() || isSending || isWaitingResponse}
            type="submit"
          >
            <SendHorizontal className="h-5 w-5" />
          </button>
        </div>
        {sendError ? <p className="px-2 pb-1 text-sm text-red-300">{sendError}</p> : null}
        {lastSendAt ? <p className="px-2 pb-1 text-[11px] text-slate-500">最后发送时间: {new Date(lastSendAt).toLocaleTimeString()}</p> : null}
        {isWaitingResponse && waitingStartAt.current ? (
          <p className="px-2 pb-1 text-[11px] text-slate-500">
            已等待: {Math.max(1, Math.floor((Date.now() - waitingStartAt.current) / 1000))}s
          </p>
        ) : null}
      </form>
    </section>
  );
}
