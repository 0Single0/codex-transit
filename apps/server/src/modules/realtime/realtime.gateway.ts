import { realtimeEventSchema } from "@codex-transit/shared";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { authenticateDeviceToken } from "../devices/device-auth";
import { ConnectionRegistry } from "./connection-registry";

export const connectionRegistry = new ConnectionRegistry();

const querySchema = z.object({
  role: z.enum(["agent", "viewer"]),
  token: z.string().min(1),
  deviceId: z.string().uuid().optional(),
  sessionId: z.string().uuid().optional()
});

export async function registerRealtimeGateway(app: FastifyInstance) {
  app.get("/realtime", { websocket: true }, async (socket, request) => {
    const query = querySchema.parse(request.query);
    let userId: string;

    if (query.role === "agent") {
      if (!query.deviceId) throw new Error("deviceId_required");
      const device = await authenticateDeviceToken(app.prisma, query.deviceId, query.token);
      if (!device) {
        socket.close(1008, "invalid_device_token");
        return;
      }
      userId = device.userId;
      connectionRegistry.addAgent(query.deviceId, socket);
      await app.prisma.device.update({
        where: { id: query.deviceId },
        data: { online: true, lastSeenAt: new Date() }
      });
      socket.on("close", async () => {
        connectionRegistry.removeAgent(query.deviceId!);
        await app.prisma.device.update({
          where: { id: query.deviceId! },
          data: { online: false, lastSeenAt: new Date() }
        });
      });
    }

    if (query.role === "viewer") {
      const payload = app.jwt.verify<{ sub: string; email?: string }>(query.token);
      userId = payload.sub;
      if (query.sessionId) {
        connectionRegistry.addViewer(query.sessionId, socket);
        socket.on("close", () => connectionRegistry.removeViewer(query.sessionId!, socket));
      } else if (query.deviceId) {
        const device = await app.prisma.device.findFirst({ where: { id: query.deviceId, userId } });
        if (!device) {
          socket.close(1008, "device_not_found");
          return;
        }
        connectionRegistry.addDeviceViewer(query.deviceId, socket);
        socket.on("close", () => connectionRegistry.removeDeviceViewer(query.deviceId!, socket));
      } else {
        throw new Error("sessionId_or_deviceId_required");
      }
    }

    socket.on("message", async (raw: Buffer) => {
      const event = realtimeEventSchema.parse(JSON.parse(raw.toString()));
      if ("sessionId" in event) {
        connectionRegistry.broadcastToSession(event.sessionId, event);
      }
      if (
        event.type === "codex.history.result" ||
        event.type === "codex.history.detail.result" ||
        event.type === "device.models.updated"
      ) {
        connectionRegistry.broadcastToDeviceViewers(event.deviceId, event);
      }
    });

    socket.send(JSON.stringify({ type: "connected", userId: userId! }));
  });
}
