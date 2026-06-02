import { describe, expect, it } from "vitest";
import { buildConversationItems, finalizeLiveTurn } from "./conversationItems";

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

  it("keeps one live assistant bubble through waiting and streaming", () => {
    expect(
      buildConversationItems(
        [],
        [],
        {
          status: "streaming",
          text: "partial answer",
          errorMessage: null,
          turnKey: "turn-1"
        }
      )
    ).toEqual([
      { id: "live-turn-turn-1", role: "codex", text: "partial answer" }
    ]);
  });
});

describe("finalizeLiveTurn", () => {
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
      role: "codex",
      text: "发送失败"
    });
  });
});
