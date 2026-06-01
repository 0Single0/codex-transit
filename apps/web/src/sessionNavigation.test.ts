import { describe, expect, it } from "vitest";
import { openSessionNavigation } from "./sessionNavigation";

describe("session navigation", () => {
  it("opens selected project sessions in the console tab", () => {
    expect(openSessionNavigation({ id: "session-1" })).toEqual({
      activeTab: "sessions",
      selectedSessionId: "session-1"
    });
  });
});
