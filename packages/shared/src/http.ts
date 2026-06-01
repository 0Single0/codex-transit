import { z } from "zod";
import { projectSummarySchema, uuidSchema } from "./events";

export const loginRequestSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8)
});

export const loginResponseSchema = z.object({
  token: z.string().min(1),
  user: z.object({
    id: uuidSchema,
    email: z.string().email()
  })
});

export const deviceSummarySchema = z.object({
  id: uuidSchema,
  name: z.string().min(1),
  platform: z.enum(["windows", "macos", "unknown"]),
  online: z.boolean(),
  lastSeenAt: z.string().datetime().optional()
});

export const createBindCodeResponseSchema = z.object({
  bindCode: z.string().min(8),
  expiresAt: z.string().datetime()
});

export const createSessionRequestSchema = z.object({
  deviceId: uuidSchema,
  projectId: uuidSchema,
  title: z.string().min(1).max(120)
});

export const sessionSummarySchema = z.object({
  id: uuidSchema,
  deviceId: uuidSchema,
  projectId: uuidSchema,
  title: z.string(),
  status: z.enum(["idle", "running", "stopped", "failed", "agent_disconnected", "unknown"]),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime()
});

export const deviceProjectsResponseSchema = z.object({
  deviceId: uuidSchema,
  projects: z.array(projectSummarySchema)
});

export type LoginRequest = z.infer<typeof loginRequestSchema>;
export type LoginResponse = z.infer<typeof loginResponseSchema>;
export type DeviceSummary = z.infer<typeof deviceSummarySchema>;
export type CreateSessionRequest = z.infer<typeof createSessionRequestSchema>;
export type SessionSummary = z.infer<typeof sessionSummarySchema>;
