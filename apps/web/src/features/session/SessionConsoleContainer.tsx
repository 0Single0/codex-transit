import type { CodexHistoryMessage, CodexModel, RealtimeEvent } from "@codex-transit/shared";
import { ChevronLeft, Clock3, TerminalSquare } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { connectSessionStream } from "../../api/realtime";
import {
  historyMessagesToConversation,
  type AttachmentItem,
  type ConversationItem,
  type LiveTurnState
} from "../../conversationItems";
import type { WebMessages } from "../../i18n";
import { ChatComposer, type ComposerModelOption } from "../../components/ChatComposer";
import { ConversationMessage } from "../../components/ConversationMessage";
import { LiveTurnBubble } from "../../components/LiveTurnBubble";
import type { ApprovalPolicy } from "../../components/ComposerMenus";

type UserMessage = Extract<ConversationItem, { kind: "message"; role: "user" }>;
type CodexMessage = Extract<ConversationItem, { kind: "message"; role: "codex" }>;
type ToolConversationItem = Extract<ConversationItem, { kind: "tool" }>;

export function SessionConsoleContainer(props: {
  labels: WebMessages;
  token: string;
  sessionId?: string;
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
  allowDraft?: boolean;
  pendingInitialMessage?: {
    text: string;
    model: string | null;
    approvalPolicy: ApprovalPolicy;
    attachments: AttachmentItem[];
  } | null;
  onPendingInitialMessageHandled?: () => void;
  onCreateRuntimeSession?: () => Promise<string>;
  onDraftSessionReady?: (
    sessionId: string,
    initialMessage: {
      text: string;
      model: string | null;
      approvalPolicy: ApprovalPolicy;
      attachments: AttachmentItem[];
    }
  ) => void;
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
  const isDraft = Boolean(props.allowDraft && !props.sessionId);
  const [prompt, setPrompt] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isRealtimeConnected, setIsRealtimeConnected] = useState(false);
  const [conversationItems, setConversationItems] = useState<ConversationItem[]>([]);
  const [liveConversationItems, setLiveConversationItems] = useState<ConversationItem[]>([]);
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
  const initialMessageConsumedForSession = useRef<string | null>(null);
  const liveConversationItemsRef = useRef<ConversationItem[]>([]);
  const scrollViewportRef = useRef<HTMLDivElement | null>(null);
  const bottomAnchorRef = useRef<HTMLDivElement | null>(null);
  const shouldStickToBottomRef = useRef(true);

  const historyConversation = useMemo(
    () => historyMessagesToConversation(props.historyMessages),
    [props.historyMessages]
  );

  const visibleConversation: ConversationItem[] = [
    ...historyConversation,
    ...conversationItems,
    ...liveConversationItems
  ];

  const modelOptions: ComposerModelOption[] = props.models.map((model) => ({
    id: model.id,
    label: model.label,
    available: model.available
  }));

  useEffect(() => {
    liveConversationItemsRef.current = liveConversationItems;
  }, [liveConversationItems]);

  useEffect(() => {
    revokeAttachmentPreviews(attachments);
    setConversationItems([]);
    setLiveConversationItems([]);
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
    initialMessageConsumedForSession.current = null;
    liveConversationItemsRef.current = [];
    shouldStickToBottomRef.current = true;
  }, [props.sessionId]);

  useEffect(() => {
    return () => revokeAttachmentPreviews(attachments);
  }, []);

  useEffect(() => {
    function handleScroll() {
      const viewport = scrollViewportRef.current;
      if (!viewport) return;
      const distanceFromBottom = viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight;
      shouldStickToBottomRef.current = distanceFromBottom < 48;
    }

    const viewport = scrollViewportRef.current;
    if (!viewport) return;

    handleScroll();
    viewport.addEventListener("scroll", handleScroll, { passive: true });
    return () => viewport.removeEventListener("scroll", handleScroll);
  }, []);

  function clearLiveConversation() {
    liveConversationItemsRef.current = [];
    setLiveConversationItems([]);
  }

  function scrollToBottom(force = false, behavior: ScrollBehavior = "auto") {
    const viewport = scrollViewportRef.current;
    if (!viewport) return;
    if (!force && !shouldStickToBottomRef.current) return;
    viewport.scrollTo({
      top: viewport.scrollHeight,
      behavior
    });
  }

  function commitLiveConversation(extraAssistantText?: string) {
    const nextItems = [...liveConversationItemsRef.current];
    const trailingText = extraAssistantText?.trim();
    if (trailingText) {
      nextItems.push({
        id: `live-message-${props.sessionId ?? "draft"}-${Date.now()}-${nextItems.length}`,
        kind: "message",
        role: "codex",
        text: trailingText
      });
    }
    if (nextItems.length) {
      setConversationItems((current) => [...current, ...nextItems]);
    }
    clearLiveConversation();
    setLiveTurn(null);
  }

  useEffect(() => {
    if (!props.sessionId) {
      setIsRealtimeConnected(false);
      return;
    }

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
          setLiveTurn((current) => current ? { ...current, status: "streaming" } : current);
          setLiveConversationItems((current) => {
            const lastItem = current.at(-1);
            if (lastItem?.kind === "message" && lastItem.role === "codex") {
              return current.map((item, index) => (
                index === current.length - 1 && item.kind === "message" && item.role === "codex"
                  ? {
                      ...item,
                      text: `${item.text}${event.text}`
                    }
                  : item
              ));
            }

            const nextMessage: CodexMessage = {
              id: `live-output-${props.sessionId}-${Date.now()}-${current.length}`,
              kind: "message",
              role: "codex",
              text: event.text
            };
            return [...current, nextMessage];
          });
          return;
        }

        if (event.type === "codex.tool.call") {
          setLiveTurn((current) => current ? {
            ...current,
            status: current.status === "waiting" ? "streaming" : current.status
          } : current);
          setLiveConversationItems((current) => {
            const nextToolItem: ToolConversationItem = {
              id: event.itemId,
              kind: "tool",
              toolCall: {
                id: event.itemId,
                command: event.command,
                status: event.status,
                ...(event.output ? { output: event.output } : {}),
                ...(typeof event.exitCode === "number" ? { exitCode: event.exitCode } : {})
              }
            };
            const existingIndex = current.findIndex((item) => item.kind === "tool" && item.id === event.itemId);
            if (existingIndex === -1) {
              return [...current, nextToolItem];
            }

            return current.map((item, index) => (
              index === existingIndex ? nextToolItem : item
            ));
          });
          return;
        }

        if (event.type === "codex.turn.completed") {
          if (timeoutHandle.current) {
            window.clearTimeout(timeoutHandle.current);
            timeoutHandle.current = null;
          }
          setIsSending(false);
          commitLiveConversation();
          return;
        }

        if (event.type === "codex.turn.failed") {
          if (timeoutHandle.current) {
            window.clearTimeout(timeoutHandle.current);
            timeoutHandle.current = null;
          }
          setIsSending(false);
          commitLiveConversation(event.message);
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
  }, [props.sessionId, props.token]);

  useEffect(() => {
    if (!props.sessionId || !props.pendingInitialMessage || !isRealtimeConnected) return;
    const initialMessage = props.pendingInitialMessage;
    if (submitLock.current) return;
    if (initialMessageConsumedForSession.current === props.sessionId) return;

    initialMessageConsumedForSession.current = props.sessionId;
    submitLock.current = true;
    setIsSending(true);
    setConversationItems((current) => (
      current.length
        ? current
        : [{
            id: `local-user-${props.sessionId}-initial`,
            kind: "message",
            role: "user",
            text: initialMessage.text,
            ...(initialMessage.attachments.length
              ? { attachments: initialMessage.attachments }
              : {})
          }]
    ));
    clearLiveConversation();
    setLiveTurn({
      status: "waiting",
      text: "",
      errorMessage: null,
      turnKey: `${props.sessionId}-initial`
    });
    props.onPendingInitialMessageHandled?.();

    void props.onSend(
      initialMessage.text,
      initialMessage.model,
      {
        approvalPolicy: initialMessage.approvalPolicy,
        attachments: initialMessage.attachments
      }
    ).catch((caught) => {
      const message = caught instanceof Error ? caught.message : props.labels.sendFailed;
      setIsSending(false);
      commitLiveConversation(message);
    }).finally(() => {
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
      submitLock.current = false;
    });
  }, [
    isRealtimeConnected,
    props.labels.sendFailed,
    props.labels.waitingForOutput,
    props.onPendingInitialMessageHandled,
    props.onSend,
    props.pendingInitialMessage,
    props.sessionId
  ]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      scrollToBottom();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [visibleConversation, liveTurn]);

  return (
    <section className="grid h-full min-h-full grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden bg-[radial-gradient(circle_at_top,_#ffffff_0%,_#f7fafe_38%,_#f7fafe_100%)] text-slate-900">
      <style>{`
        .codex-scrollbar {
          scrollbar-width: thin;
          scrollbar-color: rgba(148, 163, 184, 0.42) transparent;
        }
        .codex-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .codex-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .codex-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(148, 163, 184, 0.34);
          border-radius: 999px;
        }
        .codex-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(100, 116, 139, 0.42);
        }
      `}</style>

      <input
        className="hidden"
        multiple
        onChange={(event) => {
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

      <header className="px-5 pb-2 pt-5 text-slate-900">
        <div className="grid grid-cols-[44px_1fr_auto] items-start gap-3">
          <button
            className="grid place-items-center rounded-full text-slate-500 ring-1 ring-white/80"
            onClick={props.onBack}
            style={{
              background: "#f4f5f7",
              width: "36px",
              height: "36px"
            }}
            type="button"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <div className="min-w-0 pt-0.5 text-center">
            <h1 className="truncate text-[20px] font-semibold tracking-[-0.02em] text-slate-900">{props.projectName}</h1>
            <div className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium text-slate-600">
              <span className={`h-2 w-2 rounded-full ${isRealtimeConnected ? "bg-emerald-500" : "bg-amber-500"}`} />
              <span>{isRealtimeConnected ? props.labels.realtimeConnected : props.labels.realtimeDisconnected}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              className="grid place-items-center rounded-full text-slate-500 ring-1 ring-white/80"
              onClick={props.onHistory}
              style={{
                background: "#f4f5f7",
                width: "36px",
                height: "36px"
              }}
              type="button"
            >
              <Clock3 className="h-5 w-5" />
            </button>
          </div>
        </div>
      </header>

      <div className="codex-scrollbar min-h-0 overflow-y-auto px-5 pb-6 pt-1" ref={scrollViewportRef}>
        <div className="space-y-5">
          {visibleConversation.length ? (
            visibleConversation.map((item) => (
              <ConversationMessage item={item} key={item.id} labels={props.labels} />
            ))
          ) : (
            <section className="grid h-full min-h-[440px] place-items-center text-center">
              <div>
                <div className="mx-auto grid h-20 w-20 place-items-center rounded-[24px] bg-white text-slate-500 shadow-[0_18px_40px_rgba(148,163,184,0.16)]">
                  <TerminalSquare className="h-9 w-9" />
                </div>
                <h2 className="mt-5 text-xl font-semibold text-slate-900">{props.labels.startCodexChat}</h2>
                <p className="mx-auto mt-2 max-w-[280px] text-sm leading-6 text-slate-500">{props.labels.startCodexChatHint}</p>
              </div>
            </section>
          )}
          {liveTurn && liveConversationItems.length === 0 ? <LiveTurnBubble labels={props.labels} liveTurn={liveTurn} /> : null}
          <div aria-hidden className="h-px w-full" ref={bottomAnchorRef} />
        </div>
      </div>

      <div className="px-4 pb-4 pt-2">
        <ChatComposer
          approvalMenuOpen={approvalMenuOpen}
          approvalPolicy={approvalPolicy}
          attachments={attachments}
          disabled={isSending || (!isRealtimeConnected && !isDraft)}
          labels={props.labels}
          modelError={props.modelError}
          models={modelOptions}
          modelsLoading={props.modelsLoading}
          plusMenuOpen={plusMenuOpen}
          prompt={prompt}
          selectedModel={props.selectedModel}
          sending={isSending}
          onCloseMenus={() => {
            setPlusMenuOpen(false);
            setApprovalMenuOpen(false);
          }}
          onModelChange={props.onSelectModel}
          onOpenApprovalMenu={() => setApprovalMenuOpen(true)}
          onPickFiles={() => fileInputRef.current?.click()}
          onPromptChange={setPrompt}
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
            const messageId = `local-user-${props.sessionId ?? "draft"}-${userMessageSeq.current++}`;
            const localUserMessage: UserMessage = {
              id: messageId,
              kind: "message",
              role: "user",
              text,
              ...(outgoingAttachments.length ? { attachments: outgoingAttachments } : {})
            };
            setConversationItems((current) => [...current, localUserMessage]);
            setAttachments([]);
            clearLiveConversation();
            shouldStickToBottomRef.current = true;
            setLiveTurn({
              status: "waiting",
              text: "",
              errorMessage: null,
              turnKey: `${props.sessionId ?? "draft"}-${Date.now()}`
            });
            window.requestAnimationFrame(() => {
              scrollToBottom(true, "smooth");
            });

            try {
              const preparedAttachments = await Promise.all(
                outgoingAttachments.map(async (attachment) => {
                  if (attachment.uploadedPath || !attachment.file) return attachment;
                  const uploaded = await props.onUploadAttachment(attachment.file);
                  return {
                    ...attachment,
                    uploadedPath: uploaded.path,
                    path: uploaded.path
                  };
                })
              );

              setConversationItems((current) => current.map((item) => (
                item.kind === "message" && item.id === messageId
                  ? {
                      ...item,
                      attachments: preparedAttachments
                    }
                  : item
              )));

              if (isDraft) {
                if (!props.onCreateRuntimeSession || !props.onDraftSessionReady) {
                  throw new Error(props.labels.sendFailed);
                }
                const sessionId = await props.onCreateRuntimeSession();
                props.onDraftSessionReady(sessionId, {
                  text,
                  model: props.selectedModel,
                  approvalPolicy,
                  attachments: preparedAttachments
                });
                return;
              }

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
              commitLiveConversation(message);
            } finally {
              submitLock.current = false;
            }
          }}
          onTogglePlusMenu={() => {
            setPlusMenuOpen((current) => !current);
            setApprovalMenuOpen(false);
          }}
        />
      </div>
    </section>
  );
}

function revokeAttachmentPreviews(items: AttachmentItem[]) {
  for (const attachment of items) {
    if (attachment.previewUrl) {
      URL.revokeObjectURL(attachment.previewUrl);
    }
  }
}
