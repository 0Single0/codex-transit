import { describe, expect, it } from "vitest";
import { buildConversationItems } from "./conversationItems";

describe("buildConversationItems", () => {
  it("keeps each codex output chunk as an independent bubble", () => {
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
      { id: "codex-output-0", role: "codex", text: "Thinking..." },
      { id: "codex-output-1", role: "codex", text: "Done" }
    ]);
  });
});
