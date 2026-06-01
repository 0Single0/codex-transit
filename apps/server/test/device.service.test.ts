import { describe, expect, it } from "vitest";
import {
  buildAgentLoginPayload,
  hashSecret,
  createPairingToken,
  pairingExpiry,
  verifySecret
} from "../src/modules/devices/device.service";

describe("device service", () => {
  it("verifies a matching device token hash", () => {
    const hash = hashSecret("device-token");
    expect(verifySecret(hash, "device-token")).toBe(true);
  });

  it("rejects a non-matching device token", () => {
    const hash = hashSecret("device-token");
    expect(verifySecret(hash, "other-token")).toBe(false);
  });

  it("builds an agent login QR payload", () => {
    expect(buildAgentLoginPayload("https://relay.example.com/", "pair-token")).toEqual({
      type: "codex-transit.agent-login",
      version: 1,
      serverUrl: "https://relay.example.com",
      pairingToken: "pair-token"
    });
  });

  it("expires pending agent login pairings quickly", () => {
    const now = new Date("2026-06-01T00:00:00.000Z");
    expect(pairingExpiry(now).toISOString()).toBe("2026-06-01T00:05:00.000Z");
  });

  it("creates pairing tokens long enough for QR login", () => {
    expect(createPairingToken()).toHaveLength(32);
  });
});
