import { describe, expect, it } from "vitest";
import { buildPairingPayload } from "./pairing";

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
});
