import { z } from "zod";

export const uuidSchema = z.string().uuid();

export const baseEventSchema = z.object({
  eventId: uuidSchema,
  timestamp: z.string().datetime(),
  userId: uuidSchema,
  deviceId: uuidSchema
});

export const sessionBaseSchema = baseEventSchema.extend({
  projectId: uuidSchema,
  sessionId: uuidSchema
});

export const agentOnlineSchema = baseEventSchema.extend({
  type: z.literal("agent.online"),
  agentVersion: z.string().min(1)
});

export const agentOfflineSchema = baseEventSchema.extend({
  type: z.literal("agent.offline"),
  reason: z.string().min(1).optional()
});

export const projectSummarySchema = z.object({
  projectId: uuidSchema,
  displayName: z.string().min(1),
  pathAlias: z.string().min(1),
  available: z.boolean()
});

export const projectsSyncSchema = baseEventSchema.extend({
  type: z.literal("projects.sync"),
  projects: z.array(projectSummarySchema)
});

export const sessionStartSchema = sessionBaseSchema.extend({
  type: z.literal("session.start")
});

export const sessionInputSchema = sessionBaseSchema.extend({
  type: z.literal("session.input"),
  text: z.string().min(1)
});

export const sessionStopSchema = sessionBaseSchema.extend({
  type: z.literal("session.stop")
});

export const sessionStatusSchema = sessionBaseSchema.extend({
  type: z.literal("session.status"),
  status: z.enum(["idle", "running", "stopped", "failed", "agent_disconnected", "unknown"]),
  message: z.string().optional()
});

export const codexOutputChunkSchema = sessionBaseSchema.extend({
  type: z.literal("codex.output.chunk"),
  seq: z.number().int().nonnegative(),
  stream: z.enum(["stdout", "stderr"]),
  text: z.string()
});

export const fileChangedSchema = sessionBaseSchema.extend({
  type: z.literal("file.changed"),
  relativePath: z.string().min(1),
  oldRelativePath: z.string().min(1).optional(),
  changeType: z.enum(["created", "modified", "deleted", "renamed"])
});

export const diffRequestSchema = sessionBaseSchema.extend({
  type: z.literal("diff.request"),
  requestId: uuidSchema,
  relativePath: z.string().min(1)
});

export const diffResultSchema = sessionBaseSchema.extend({
  type: z.literal("diff.result"),
  requestId: uuidSchema,
  relativePath: z.string().min(1),
  ok: z.boolean(),
  diff: z.string().optional(),
  error: z.string().optional()
});

export const errorEventSchema = baseEventSchema.extend({
  type: z.literal("error.event"),
  code: z.string().min(1),
  message: z.string().min(1)
});

export const realtimeEventSchema = z.discriminatedUnion("type", [
  agentOnlineSchema,
  agentOfflineSchema,
  projectsSyncSchema,
  sessionStartSchema,
  sessionInputSchema,
  sessionStopSchema,
  sessionStatusSchema,
  codexOutputChunkSchema,
  fileChangedSchema,
  diffRequestSchema,
  diffResultSchema,
  errorEventSchema
]);

export type RealtimeEvent = z.infer<typeof realtimeEventSchema>;
export type CodexOutputChunk = z.infer<typeof codexOutputChunkSchema>;
export type FileChangedEvent = z.infer<typeof fileChangedSchema>;
export type ProjectSummary = z.infer<typeof projectSummarySchema>;
