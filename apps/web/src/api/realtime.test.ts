import { describe, expect, it, vi } from "vitest";
import { connectDeviceStream } from "./realtime";

class FakeWebSocket extends EventTarget {
  static instances: FakeWebSocket[] = [];
  readonly url: string;
  close = vi.fn();

  constructor(url: string | URL) {
    super();
    this.url = String(url);
    FakeWebSocket.instances.push(this);
  }
}

describe("connectDeviceStream", () => {
  it("exposes a ready promise that resolves after the server confirms registration", async () => {
    const originalWebSocket = globalThis.WebSocket;
    vi.stubGlobal("WebSocket", FakeWebSocket);
    FakeWebSocket.instances = [];

    try {
      const stream = connectDeviceStream({
        token: "token",
        deviceId: "00000000-0000-4000-8000-000000000001",
        onEvent: vi.fn()
      });
      let ready = false;
      void stream.ready.then(() => {
        ready = true;
      });
      await Promise.resolve();
      expect(ready).toBe(false);

      const socket = FakeWebSocket.instances[0];
      if (!socket) throw new Error("websocket was not created");
      socket.dispatchEvent(new MessageEvent("message", {
        data: JSON.stringify({ type: "connected", userId: "00000000-0000-4000-8000-000000000002" })
      }));
      await stream.ready;

      expect(ready).toBe(true);
      stream.close();
    } finally {
      vi.stubGlobal("WebSocket", originalWebSocket);
    }
  });
});
