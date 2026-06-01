import { describe, expect, it } from "vitest";
import { buildConversationItems } from "./conversationItems";

describe("buildConversationItems", () => {
  it("combines user prompts and terminal output into chat items", () => {
    expect(
      buildConversationItems(
        [{ id: "m1", role: "user", text: "帮我加登录" }],
        [
          { seq: 0, stream: "stdout", text: "Thinking..." },
          { seq: 1, stream: "stdout", text: "Done" }
        ]
      )
    ).toEqual([
      { id: "m1", role: "user", text: "帮我加登录" },
      { id: "codex-output", role: "codex", text: "Thinking...\nDone" }
    ]);
  });
});
