import { createSessionRequestSchema } from "@codex-transit/shared";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireUser } from "../../plugins/auth";

export async function registerSessionRoutes(app: FastifyInstance) {
  app.get("/projects/:projectId/sessions", async (request) => {
    const user = await requireUser(request);
    const params = z.object({ projectId: z.string().uuid() }).parse(request.params);
    return app.prisma.session.findMany({
      where: { userId: user.id, projectId: params.projectId },
      orderBy: { updatedAt: "desc" }
    });
  });

  app.post("/sessions", async (request) => {
    const user = await requireUser(request);
    const input = createSessionRequestSchema.parse(request.body);
    return app.prisma.session.create({
      data: {
        userId: user.id,
        deviceId: input.deviceId,
        projectId: input.projectId,
        title: input.title,
        status: "idle"
      }
    });
  });

  app.get("/sessions/:sessionId/output", async (request) => {
    const user = await requireUser(request);
    const params = z.object({ sessionId: z.string().uuid() }).parse(request.params);
    return app.prisma.terminalOutputChunk.findMany({
      where: { session: { id: params.sessionId, userId: user.id } },
      orderBy: { seq: "asc" }
    });
  });
}
