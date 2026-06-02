import type { CodexHistoryMessage, CodexModel, RealtimeEvent } from "@codex-transit/shared";
import { ChevronLeft, Clock3, TerminalSquare } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { connectSessionStream } from "../api/realtime";
import type { LiveTurnState } from "../conversationItems";
import type { WebMessages } from "../i18n";
import { ChatComposer, type ComposerModelOption } from "./ChatComposer";
import { LiveTurnBubble } from "./LiveTurnBubble";

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
  models: CodexModel[];
  modelsLoading: boolean;
  selectedModel: string | null;
  onBack: () => void;
  onHistory: () => void;
  onSelectModel: (model: string) => void;
  onSend: (text: string, model: string | null) => Promise<void>;
}) {
  const [prompt, setPrompt] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isRealtimeConnected, setIsRealtimeConnected] = useState(false);
  const [userMessages, setUserMessages] = useState<UserMessage[]>([]);
  const [liveTurn, setLiveTurn] = useState<LiveTurnState | null>(null);
  const userMessageSeq = useRef(0);
  const submitLock = useRef(false);
  const lastSubmit = useRef<{ text: string; at: number } | null>(null);
  const timeoutHandle = useRef<number | null>(null);

  const historyConversation = props.historyMessages.map((message) => ({
    id: message.id,
    role: message.role === "user" ? "user" as const : "codex" as const,
    text: message.text
  }));
  const visibleConversation = [
    ...historyConversation,
    ...userMessages
  ];
  const modelOptions: ComposerModelOption[] = props.models.map((model) => ({
    id: model.id,
    label: model.label,
    available: model.available
  }));

  useEffect(() => {
    setUserMessages([]);
    setLiveTurn(null);
    setPrompt("");
    setIsSending(false);
    userMessageSeq.current = 0;
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
          setLiveTurn((current) => {
            if (!current) return current;
            return {
              ...current,
              status: "streaming",
              text: `${current.text}${event.text}`
            };
          });
          return;
        }
        if (event.type === "codex.turn.completed") {
          if (timeoutHandle.current) {
            window.clearTimeout(timeoutHandle.current);
            timeoutHandle.current = null;
          }
          setIsSending(false);
          setLiveTurn((current) => current ? { ...current, status: "completed" } : current);
          return;
        }
        if (event.type === "codex.turn.failed") {
          if (timeoutHandle.current) {
            window.clearTimeout(timeoutHandle.current);
            timeoutHandle.current = null;
          }
          setIsSending(false);
          setLiveTurn((current) => current ? {
            ...current,
            status: "failed",
            errorMessage: event.message,
            text: event.message
          } : current);
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
    <section className="grid h-[calc(100vh-32px)] grid-rows-[auto_1fr_auto] overflow-hidden px-4 pb-4 pt-4 text-white">
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
        {liveTurn && liveTurn.status !== "completed" ? <LiveTurnBubble liveTurn={liveTurn} /> : null}
      </div>

      <ChatComposer
        labels={props.labels}
        prompt={prompt}
        disabled={isSending || !isRealtimeConnected}
        sending={isSending}
        models={modelOptions}
        modelsLoading={props.modelsLoading}
        selectedModel={props.selectedModel}
        onPromptChange={setPrompt}
        onModelChange={props.onSelectModel}
        onSubmit={async (event) => {
          event.preventDefault();
          const text = prompt.trim();
          if (!text || isSending || submitLock.current) return;
          const now = Date.now();
          if (lastSubmit.current && lastSubmit.current.text === text && now - lastSubmit.current.at < 1200) {
            return;
          }
          submitLock.current = true;
          lastSubmit.current = { text, at: now };
          setPrompt("");
          setIsSending(true);
          const messageId = `local-user-${props.sessionId}-${userMessageSeq.current++}`;
          setUserMessages((current) => [...current, { id: messageId, role: "user", text }]);
          setLiveTurn({
            status: "waiting",
            text: "",
            errorMessage: null,
            turnKey: `${props.sessionId}-${Date.now()}`
          });

          try {
            await props.onSend(text, props.selectedModel);
            if (timeoutHandle.current) {
              window.clearTimeout(timeoutHandle.current);
            }
            timeoutHandle.current = window.setTimeout(() => {
              setLiveTurn((current) => current ? {
                ...current,
                status: "waiting",
                text: "消息已发送，暂未收到 Codex 输出，仍在等待中。"
              } : current);
            }, 45000);
          } catch (caught) {
            const message = caught instanceof Error && caught.message.includes("agent_offline")
              ? props.labels.agentOffline
              : props.labels.sendFailed;
            setIsSending(false);
            setLiveTurn((current) => current ? {
              ...current,
              status: "failed",
              errorMessage: message,
              text: message
            } : current);
          } finally {
            submitLock.current = false;
          }
        }}
      />
    </section>
  );
}
