import cors from "@fastify/cors";
import jwt from "@fastify/jwt";
import websocket from "@fastify/websocket";
import Fastify from "fastify";
import { prismaPlugin } from "./plugins/prisma";

export async function buildApp(options: { jwtSecret: string }) {
  const app = Fastify({ logger: true });

  await app.register(cors, { origin: true, credentials: true });
  await app.register(jwt, { secret: options.jwtSecret });
  await app.register(websocket);
  await app.register(prismaPlugin);

  app.get("/health", async () => ({ ok: true }));

  return app;
}
