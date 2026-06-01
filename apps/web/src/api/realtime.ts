import { realtimeEventSchema, type RealtimeEvent } from "@codex-transit/shared";

const WS_BASE = import.meta.env.VITE_WS_BASE ?? "ws://localhost:4000";

type StreamConnection = {
  close: () => void;
  ready: Promise<void>;
};

export function connectSessionStream(options: {
  token: string;
  sessionId: string;
  onEvent: (event: RealtimeEvent) => void;
  onConnected?: () => void;
  onDisconnected?: () => void;
  onError?: () => void;
}): StreamConnection {
  const url = new URL("/realtime", WS_BASE);
  url.searchParams.set("role", "viewer");
  url.searchParams.set("token", options.token);
  url.searchParams.set("sessionId", options.sessionId);

  const socket = new WebSocket(url);
  const ready = bindRealtimeSocket(socket, options.onEvent, options.onConnected, options.onDisconnected, options.onError);

  return { close: () => socket.close(), ready };
}

export function connectDeviceStream(options: {
  token: string;
  deviceId: string;
  onEvent: (event: RealtimeEvent) => void;
  onConnected?: () => void;
  onDisconnected?: () => void;
  onError?: () => void;
}): StreamConnection {
  const url = new URL("/realtime", WS_BASE);
  url.searchParams.set("role", "viewer");
  url.searchParams.set("token", options.token);
  url.searchParams.set("deviceId", options.deviceId);

  const socket = new WebSocket(url);
  const ready = bindRealtimeSocket(socket, options.onEvent, options.onConnected, options.onDisconnected, options.onError);

  return { close: () => socket.close(), ready };
}

function bindRealtimeSocket(
  socket: WebSocket,
  onEvent: (event: RealtimeEvent) => void,
  onConnected?: () => void,
  onDisconnected?: () => void,
  onError?: () => void
) {
  let markReady: () => void;
  const ready = new Promise<void>((resolve) => {
    markReady = resolve;
  });

  socket.addEventListener("message", (message) => {
    let raw: unknown;
    try {
      raw = JSON.parse(message.data);
    } catch {
      return;
    }
    if (isConnectedMessage(raw)) {
      markReady();
      onConnected?.();
      return;
    }
    const parsed = realtimeEventSchema.safeParse(raw);
    if (parsed.success) onEvent(parsed.data);
  });
  socket.addEventListener("close", () => onDisconnected?.());
  socket.addEventListener("error", () => onError?.());

  return ready;
}

function isConnectedMessage(value: unknown): value is { type: "connected" } {
  return Boolean(value && typeof value === "object" && "type" in value && value.type === "connected");
}
