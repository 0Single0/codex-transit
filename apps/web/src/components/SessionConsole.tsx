import type { CodexHistoryMessage, CodexModel, RealtimeEvent } from "@codex-transit/shared";
import { ChevronLeft, Clock3, TerminalSquare } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { connectSessionStream } from "../api/realtime";
import {
  finalizeLiveTurn,
  historyMessagesToConversation,
  type AttachmentItem,
  type ConversationItem,
  type LiveTurnState,
  type LocalAssistantMessage,
  type ToolCallItem
} from "../conversationItems";
import type { WebMessages } from "../i18n";
import { ChatComposer, type ComposerModelOption } from "./ChatComposer";
import { ConversationMessage } from "./ConversationMessage";
import { LiveTurnBubble } from "./LiveTurnBubble";
import type { ApprovalPolicy } from "./ComposerMenus";

type UserMessage = Extract<ConversationItem, { kind: "message"; role: "user" }>;

export function SessionConsole(props: {
  labels: WebMessages;
  token: string;
  sessionId: string;
  projectName: string;
  projectPath: string;
  historyMessages: CodexHistoryMessage[];
  models: CodexModel[];
  modelsLoading: boolean;
  modelError: string | null;
  selectedModel: string | null;
  onBack: () => void;
  onHistory: () => void;
  onSelectModel: (model: string) => void;
  onSend: (
    text: string,
    model: string | null,
    options: {
      approvalPolicy: ApprovalPolicy;
      attachments: AttachmentItem[];
    }
  ) => Promise<void>;
  onUploadAttachment: (file: File) => Promise<{ path: string }>;
}) {
  const [prompt, setPrompt] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isRealtimeConnected, setIsRealtimeConnected] = useState(false);
  const [userMessages, setUserMessages] = useState<UserMessage[]>([]);
  const [assistantMessages, setAssistantMessages] = useState<LocalAssistantMessage[]>([]);
  const [toolCalls, setToolCalls] = useState<ToolCallItem[]>([]);
  const [liveTurn, setLiveTurn] = useState<LiveTurnState | null>(null);
  const [attachments, setAttachments] = useState<AttachmentItem[]>([]);
  const [approvalPolicy, setApprovalPolicy] = useState<ApprovalPolicy>("full");
  const [plusMenuOpen, setPlusMenuOpen] = useState(false);
  const [approvalMenuOpen, setApprovalMenuOpen] = useState(false);
  const userMessageSeq = useRef(0);
  const submitLock = useRef(false);
  const lastSubmit = useRef<{ text: string; at: number } | null>(null);
  const timeoutHandle = useRef<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const historyConversation = useMemo(
    () => historyMessagesToConversation(props.historyMessages),
    [props.historyMessages]
  );
  const visibleConversation: ConversationItem[] = [
    ...historyConversation,
    ...userMessages,
    ...assistantMessages,
    ...toolCalls.map((toolCall) => ({ id: toolCall.id, kind: "tool" as const, toolCall }))
  ];
  const modelOptions: ComposerModelOption[] = props.models.map((model) => ({
    id: model.id,
    label: model.label,
    available: model.available
  }));

  useEffect(() => {
    setUserMessages([]);
    setAssistantMessages([]);
    setToolCalls([]);
    setLiveTurn(null);
    setAttachments([]);
    setPrompt("");
    setIsSending(false);
    setPlusMenuOpen(false);
    setApprovalMenuOpen(false);
    userMessageSeq.current = 0;
    if (timeoutHandle.current) {
      window.clearTimeout(timeoutHandle.current);
      timeoutHandle.current = null;
    }
  }, [props.sessionId]);

  useEffect(() => {
    return () => {
      for (const attachment of attachments) {
        if (attachment.previewUrl) {
          URL.revokeObjectURL(attachment.previewUrl);
        }
      }
    };
  }, [attachments]);

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

        if (event.type === "codex.tool.call") {
          setToolCalls((current) => {
            const next = current.filter((item) => item.id !== event.itemId);
            next.push({
              id: event.itemId,
              command: event.command,
              status: event.status,
              ...(event.output ? { output: event.output } : {}),
              ...(typeof event.exitCode === "number" ? { exitCode: event.exitCode } : {})
            });
            return next;
          });
          return;
        }

        if (event.type === "codex.turn.completed") {
          if (timeoutHandle.current) {
            window.clearTimeout(timeoutHandle.current);
            timeoutHandle.current = null;
          }
          setIsSending(false);
          setLiveTurn((current) => {
            const completed = current ? { ...current, status: "completed" as const } : current;
            const finalized = finalizeLiveTurn(completed);
            if (finalized) {
              setAssistantMessages((messages) => [...messages, finalized]);
            }
            return null;
          });
          return;
        }

        if (event.type === "codex.turn.failed") {
          if (timeoutHandle.current) {
            window.clearTimeout(timeoutHandle.current);
            timeoutHandle.current = null;
          }
          setIsSending(false);
          setLiveTurn((current) => {
            const failed = current ? {
              ...current,
              status: "failed" as const,
              errorMessage: event.message,
              text: event.message
            } : current;
            const finalized = finalizeLiveTurn(failed);
            if (finalized) {
              setAssistantMessages((messages) => [...messages, finalized]);
            }
            return null;
          });
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
    <section className="grid h-[calc(100vh-32px)] grid-rows-[auto_1fr_auto] overflow-hidden bg-[#07111c] px-4 pb-4 pt-4 text-white">
      <style>{`
        .codex-scrollbar {
          scrollbar-width: thin;
          scrollbar-color: rgba(148, 163, 184, 0.28) transparent;
        }
        .codex-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .codex-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .codex-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(148, 163, 184, 0.24);
          border-radius: 999px;
        }
        .codex-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(148, 163, 184, 0.38);
        }
      `}</style>
      <input
        accept="image/*"
        className="hidden"
        multiple
        onChange={async (event) => {
          const files = Array.from(event.target.files ?? []);
          if (!files.length) return;
          setAttachments((current) => [
            ...current,
            ...files.map((file, index) => ({
              id: `${file.name}-${Date.now()}-${index}`,
              name: file.name,
              path: file.name,
              file,
              ...(file.type ? { mimeType: file.type } : {}),
              kind: (file.type.startsWith("image/") ? "image" : "file") as "image" | "file",
              ...(file.type.startsWith("image/") ? { previewUrl: URL.createObjectURL(file) } : {})
            }))
          ]);
          event.currentTarget.value = "";
        }}
        ref={fileInputRef}
        type="file"
      />

      <header className="grid grid-cols-[44px_1fr_44px] items-center gap-3 border-b border-white/6 pb-4">
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
            {isRealtimeConnected ? props.labels.realtimeConnected : props.labels.realtimeDisconnected}
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

      <div className="codex-scrollbar mt-4 min-h-0 space-y-7 overflow-y-auto px-1 pb-6 pt-3">
        {visibleConversation.length ? (
          visibleConversation.map((item) => <ConversationMessage item={item} key={item.id} />)
        ) : (
          <section className="grid h-full min-h-[440px] place-items-center text-center">
            <div>
              <div className="mx-auto grid h-20 w-20 place-items-center rounded-[24px] bg-white/[0.04] text-slate-200">
                <TerminalSquare className="h-9 w-9" />
              </div>
              <h2 className="mt-5 text-xl font-semibold">{props.labels.startCodexChat}</h2>
              <p className="mx-auto mt-2 max-w-[280px] text-sm leading-6 text-slate-500">{props.labels.startCodexChatHint}</p>
            </div>
          </section>
        )}
        {liveTurn ? <LiveTurnBubble liveTurn={liveTurn} labels={props.labels} /> : null}
      </div>

      <div className="border-t border-white/6 pt-4">
        <ChatComposer
          labels={props.labels}
          prompt={prompt}
          disabled={isSending || !isRealtimeConnected}
          sending={isSending}
          models={modelOptions}
          modelsLoading={props.modelsLoading}
          modelError={props.modelError}
          selectedModel={props.selectedModel}
          attachments={attachments}
          approvalPolicy={approvalPolicy}
          plusMenuOpen={plusMenuOpen}
          approvalMenuOpen={approvalMenuOpen}
          onPromptChange={setPrompt}
          onModelChange={props.onSelectModel}
          onTogglePlusMenu={() => {
            setPlusMenuOpen((current) => !current);
            setApprovalMenuOpen(false);
          }}
          onOpenApprovalMenu={() => setApprovalMenuOpen(true)}
          onCloseMenus={() => {
            setPlusMenuOpen(false);
            setApprovalMenuOpen(false);
          }}
          onPickFiles={() => fileInputRef.current?.click()}
          onSelectApprovalPolicy={setApprovalPolicy}
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
            setPlusMenuOpen(false);
            setApprovalMenuOpen(false);
            const outgoingAttachments = attachments;
            const messageId = `local-user-${props.sessionId}-${userMessageSeq.current++}`;
            const localUserMessage: UserMessage = {
              id: messageId,
              kind: "message" as const,
              role: "user",
              text,
              ...(outgoingAttachments.length ? { attachments: outgoingAttachments } : {})
            };
            setUserMessages((current) => [...current, localUserMessage]);
            setAttachments([]);
            setLiveTurn({
              status: "waiting",
              text: "",
              errorMessage: null,
              turnKey: `${props.sessionId}-${Date.now()}`
            });

            try {
              const preparedAttachments = await Promise.all(
                outgoingAttachments.map(async (attachment) => {
                  if (attachment.uploadedPath || !attachment.file) {
                    return attachment;
                  }
                  const uploaded = await props.onUploadAttachment(attachment.file);
                  return {
                    ...attachment,
                    uploadedPath: uploaded.path,
                    path: uploaded.path
                  };
                })
              );
              setUserMessages((current) => current.map((message) => (
                message.id === messageId
                  ? {
                      ...message,
                      attachments: preparedAttachments
                    }
                  : message
              )));
              await props.onSend(text, props.selectedModel, {
                approvalPolicy,
                attachments: preparedAttachments
              });
              if (timeoutHandle.current) {
                window.clearTimeout(timeoutHandle.current);
              }
              timeoutHandle.current = window.setTimeout(() => {
                setLiveTurn((current) => current ? {
                  ...current,
                  status: "waiting",
                  text: props.labels.waitingForOutput
                } : current);
              }, 45000);
            } catch (caught) {
              const message = caught instanceof Error && caught.message.includes("agent_offline")
                ? props.labels.agentOffline
                : props.labels.sendFailed;
              setIsSending(false);
              setLiveTurn((current) => {
                const failed = current ? {
                  ...current,
                  status: "failed" as const,
                  errorMessage: message,
                  text: message
                } : current;
                const finalized = finalizeLiveTurn(failed);
                if (finalized) {
                  setAssistantMessages((messages) => [...messages, finalized]);
                }
                return null;
              });
            } finally {
              submitLock.current = false;
            }
          }}
        />
      </div>
    </section>
  );
}
