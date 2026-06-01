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
}): StreamConnection {
  const url = new URL("/realtime", WS_BASE);
  url.searchParams.set("role", "viewer");
  url.searchParams.set("token", options.token);
  url.searchParams.set("sessionId", options.sessionId);

  const socket = new WebSocket(url);
  const ready = bindRealtimeSocket(socket, options.onEvent);

  return { close: () => socket.close(), ready };
}

export function connectDeviceStream(options: {
  token: string;
  deviceId: string;
  onEvent: (event: RealtimeEvent) => void;
}): StreamConnection {
  const url = new URL("/realtime", WS_BASE);
  url.searchParams.set("role", "viewer");
  url.searchParams.set("token", options.token);
  url.searchParams.set("deviceId", options.deviceId);

  const socket = new WebSocket(url);
  const ready = bindRealtimeSocket(socket, options.onEvent);

  return { close: () => socket.close(), ready };
}

function bindRealtimeSocket(socket: WebSocket, onEvent: (event: RealtimeEvent) => void) {
  let markReady: () => void;
  const ready = new Promise<void>((resolve) => {
    markReady = resolve;
  });

  socket.addEventListener("message", (message) => {
    const raw: unknown = JSON.parse(message.data);
    if (isConnectedMessage(raw)) {
      markReady();
      return;
    }
    const parsed = realtimeEventSchema.safeParse(raw);
    if (parsed.success) onEvent(parsed.data);
  });

  return ready;
}

function isConnectedMessage(value: unknown): value is { type: "connected" } {
  return Boolean(value && typeof value === "object" && "type" in value && value.type === "connected");
}
