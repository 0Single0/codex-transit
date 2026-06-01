export type PairingPayload = {
  type: "codex-transit.pairing";
  version: 1;
  serverUrl: string;
  bindCode: string;
};

export function buildPairingPayload(serverUrl: string, bindCode: string): string {
  const normalizedServerUrl = serverUrl.replace(/\/+$/, "");
  const payload: PairingPayload = {
    type: "codex-transit.pairing",
    version: 1,
    serverUrl: normalizedServerUrl,
    bindCode
  };

  return JSON.stringify(payload);
}
