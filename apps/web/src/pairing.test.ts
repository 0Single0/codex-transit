import { describe, expect, it } from "vitest";
import { buildPairingPayload, parseAgentLoginPayload } from "./pairing";

describe("buildPairingPayload", () => {
  it("serializes the server URL and bind code for QR pairing", () => {
    const payload = buildPairingPayload("http://localhost:4000/", "abc12345");

    expect(JSON.parse(payload)).toEqual({
      type: "codex-transit.pairing",
      version: 1,
      serverUrl: "http://localhost:4000",
      bindCode: "abc12345"
    });
  });

  it("parses Agent login QR payloads scanned by the mobile app", () => {
    const payload = JSON.stringify({
      type: "codex-transit.agent-login",
      version: 1,
      serverUrl: "http://localhost:4000",
      pairingToken: "pair-token"
    });

    expect(parseAgentLoginPayload(payload)).toEqual({
      serverUrl: "http://localhost:4000",
      pairingToken: "pair-token"
    });
  });
});
