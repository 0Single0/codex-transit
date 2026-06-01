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
      if (!query.sessionId) throw new Error("sessionId_required");
      connectionRegistry.addViewer(query.sessionId, socket);
      socket.on("close", () => connectionRegistry.removeViewer(query.sessionId!, socket));
    }

    socket.on("message", async (raw: Buffer) => {
      const event = realtimeEventSchema.parse(JSON.parse(raw.toString()));
      if ("sessionId" in event) {
        connectionRegistry.broadcastToSession(event.sessionId, event);
      }
      if (event.type === "codex.output.chunk") {
        await app.prisma.terminalOutputChunk.upsert({
          where: { sessionId_seq: { sessionId: event.sessionId, seq: event.seq } },
          update: { text: event.text, stream: event.stream },
          create: { sessionId: event.sessionId, seq: event.seq, stream: event.stream, text: event.text }
        });
      }
      if (event.type === "file.changed") {
        await app.prisma.fileChangeEvent.create({
          data: {
            sessionId: event.sessionId,
            relativePath: event.relativePath,
            oldRelativePath: event.oldRelativePath ?? null,
            changeType: event.changeType
          }
        });
      }
    });

    socket.send(JSON.stringify({ type: "connected", userId: userId! }));
  });
}
