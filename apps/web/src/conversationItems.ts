import type { CodexHistoryMessage, SessionMessage, TerminalOutputChunk } from "@codex-transit/shared";

export type AttachmentItem = {
  id: string;
  name: string;
  path: string;
  mimeType?: string;
  kind: "image" | "file";
  previewUrl?: string;
  uploadedPath?: string;
  file?: File;
};

export type ToolCallItem = {
  id: string;
  command: string;
  status: "in_progress" | "completed" | "failed" | "declined";
  output?: string;
  exitCode?: number;
};

export type UserConversationMessage = {
  id: string;
  kind: "message";
  role: "user";
  text: string;
  attachments?: AttachmentItem[];
};

export type CodexConversationMessage = {
  id: string;
  kind: "message";
  role: "codex";
  text: string;
  attachments?: AttachmentItem[];
};

export type ConversationItem =
  | UserConversationMessage
  | CodexConversationMessage
  | {
      id: string;
      kind: "tool";
      toolCall: ToolCallItem;
    };

export type LocalAssistantMessage = CodexConversationMessage;

export type LiveTurnState = {
  status: "idle" | "waiting" | "streaming" | "failed" | "completed";
  text: string;
  errorMessage: string | null;
  turnKey: string;
};

export function historyMessagesToConversation(messages: CodexHistoryMessage[]): ConversationItem[] {
  return messages.map((message) => (
    message.role === "user"
      ? {
          id: message.id,
          kind: "message" as const,
          role: "user" as const,
          text: message.text
        }
      : {
          id: message.id,
          kind: "message" as const,
          role: "codex" as const,
          text: message.text
        }
  ));
}

export function sessionMessagesToConversation(messages: SessionMessage[]): ConversationItem[] {
  return messages.map((message, index) => (
    message.role === "user"
      ? {
          id: message.id ?? `message-${index}`,
          kind: "message" as const,
          role: "user" as const,
          text: message.text
        }
      : {
          id: message.id ?? `message-${index}`,
          kind: "message" as const,
          role: "codex" as const,
          text: message.text
        }
  ));
}

export function outputChunksToConversation(output: TerminalOutputChunk[]): ConversationItem[] {
  return output
    .map((chunk) => ({
      id: `codex-output-${chunk.seq}`,
      kind: "message" as const,
      role: "codex" as const,
      text: chunk.text.trim()
    }))
    .filter((item) => item.text);
}

export function finalizeLiveTurn(liveTurn: LiveTurnState | null): LocalAssistantMessage | null {
  if (!liveTurn) return null;
  const text = (liveTurn.errorMessage ?? liveTurn.text).trim();
  if (!text) return null;

  return {
    id: `live-turn-${liveTurn.turnKey}`,
    kind: "message" as const,
    role: "codex" as const,
    text
  };
}
