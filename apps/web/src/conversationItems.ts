import type { SessionMessage, TerminalOutputChunk } from "@codex-transit/shared";

export type ConversationItem = {
  id: string;
  role: "user" | "codex";
  text: string;
};

export function buildConversationItems(
  messages: SessionMessage[],
  output: TerminalOutputChunk[]
): ConversationItem[] {
  const items = messages.map((message, index) => ({
    id: message.id ?? `message-${index}`,
    role: message.role === "user" ? "user" as const : "codex" as const,
    text: message.text
  }));
  const outputText = output.map((chunk) => chunk.text).join("\n").trim();
  if (outputText) {
    items.push({
      id: "codex-output",
      role: "codex",
      text: outputText
    });
  }
  return items;
}
