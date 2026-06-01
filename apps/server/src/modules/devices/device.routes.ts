import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireUser } from "../../plugins/auth";
import { bindCodeExpiry, createBindCode, createDeviceToken, hashSecret } from "./device.service";

export async function registerDeviceRoutes(app: FastifyInstance) {
  app.get("/devices", async (request) => {
    const user = await requireUser(request);
    return app.prisma.device.findMany({
      where: { userId: user.id },
      select: { id: true, name: true, platform: true, online: true, lastSeenAt: true },
      orderBy: { updatedAt: "desc" }
    });
  });

  app.post("/devices/bind-codes", async (request) => {
    const user = await requireUser(request);
    const code = createBindCode();
    const expiresAt = bindCodeExpiry();
    await app.prisma.deviceBindCode.create({
      data: { userId: user.id, codeHash: hashSecret(code), expiresAt }
    });
    return { bindCode: code, expiresAt: expiresAt.toISOString() };
  });

  app.post("/agent/bind", async (request, reply) => {
    const body = z
      .object({
        bindCode: z.string().min(8),
        name: z.string().min(1),
        platform: z.enum(["windows", "macos", "unknown"])
      })
      .parse(request.body);

    const codeHash = hashSecret(body.bindCode);
    const bindCode = await app.prisma.deviceBindCode.findUnique({ where: { codeHash } });
    if (!bindCode || bindCode.usedAt || bindCode.expiresAt.getTime() < Date.now()) {
      return reply.code(401).send({ error: "invalid_bind_code" });
    }

    const token = createDeviceToken();
    const device = await app.prisma.device.create({
      data: {
        userId: bindCode.userId,
        name: body.name,
        platform: body.platform,
        tokenHash: hashSecret(token),
        online: false
      }
    });
    await app.prisma.deviceBindCode.update({
      where: { id: bindCode.id },
      data: { usedAt: new Date() }
    });

    return { deviceId: device.id, token };
  });
}
