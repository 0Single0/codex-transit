import { describe, expect, it } from "vitest";
import { toProjectSummary } from "../src/modules/projects/project.service";

describe("project service", () => {
  it("maps database project ids to protocol projectId fields", () => {
    expect(
      toProjectSummary({
        id: "00000000-0000-4000-8000-000000000001",
        displayName: "codex-transit",
        pathAlias: "codex-transit",
        available: true
      })
    ).toEqual({
      projectId: "00000000-0000-4000-8000-000000000001",
      displayName: "codex-transit",
      pathAlias: "codex-transit",
      available: true
    });
  });
});
