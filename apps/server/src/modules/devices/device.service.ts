import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

export function createBindCode() {
  return randomBytes(6).toString("base64url");
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
