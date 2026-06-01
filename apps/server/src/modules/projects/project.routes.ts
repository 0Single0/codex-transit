import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { authenticateDeviceToken, readDeviceTokenHeader } from "../devices/device-auth";
import { requireUser } from "../../plugins/auth";
import { toProjectSummary } from "./project.service";

const syncProjectsSchema = z.object({
  deviceId: z.string().uuid(),
  projects: z.array(
    z.object({
      agentKey: z.string().min(1),
      displayName: z.string().min(1),
      pathAlias: z.string().min(1),
      available: z.boolean()
    })
  )
});

export async function registerProjectRoutes(app: FastifyInstance) {
  app.get("/devices/:deviceId/projects", async (request) => {
    const user = await requireUser(request);
    const params = z.object({ deviceId: z.string().uuid() }).parse(request.params);
    return {
      deviceId: params.deviceId,
      projects: (await app.prisma.project.findMany({
        where: { userId: user.id, deviceId: params.deviceId },
        select: { id: true, displayName: true, pathAlias: true, available: true }
      })).map(toProjectSummary)
    };
  });

  app.post("/agent/projects/sync", async (request, reply) => {
    const input = syncProjectsSchema.parse(request.body);
    const token = readDeviceTokenHeader(request.headers["x-device-token"]);
    if (!token) return reply.code(401).send({ error: "missing_device_token" });
    const device = await authenticateDeviceToken(app.prisma, input.deviceId, token);
    if (!device) return reply.code(401).send({ error: "invalid_device_token" });

    for (const project of input.projects) {
      await app.prisma.project.upsert({
        where: { deviceId_agentKey: { deviceId: input.deviceId, agentKey: project.agentKey } },
        update: project,
        create: {
          ...project,
          userId: device.userId,
          deviceId: input.deviceId
        }
      });
    }
    return { ok: true };
  });
}
