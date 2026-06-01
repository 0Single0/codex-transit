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

  for (const chunk of output) {
    const text = chunk.text.trim();
    if (!text) continue;
    items.push({
      id: `codex-output-${chunk.seq}`,
      role: "codex",
      text
    });
  }

  return items;
}
