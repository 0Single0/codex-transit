import CryptoJS from "crypto-js";

export type EncryptedPayload = {
  encrypted: true;
  algorithm: "aes";
  ciphertext: string;
};

export function encryptTransportPayload<T>(value: T, secret: string): EncryptedPayload {
  return {
    encrypted: true,
    algorithm: "aes",
    ciphertext: CryptoJS.AES.encrypt(JSON.stringify(value), secret).toString()
  };
}

export function decryptTransportPayload<T>(payload: EncryptedPayload, secret: string): T {
  const bytes = CryptoJS.AES.decrypt(payload.ciphertext, secret);
  const decrypted = bytes.toString(CryptoJS.enc.Utf8);
  if (!decrypted) {
    throw new Error("Failed to decrypt transport payload");
  }
  return JSON.parse(decrypted) as T;
}

export function isEncryptedPayload(value: unknown): value is EncryptedPayload {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  return candidate.encrypted === true && candidate.algorithm === "aes" && typeof candidate.ciphertext === "string";
}
