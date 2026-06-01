import { describe, expect, it } from "vitest";
import { parsePairingPayload } from "./pairing";

describe("parsePairingPayload", () => {
  it("extracts server URL and bind code from a Codex Transit pairing payload", () => {
    const payload = JSON.stringify({
      type: "codex-transit.pairing",
      version: 1,
      serverUrl: "http://localhost:4000",
      bindCode: "abc12345"
    });

    expect(parsePairingPayload(payload)).toEqual({
      serverUrl: "http://localhost:4000",
      bindCode: "abc12345"
    });
  });

  it("rejects unrelated QR payloads", () => {
    expect(parsePairingPayload(JSON.stringify({ type: "other", bindCode: "abc12345" }))).toBeNull();
    expect(parsePairingPayload("not-json")).toBeNull();
  });
});
