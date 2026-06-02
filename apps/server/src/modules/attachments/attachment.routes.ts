import crypto from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { FastifyInstance } from "fastify";
import { requireUser } from "../../plugins/auth";

const UPLOAD_ROOT = path.join(os.tmpdir(), "codex-transit-uploads");
const PUBLIC_SERVER_URL = process.env.PUBLIC_SERVER_URL ?? `http://localhost:${process.env.PORT ?? "4000"}`;

export async function registerAttachmentRoutes(app: FastifyInstance) {
  app.post("/attachments", async (request, reply) => {
    const user = await requireUser(request);
    const file = await request.file();
    if (!file) return reply.code(400).send({ error: "file_required" });

    const userDir = path.join(UPLOAD_ROOT, user.id);
    await fs.mkdir(userDir, { recursive: true });
    const extension = path.extname(file.filename);
    const filename = `${crypto.randomUUID()}${extension}`;
    const fullPath = path.join(userDir, filename);
    await fs.writeFile(fullPath, await file.toBuffer());

    return {
      path: `${PUBLIC_SERVER_URL}/attachments/${user.id}/${filename}`
    };
  });

  app.get("/attachments/:userId/:filename", async (request, reply) => {
    const params = request.params as { userId: string; filename: string };
    const fullPath = path.join(UPLOAD_ROOT, params.userId, params.filename);
    try {
      const content = await fs.readFile(fullPath);
      return reply.type("application/octet-stream").send(content);
    } catch {
      return reply.code(404).send({ error: "attachment_not_found" });
    }
  });
}
