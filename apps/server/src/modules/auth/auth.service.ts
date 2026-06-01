import argon2 from "argon2";
import type { FastifyInstance } from "fastify";

export async function hashPassword(password: string) {
  return argon2.hash(password);
}

export async function verifyPassword(hash: string, password: string) {
  return argon2.verify(hash, password);
}

export async function signUserToken(app: FastifyInstance, user: { id: string; email: string }) {
  return app.jwt.sign({ sub: user.id, email: user.email }, { expiresIn: "30d" });
}
