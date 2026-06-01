import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

export function createBindCode() {
  return randomBytes(6).toString("base64url");
}

export function createPairingToken() {
  return randomBytes(24).toString("base64url");
}

export function createDeviceToken() {
  return randomBytes(32).toString("base64url");
}

export function hashSecret(secret: string) {
  return createHash("sha256").update(secret).digest("hex");
}

export function verifySecret(hash: string, secret: string) {
  const actual = Buffer.from(hashSecret(secret), "hex");
  const expected = Buffer.from(hash, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function bindCodeExpiry(now = new Date()) {
  return new Date(now.getTime() + 5 * 60 * 1000);
}

export function pairingExpiry(now = new Date()) {
  return new Date(now.getTime() + 5 * 60 * 1000);
}

export function buildAgentLoginPayload(serverUrl: string, pairingToken: string) {
  return {
    type: "codex-transit.agent-login" as const,
    version: 1 as const,
    serverUrl: serverUrl.replace(/\/+$/, ""),
    pairingToken
  };
}
