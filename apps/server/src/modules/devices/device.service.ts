import { createHash, randomBytes } from "node:crypto";

export function createBindCode() {
  return randomBytes(6).toString("base64url");
}

export function createDeviceToken() {
  return randomBytes(32).toString("base64url");
}

export function hashSecret(secret: string) {
  return createHash("sha256").update(secret).digest("hex");
}

export function bindCodeExpiry(now = new Date()) {
  return new Date(now.getTime() + 5 * 60 * 1000);
}
