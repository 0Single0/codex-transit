import { decryptTransportPayload, isEncryptedPayload } from "@codex-transit/shared";

const TEST_TRANSPORT_SECRET = process.env.TEST_TRANSPORT_SECRET ?? "";

export function readPossiblyEncryptedBody<T>(body: unknown): T {
  if (!isEncryptedPayload(body)) {
    return body as T;
  }
  if (!TEST_TRANSPORT_SECRET) {
    throw new Error("Encrypted payload received but TEST_TRANSPORT_SECRET is not configured.");
  }
  return decryptTransportPayload<T>(body, TEST_TRANSPORT_SECRET);
}
