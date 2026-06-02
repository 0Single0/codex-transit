import { describe, expect, it } from "vitest";
import { finalizeLiveTurn, historyMessagesToConversation, outputChunksToConversation } from "./conversationItems";

describe("conversation items", () => {
  it("maps history messages to conversation items", () => {
    expect(
      historyMessagesToConversation([
        { id: "m1", role: "user", text: "帮我加登录" },
        { id: "m2", role: "assistant", text: "好的" }
      ])
    ).toEqual([
      { id: "m1", kind: "message", role: "user", text: "帮我加登录" },
      { id: "m2", kind: "message", role: "codex", text: "好的" }
    ]);
  });

  it("maps output chunks to codex conversation items", () => {
    expect(
      outputChunksToConversation([
        { seq: 0, stream: "stdout", text: "Thinking..." },
        { seq: 1, stream: "stdout", text: "Done" }
      ])
    ).toEqual([
      { id: "codex-output-0", kind: "message", role: "codex", text: "Thinking..." },
      { id: "codex-output-1", kind: "message", role: "codex", text: "Done" }
    ]);
  });

  it("persists the completed assistant response as a normal codex bubble", () => {
    expect(
      finalizeLiveTurn({
        status: "completed",
        text: "最终回复",
        errorMessage: null,
        turnKey: "turn-2"
      })
    ).toEqual({
      id: "live-turn-turn-2",
      kind: "message",
      role: "codex",
      text: "最终回复"
    });
  });

  it("uses error text when the turn failed", () => {
    expect(
      finalizeLiveTurn({
        status: "failed",
        text: "",
        errorMessage: "发送失败",
        turnKey: "turn-3"
      })
    ).toEqual({
      id: "live-turn-turn-3",
      kind: "message",
      role: "codex",
      text: "发送失败"
    });
  });
});
