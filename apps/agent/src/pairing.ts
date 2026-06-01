export type ParsedPairingPayload = {
  serverUrl: string;
  bindCode: string;
};

type PairingPayload = {
  type?: unknown;
  version?: unknown;
  serverUrl?: unknown;
  bindCode?: unknown;
};

export function parsePairingPayload(rawPayload: string): ParsedPairingPayload | null {
  try {
    const payload = JSON.parse(rawPayload) as PairingPayload;
    if (
      payload.type !== "codex-transit.pairing" ||
      payload.version !== 1 ||
      typeof payload.serverUrl !== "string" ||
      typeof payload.bindCode !== "string"
    ) {
      return null;
    }

    return {
      serverUrl: payload.serverUrl.replace(/\/+$/, ""),
      bindCode: payload.bindCode
    };
  } catch {
    return null;
  }
}
