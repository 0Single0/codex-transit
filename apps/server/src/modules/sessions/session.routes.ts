import { createSessionRequestSchema } from "@codex-transit/shared";
import crypto from "node:crypto";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireUser } from "../../plugins/auth";
import { connectionRegistry } from "../realtime/realtime.gateway";
import { buildSessionRealtimeBase, buildStartAndInputEvents, toSessionSummary } from "./session.service";

export async function registerSessionRoutes(app: FastifyInstance) {
  app.get("/projects/:projectId/sessions", async (request) => {
    const user = await requireUser(request);
    const params = z.object({ projectId: z.string().uuid() }).parse(request.params);
    return (await app.prisma.session.findMany({
      where: { userId: user.id, projectId: params.projectId },
      orderBy: { updatedAt: "desc" }
    })).map(toSessionSummary);
  });

  app.post("/sessions", async (request) => {
    const user = await requireUser(request);
    const input = createSessionRequestSchema.parse(request.body);
    return toSessionSummary(await app.prisma.session.create({
      data: {
        userId: user.id,
        deviceId: input.deviceId,
        projectId: input.projectId,
        title: input.title,
        status: "idle"
      }
    }));
  });

  app.get("/sessions/:sessionId/output", async (request) => {
    const user = await requireUser(request);
    const params = z.object({ sessionId: z.string().uuid() }).parse(request.params);
    return app.prisma.terminalOutputChunk.findMany({
      where: { session: { id: params.sessionId, userId: user.id } },
      orderBy: { seq: "asc" }
    });
  });

  app.get("/sessions/:sessionId/file-changes", async (request) => {
    const user = await requireUser(request);
    const params = z.object({ sessionId: z.string().uuid() }).parse(request.params);
    return app.prisma.fileChangeEvent.findMany({
      where: { session: { id: params.sessionId, userId: user.id } },
      orderBy: { createdAt: "asc" }
    });
  });

  app.get("/sessions/:sessionId/messages", async (request) => {
    const user = await requireUser(request);
    const params = z.object({ sessionId: z.string().uuid() }).parse(request.params);
    return app.prisma.sessionMessage.findMany({
      where: { session: { id: params.sessionId, userId: user.id } },
      orderBy: { createdAt: "asc" }
    });
  });

  app.post("/sessions/:sessionId/start", async (request, reply) => {
    const user = await requireUser(request);
    const params = z.object({ sessionId: z.string().uuid() }).parse(request.params);
    const session = await app.prisma.session.findFirst({
      where: { id: params.sessionId, userId: user.id },
      include: { project: { select: { agentKey: true } } }
    });
    if (!session) return reply.code(404).send({ error: "session_not_found" });

    const event = {
      type: "session.start",
      eventId: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      ...buildSessionRealtimeBase(session)
    };

    const delivered = connectionRegistry.sendToAgent(session.deviceId, event);
    if (!delivered) return reply.code(409).send({ error: "agent_offline" });
    await app.prisma.session.update({ where: { id: session.id }, data: { status: "running" } });
    return { ok: true };
  });

  app.post("/sessions/:sessionId/input", async (request, reply) => {
    const user = await requireUser(request);
    const params = z.object({ sessionId: z.string().uuid() }).parse(request.params);
    const body = z.object({ text: z.string().min(1) }).parse(request.body);
    const session = await app.prisma.session.findFirst({
      where: { id: params.sessionId, userId: user.id },
      include: { project: { select: { agentKey: true } } }
    });
    if (!session) return reply.code(404).send({ error: "session_not_found" });

    await app.prisma.sessionMessage.create({
      data: { sessionId: session.id, role: "user", text: body.text }
    });

    for (const event of buildStartAndInputEvents(session, body.text)) {
      const delivered = connectionRegistry.sendToAgent(session.deviceId, event);
      if (!delivered) return reply.code(409).send({ error: "agent_offline" });
    }
    await app.prisma.session.update({ where: { id: session.id }, data: { status: "running" } });
    return { ok: true };
  });

  app.post("/sessions/:sessionId/stop", async (request, reply) => {
    const user = await requireUser(request);
    const params = z.object({ sessionId: z.string().uuid() }).parse(request.params);
    const session = await app.prisma.session.findFirst({
      where: { id: params.sessionId, userId: user.id },
      include: { project: { select: { agentKey: true } } }
    });
    if (!session) return reply.code(404).send({ error: "session_not_found" });

    const event = {
      type: "session.stop",
      eventId: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      ...buildSessionRealtimeBase(session)
    };

    const delivered = connectionRegistry.sendToAgent(session.deviceId, event);
    if (!delivered) return reply.code(409).send({ error: "agent_offline" });
    await app.prisma.session.update({ where: { id: session.id }, data: { status: "stopped" } });
    return { ok: true };
  });

  app.post("/sessions/:sessionId/diff", async (request, reply) => {
    const user = await requireUser(request);
    const params = z.object({ sessionId: z.string().uuid() }).parse(request.params);
    const body = z.object({ relativePath: z.string().min(1) }).parse(request.body);
    const session = await app.prisma.session.findFirst({
      where: { id: params.sessionId, userId: user.id },
      include: { project: { select: { agentKey: true } } }
    });
    if (!session) return reply.code(404).send({ error: "session_not_found" });

    const requestId = crypto.randomUUID();
    const event = {
      type: "diff.request",
      eventId: crypto.randomUUID(),
      requestId,
      timestamp: new Date().toISOString(),
      ...buildSessionRealtimeBase(session),
      relativePath: body.relativePath
    };

    const delivered = connectionRegistry.sendToAgent(session.deviceId, event);
    if (!delivered) return reply.code(409).send({ error: "agent_offline" });
    return { ok: true, requestId };
  });
}
