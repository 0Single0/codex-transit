import { encryptTransportPayload } from "@codex-transit/shared";

const TEST_TRANSPORT_SECRET = import.meta.env.VITE_TEST_TRANSPORT_SECRET ?? "";

export function maybeEncryptPayload<T>(value: T): T | ReturnType<typeof encryptTransportPayload<T>> {
  if (!TEST_TRANSPORT_SECRET) return value;
  return encryptTransportPayload(value, TEST_TRANSPORT_SECRET);
}
