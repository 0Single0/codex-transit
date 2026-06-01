import { realtimeEventSchema, type RealtimeEvent } from "@codex-transit/shared";

const WS_BASE = import.meta.env.VITE_WS_BASE ?? "ws://localhost:4000";

export function connectSessionStream(options: {
  token: string;
  sessionId: string;
  onEvent: (event: RealtimeEvent) => void;
}) {
  const url = new URL("/realtime", WS_BASE);
  url.searchParams.set("role", "viewer");
  url.searchParams.set("token", options.token);
  url.searchParams.set("sessionId", options.sessionId);

  const socket = new WebSocket(url);
  socket.addEventListener("message", (message) => {
    const raw: unknown = JSON.parse(message.data);
    const parsed = realtimeEventSchema.safeParse(raw);
    if (parsed.success) options.onEvent(parsed.data);
  });

  return () => socket.close();
}

export function connectDeviceStream(options: {
  token: string;
  deviceId: string;
  onEvent: (event: RealtimeEvent) => void;
}) {
  const url = new URL("/realtime", WS_BASE);
  url.searchParams.set("role", "viewer");
  url.searchParams.set("token", options.token);
  url.searchParams.set("deviceId", options.deviceId);

  const socket = new WebSocket(url);
  socket.addEventListener("message", (message) => {
    const raw: unknown = JSON.parse(message.data);
    const parsed = realtimeEventSchema.safeParse(raw);
    if (parsed.success) options.onEvent(parsed.data);
  });

  return () => socket.close();
}
