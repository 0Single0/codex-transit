import { createRuntimeSessionRequestSchema } from "@codex-transit/shared";
import crypto from "node:crypto";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireUser } from "../../plugins/auth";
import { connectionRegistry } from "../realtime/realtime.gateway";
import { runtimeSessionRegistry } from "./runtime-session-registry";
import { buildCodexHistoryDetailRequestEvent, buildCodexHistoryRequestEvent, buildSessionRealtimeBase, buildStartAndInputEvents, toSessionSummary } from "./session.service";

export async function registerSessionRoutes(app: FastifyInstance) {
  app.get("/projects/:projectId/sessions", async () => {
    return [];
  });

  app.post("/sessions", async (_request, reply) => {
    return reply.code(410).send({ error: "legacy_session_creation_disabled" });
  });

  app.post("/devices/:deviceId/projects/:projectId/runtime-sessions", async (request, reply) => {
    const user = await requireUser(request);
    const params = z.object({
      deviceId: z.string().uuid(),
      projectId: z.string().uuid()
    }).parse(request.params);
    const input = createRuntimeSessionRequestSchema.parse(request.body);
    const project = await app.prisma.project.findFirst({
      where: {
        id: params.projectId,
        deviceId: params.deviceId,
        userId: user.id
      },
      select: {
        agentKey: true
      }
    });
    if (!project) return reply.code(404).send({ error: "project_not_found" });

    if (input.mode === "history" && input.codexSessionId) {
      const existing = runtimeSessionRegistry.findHistorySession({
        userId: user.id,
        deviceId: params.deviceId,
        projectId: params.projectId,
        codexSessionId: input.codexSessionId
      });
      if (existing) {
        runtimeSessionRegistry.touch(existing.sessionId);
        return { sessionId: existing.sessionId, reused: true };
      }
    }

    const created = runtimeSessionRegistry.create({
      userId: user.id,
      deviceId: params.deviceId,
      projectId: params.projectId,
      agentProjectKey: project.agentKey,
      ...(input.codexSessionId ? { codexSessionId: input.codexSessionId } : {})
    });
    return { sessionId: created.sessionId, reused: false };
  });

  app.post("/devices/:deviceId/codex-history", async (request, reply) => {
    const user = await requireUser(request);
    const params = z.object({ deviceId: z.string().uuid() }).parse(request.params);
    const body = z.object({
      projectId: z.string().uuid().optional(),
      limit: z.number().int().positive().max(100).optional()
    }).parse(request.body ?? {});
    const device = await app.prisma.device.findFirst({
      where: { id: params.deviceId, userId: user.id }
    });
    if (!device) return reply.code(404).send({ error: "device_not_found" });

    let agentProjectId: string | undefined;
    if (body.projectId) {
      const project = await app.prisma.project.findFirst({
        where: { id: body.projectId, deviceId: device.id, userId: user.id },
        select: { agentKey: true }
      });
      if (!project) return reply.code(404).send({ error: "project_not_found" });
      agentProjectId = project.agentKey;
    }

    const event = buildCodexHistoryRequestEvent({
      userId: user.id,
      deviceId: device.id,
      ...(agentProjectId ? { projectId: agentProjectId } : {}),
      ...(body.limit ? { limit: body.limit } : {})
    });
    const delivered = connectionRegistry.sendToAgent(device.id, event);
    if (!delivered) return reply.code(409).send({ error: "agent_offline" });
    return { ok: true, requestId: event.requestId };
  });

  app.post("/devices/:deviceId/codex-history/:codexSessionId", async (request, reply) => {
    const user = await requireUser(request);
    const params = z.object({
      deviceId: z.string().uuid(),
      codexSessionId: z.string().min(1)
    }).parse(request.params);
    const device = await app.prisma.device.findFirst({
      where: { id: params.deviceId, userId: user.id }
    });
    if (!device) return reply.code(404).send({ error: "device_not_found" });

    const event = buildCodexHistoryDetailRequestEvent({
      userId: user.id,
      deviceId: device.id,
      codexSessionId: params.codexSessionId
    });
    const delivered = connectionRegistry.sendToAgent(device.id, event);
    if (!delivered) return reply.code(409).send({ error: "agent_offline" });
    return { ok: true, requestId: event.requestId };
  });

  app.get("/sessions/:sessionId/messages", async (request) => {
    const user = await requireUser(request);
    const params = z.object({ sessionId: z.string().uuid() }).parse(request.params);
    const exists = runtimeSessionRegistry.find(params.sessionId);
    if (!exists || exists.userId !== user.id) return [];
    runtimeSessionRegistry.touch(params.sessionId);
    return [];
  });

  app.post("/sessions/:sessionId/start", async (request, reply) => {
    const user = await requireUser(request);
    const params = z.object({ sessionId: z.string().uuid() }).parse(request.params);
    const session = runtimeSessionRegistry.find(params.sessionId);
    if (!session || session.userId !== user.id) return reply.code(404).send({ error: "session_not_found" });

    runtimeSessionRegistry.touch(session.sessionId);
    const event = {
      type: "session.start",
      eventId: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      ...buildSessionRealtimeBase(session)
    };

    const delivered = connectionRegistry.sendToAgent(session.deviceId, event);
    if (!delivered) return reply.code(409).send({ error: "agent_offline" });
    runtimeSessionRegistry.updateStatus(session.sessionId, "running");
    return { ok: true };
  });

  app.post("/sessions/:sessionId/input", async (request, reply) => {
    const user = await requireUser(request);
    const params = z.object({ sessionId: z.string().uuid() }).parse(request.params);
    const body = z.object({
      text: z.string().min(1),
      codexSessionId: z.string().min(1).optional(),
      model: z.string().min(1).optional(),
      planMode: z.boolean().optional(),
      approvalPolicy: z.enum(["default", "auto", "full"]).optional(),
      attachments: z.array(z.object({
        name: z.string().min(1),
        path: z.string().min(1),
        mimeType: z.string().min(1).optional(),
        kind: z.enum(["image", "file"])
      })).optional()
    }).parse(request.body);
    const session = runtimeSessionRegistry.find(params.sessionId);
    if (!session || session.userId !== user.id) return reply.code(404).send({ error: "session_not_found" });

    runtimeSessionRegistry.touch(session.sessionId);
    if (body.codexSessionId) {
      runtimeSessionRegistry.bindCodexSession(session.sessionId, body.codexSessionId);
    }

    for (const event of buildStartAndInputEvents(
      runtimeSessionRegistry.find(params.sessionId)!,
      body.text,
      undefined,
      body.codexSessionId,
      body.model,
      body.planMode,
      body.approvalPolicy,
      body.attachments?.map((attachment) => ({
        name: attachment.name,
        path: attachment.path,
        ...(attachment.mimeType ? { mimeType: attachment.mimeType } : {}),
        kind: attachment.kind
      }))
    )) {
      const delivered = connectionRegistry.sendToAgent(session.deviceId, event);
      if (!delivered) return reply.code(409).send({ error: "agent_offline" });
    }
    runtimeSessionRegistry.updateStatus(session.sessionId, "running");
    return { ok: true };
  });

  app.post("/sessions/:sessionId/stop", async (request, reply) => {
    const user = await requireUser(request);
    const params = z.object({ sessionId: z.string().uuid() }).parse(request.params);
    const session = runtimeSessionRegistry.find(params.sessionId);
    if (!session || session.userId !== user.id) return reply.code(404).send({ error: "session_not_found" });

    runtimeSessionRegistry.touch(session.sessionId);
    const event = {
      type: "session.stop",
      eventId: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      ...buildSessionRealtimeBase(session)
    };

    const delivered = connectionRegistry.sendToAgent(session.deviceId, event);
    if (!delivered) return reply.code(409).send({ error: "agent_offline" });
    runtimeSessionRegistry.updateStatus(session.sessionId, "stopped");
    return { ok: true };
  });

  app.post("/sessions/:sessionId/diff", async (request, reply) => {
    const user = await requireUser(request);
    const params = z.object({ sessionId: z.string().uuid() }).parse(request.params);
    const body = z.object({ relativePath: z.string().min(1) }).parse(request.body);
    const session = runtimeSessionRegistry.find(params.sessionId);
    if (!session || session.userId !== user.id) return reply.code(404).send({ error: "session_not_found" });

    runtimeSessionRegistry.touch(session.sessionId);
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
