import { loginRequestSchema } from "@codex-transit/shared";
import type { FastifyInstance } from "fastify";
import { readPossiblyEncryptedBody } from "../../lib/transportCrypto";
import { hashPassword, signUserToken, verifyPassword } from "./auth.service";

export async function registerAuthRoutes(app: FastifyInstance) {
  app.post("/auth/register", async (request, reply) => {
    const input = loginRequestSchema.parse(readPossiblyEncryptedBody(request.body));
    const existing = await app.prisma.user.findUnique({ where: { email: input.email } });
    if (existing) return reply.code(409).send({ error: "email_already_registered" });

    const user = await app.prisma.user.create({
      data: { email: input.email, passwordHash: await hashPassword(input.password) }
    });
    const token = await signUserToken(app, user);
    return { token, user: { id: user.id, email: user.email } };
  });

  app.post("/auth/login", async (request, reply) => {
    const input = loginRequestSchema.parse(readPossiblyEncryptedBody(request.body));
    const user = await app.prisma.user.findUnique({ where: { email: input.email } });
    if (!user) return reply.code(401).send({ error: "invalid_credentials" });
    const ok = await verifyPassword(user.passwordHash, input.password);
    if (!ok) return reply.code(401).send({ error: "invalid_credentials" });
    const token = await signUserToken(app, user);
    return { token, user: { id: user.id, email: user.email } };
  });
}
