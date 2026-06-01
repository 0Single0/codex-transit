export type PairingPayload = {
  type: "codex-transit.pairing";
  version: 1;
  serverUrl: string;
  bindCode: string;
};

export type AgentLoginPayload = {
  serverUrl: string;
  pairingToken: string;
};

type UnknownAgentLoginPayload = {
  type?: unknown;
  version?: unknown;
  serverUrl?: unknown;
  pairingToken?: unknown;
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

export function parseAgentLoginPayload(rawPayload: string): AgentLoginPayload | null {
  try {
    const payload = JSON.parse(rawPayload) as UnknownAgentLoginPayload;
    if (
      payload.type !== "codex-transit.agent-login" ||
      payload.version !== 1 ||
      typeof payload.serverUrl !== "string" ||
      typeof payload.pairingToken !== "string"
    ) {
      return null;
    }

    return {
      serverUrl: payload.serverUrl.replace(/\/+$/, ""),
      pairingToken: payload.pairingToken
    };
  } catch {
    return null;
  }
}
