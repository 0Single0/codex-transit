import cors from "@fastify/cors";
import jwt from "@fastify/jwt";
import websocket from "@fastify/websocket";
import Fastify from "fastify";
import { registerAuthRoutes } from "./modules/auth/auth.routes";
import { registerDeviceRoutes } from "./modules/devices/device.routes";
import { registerProjectRoutes } from "./modules/projects/project.routes";
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

  app.get("/health", async () => ({ ok: true }));
  await registerAuthRoutes(app);
  await registerDeviceRoutes(app);
  await registerProjectRoutes(app);
  await registerSessionRoutes(app);

  return app;
}
