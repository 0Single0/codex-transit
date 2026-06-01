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
  sessionId: uuidSchema,
  codexSessionId: z.string().min(1).optional()
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

export const codexHistoryItemSchema = z.object({
  codexSessionId: z.string().min(1),
  title: z.string().min(1),
  updatedAt: z.string().datetime(),
  preview: z.string().optional()
});

export const codexHistoryMessageSchema = z.object({
  id: z.string().min(1),
  role: z.enum(["user", "assistant"]),
  text: z.string().min(1),
  createdAt: z.string().datetime().optional()
});

export const codexHistoryRequestSchema = baseEventSchema.extend({
  type: z.literal("codex.history.request"),
  requestId: uuidSchema,
  projectId: uuidSchema.optional(),
  limit: z.number().int().positive().max(100).default(30)
});

export const codexHistoryDetailRequestSchema = baseEventSchema.extend({
  type: z.literal("codex.history.detail.request"),
  requestId: uuidSchema,
  codexSessionId: z.string().min(1)
});

export const codexHistoryResultSchema = baseEventSchema.extend({
  type: z.literal("codex.history.result"),
  requestId: uuidSchema,
  ok: z.boolean(),
  sessions: z.array(codexHistoryItemSchema),
  error: z.string().optional()
});

export const codexHistoryDetailResultSchema = baseEventSchema.extend({
  type: z.literal("codex.history.detail.result"),
  requestId: uuidSchema,
  codexSessionId: z.string().min(1),
  ok: z.boolean(),
  messages: z.array(codexHistoryMessageSchema),
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
  codexHistoryRequestSchema,
  codexHistoryDetailRequestSchema,
  codexHistoryResultSchema,
  codexHistoryDetailResultSchema,
  errorEventSchema
]);

export type RealtimeEvent = z.infer<typeof realtimeEventSchema>;
export type CodexOutputChunk = z.infer<typeof codexOutputChunkSchema>;
export type FileChangedEvent = z.infer<typeof fileChangedSchema>;
export type ProjectSummary = z.infer<typeof projectSummarySchema>;
export type CodexHistoryItem = z.infer<typeof codexHistoryItemSchema>;
export type CodexHistoryMessage = z.infer<typeof codexHistoryMessageSchema>;
