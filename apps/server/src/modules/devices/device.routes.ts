import crypto from "node:crypto";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireUser } from "../../plugins/auth";
import { connectionRegistry } from "../realtime/realtime.gateway";
import {
  bindCodeExpiry,
  buildAgentLoginPayload,
  createBindCode,
  createDeviceToken,
  createPairingToken,
  hashSecret,
  pairingExpiry
} from "./device.service";

const PUBLIC_SERVER_URL = process.env.PUBLIC_SERVER_URL ?? `http://localhost:${process.env.PORT ?? "4000"}`;

export async function registerDeviceRoutes(app: FastifyInstance) {
  app.get("/devices", async (request) => {
    const user = await requireUser(request);
    return app.prisma.device.findMany({
      where: { userId: user.id },
      select: { id: true, name: true, platform: true, online: true, lastSeenAt: true },
      orderBy: { updatedAt: "desc" }
    });
  });

  app.post("/devices/:deviceId/models/refresh", async (request, reply) => {
    const user = await requireUser(request);
    const params = z.object({ deviceId: z.string().uuid() }).parse(request.params);
    const device = await app.prisma.device.findFirst({
      where: { id: params.deviceId, userId: user.id }
    });
    if (!device) return reply.code(404).send({ error: "device_not_found" });

    const delivered = connectionRegistry.sendToAgent(device.id, {
      type: "device.models.request",
      eventId: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      userId: user.id,
      deviceId: device.id
    });
    if (!delivered) return reply.code(409).send({ error: "agent_offline" });

    return { ok: true };
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

  app.post("/agent/login-pairings", async (request) => {
    const body = z
      .object({
        name: z.string().min(1),
        platform: z.enum(["windows", "macos", "unknown"])
      })
      .parse(request.body);
    const pairingToken = createPairingToken();
    const expiresAt = pairingExpiry();
    await app.prisma.agentLoginPairing.create({
      data: {
        tokenHash: hashSecret(pairingToken),
        name: body.name,
        platform: body.platform,
        expiresAt
      }
    });

    return {
      pairingToken,
      expiresAt: expiresAt.toISOString(),
      payload: buildAgentLoginPayload(PUBLIC_SERVER_URL, pairingToken)
    };
  });

  app.post("/devices/agent-login/claim", async (request, reply) => {
    const user = await requireUser(request);
    const body = z.object({ pairingToken: z.string().min(16) }).parse(request.body);
    const tokenHash = hashSecret(body.pairingToken);
    const pairing = await app.prisma.agentLoginPairing.findUnique({ where: { tokenHash } });
    if (!pairing || pairing.claimedAt || pairing.expiresAt.getTime() < Date.now()) {
      return reply.code(401).send({ error: "invalid_pairing_token" });
    }

    const token = createDeviceToken();
    const device = await app.prisma.device.create({
      data: {
        userId: user.id,
        name: pairing.name,
        platform: pairing.platform,
        tokenHash: hashSecret(token),
        online: false
      }
    });
    await app.prisma.agentLoginPairing.update({
      where: { id: pairing.id },
      data: {
        userId: user.id,
        deviceId: device.id,
        deviceToken: token,
        claimedAt: new Date()
      }
    });

    return { deviceId: device.id };
  });

  app.post("/devices/agent-login/register", async (request) => {
    const user = await requireUser(request);
    const body = z
      .object({
        name: z.string().min(1),
        platform: z.enum(["windows", "macos", "unknown"])
      })
      .parse(request.body);
    const token = createDeviceToken();
    const device = await app.prisma.device.create({
      data: {
        userId: user.id,
        name: body.name,
        platform: body.platform,
        tokenHash: hashSecret(token),
        online: false
      }
    });

    return { deviceId: device.id, token };
  });

  app.get("/agent/login-pairings/:pairingToken", async (request, reply) => {
    const params = z.object({ pairingToken: z.string().min(16) }).parse(request.params);
    const pairing = await app.prisma.agentLoginPairing.findUnique({
      where: { tokenHash: hashSecret(params.pairingToken) }
    });
    if (!pairing || pairing.expiresAt.getTime() < Date.now()) {
      return reply.code(404).send({ status: "expired" });
    }
    if (!pairing.deviceId || !pairing.deviceToken) {
      return { status: "pending" };
    }

    return {
      status: "claimed",
      deviceId: pairing.deviceId,
      token: pairing.deviceToken
    };
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
