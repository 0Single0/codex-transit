import fp from "fastify-plugin";

declare module "fastify" {
  interface FastifyRequest {
    authUser?: { id: string; email: string };
  }
}

export const authPlugin = fp(async (app) => {
  app.decorateRequest("authUser", undefined);
  app.addHook("preHandler", async (request) => {
    if (!request.headers.authorization) return;
    const payload = await request.jwtVerify<{ sub: string; email: string }>();
    request.authUser = { id: payload.sub, email: payload.email };
  });
});

export async function requireUser(request: { authUser?: { id: string; email: string } }) {
  if (!request.authUser) {
    const error = new Error("Unauthorized") as Error & { statusCode?: number };
    error.statusCode = 401;
    throw error;
  }
  return request.authUser;
}
