import cors from "@fastify/cors";
import jwt from "@fastify/jwt";
import websocket from "@fastify/websocket";
import Fastify from "fastify";
import { ZodError } from "zod";
import { registerAuthRoutes } from "./modules/auth/auth.routes";
import { registerDeviceRoutes } from "./modules/devices/device.routes";
import { registerProjectRoutes } from "./modules/projects/project.routes";
import { registerRealtimeGateway } from "./modules/realtime/realtime.gateway";
import { registerSessionRoutes } from "./modules/sessions/session.routes";
import { authPlugin } from "./plugins/auth";
import { prismaPlugin } from "./plugins/prisma";

export async function buildApp(options: { jwtSecret: string }) {
  const app = Fastify({ logger: true });

  await app.register(cors, { origin: true, credentials: true });
  await app.register(jwt, { secret: options.jwtSecret });
  await app.register(websocket);
  await app.register(prismaPlugin);
  await app.register(authPlugin);

  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof ZodError) {
      return reply.code(400).send({
        error: "validation_error",
        issues: error.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message
        }))
      });
    }

    return reply.send(error);
  });

  app.get("/health", async () => ({ ok: true }));
  await registerAuthRoutes(app);
  await registerDeviceRoutes(app);
  await registerProjectRoutes(app);
  await registerSessionRoutes(app);
  await registerRealtimeGateway(app);

  return app;
}
