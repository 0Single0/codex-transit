# Codex Transit MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first working Codex Transit loop: phone/PWA sends input, the relay server routes it to a local Tauri agent, the agent runs a local process in an approved project, and raw output plus file change events stream back to the phone.

**Architecture:** Use a TypeScript monorepo for server, web, and shared protocol types, with a Tauri v2 desktop agent whose background logic is Rust. The server owns auth, device binding, project/session metadata, event persistence, and WebSocket routing; the agent owns local path authorization, process management, file watching, diff generation, and the outbound server connection.

**Tech Stack:** pnpm workspaces, TypeScript, Fastify, ws, Zod, Prisma, PostgreSQL, React, Vite, Tauri v2, Rust, tokio, serde, notify, tokio-tungstenite.

---

## Source Documents

- Spec: `docs/superpowers/specs/2026-06-01-codex-transit-design.md`

## File Structure

Create this structure over the course of the plan:

```text
.gitignore
.nvmrc
docker-compose.yml
package.json
pnpm-workspace.yaml
tsconfig.base.json
docs/superpowers/specs/2026-06-01-codex-transit-design.md
docs/superpowers/plans/2026-06-01-codex-transit-mvp.md
packages/shared/
  package.json
  tsconfig.json
  vitest.config.ts
  src/events.ts
  src/http.ts
  src/index.ts
  src/events.test.ts
apps/server/
  package.json
  tsconfig.json
  vitest.config.ts
  prisma/schema.prisma
  src/app.ts
  src/env.ts
  src/index.ts
  src/lib/ids.ts
  src/modules/auth/auth.service.ts
  src/modules/auth/auth.routes.ts
  src/modules/devices/device.service.ts
  src/modules/devices/device.routes.ts
  src/modules/realtime/connection-registry.ts
  src/modules/realtime/realtime.gateway.ts
  src/modules/sessions/session.service.ts
  src/modules/sessions/session.routes.ts
  src/modules/projects/project.service.ts
  src/modules/projects/project.routes.ts
  src/plugins/prisma.ts
  src/plugins/auth.ts
  test/auth.service.test.ts
  test/realtime.gateway.test.ts
apps/web/
  package.json
  tsconfig.json
  vite.config.ts
  index.html
  src/main.tsx
  src/App.tsx
  src/api/client.ts
  src/api/realtime.ts
  src/components/LoginView.tsx
  src/components/DeviceListView.tsx
  src/components/SessionConsole.tsx
  src/styles.css
apps/agent/
  package.json
  src/App.tsx
  src/main.tsx
  src-tauri/Cargo.toml
  src-tauri/tauri.conf.json
  src-tauri/src/main.rs
  src-tauri/src/protocol.rs
  src-tauri/src/project_registry.rs
  src-tauri/src/path_guard.rs
  src-tauri/src/codex_adapter.rs
  src-tauri/src/file_watcher.rs
  src-tauri/src/server_client.rs
  src-tauri/src/commands.rs
  src-tauri/tests/path_guard_test.rs
```

Keep files focused. Do not put all server routes in one large file. Do not put agent process, watcher, and path validation in one Rust module.

## Phase 1: Repository Foundation

### Task 1: Add Repository Hygiene And Workspace Config

**Files:**
- Create: `.gitignore`
- Create: `.nvmrc`
- Create: `package.json`
- Create: `pnpm-workspace.yaml`
- Create: `tsconfig.base.json`
- Create: `docker-compose.yml`

- [ ] **Step 1: Create `.gitignore`**

```gitignore
# dependencies
node_modules/
.pnpm-store/

# build output
dist/
build/
.turbo/
coverage/

# env and local state
.env
.env.*
!.env.example
*.local

# logs
*.log
npm-debug.log*
pnpm-debug.log*
yarn-debug.log*
yarn-error.log*

# OS/editor
.DS_Store
Thumbs.db
.idea/
.vscode/

# database and generated clients
*.db
*.sqlite
apps/server/prisma/migrations/dev/

# Tauri/Rust
target/
apps/agent/src-tauri/target/
apps/agent/src-tauri/gen/
apps/agent/src-tauri/.taurignore
```

- [ ] **Step 2: Create `.nvmrc`**

```text
22
```

- [ ] **Step 3: Create root `package.json`**

```json
{
  "name": "codex-transit",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "packageManager": "pnpm@9.15.4",
  "scripts": {
    "build": "pnpm -r build",
    "dev": "pnpm --parallel --filter @codex-transit/server --filter @codex-transit/web dev",
    "lint": "pnpm -r lint",
    "test": "pnpm -r test",
    "typecheck": "pnpm -r typecheck",
    "db:up": "docker compose up -d postgres",
    "db:down": "docker compose down"
  },
  "devDependencies": {
    "@types/node": "^22.10.2",
    "typescript": "^5.7.2"
  }
}
```

- [ ] **Step 4: Create `pnpm-workspace.yaml`**

```yaml
packages:
  - "apps/*"
  - "packages/*"
```

- [ ] **Step 5: Create `tsconfig.base.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "resolveJsonModule": true,
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true
  }
}
```

- [ ] **Step 6: Create `docker-compose.yml`**

```yaml
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: codex_transit
      POSTGRES_PASSWORD: codex_transit
      POSTGRES_DB: codex_transit
    ports:
      - "54321:5432"
    volumes:
      - codex_transit_pg:/var/lib/postgresql/data

volumes:
  codex_transit_pg:
```

- [ ] **Step 7: Install root dependencies**

Run: `pnpm install`

Expected: `pnpm-lock.yaml` is created and the command exits with code 0.

- [ ] **Step 8: Verify workspace scripts parse**

Run: `pnpm typecheck`

Expected: command exits with code 0 or reports no workspace packages yet. If pnpm reports no projects matched, continue; later tasks add packages.

- [ ] **Step 9: Commit**

```bash
git add .gitignore .nvmrc package.json pnpm-workspace.yaml tsconfig.base.json docker-compose.yml pnpm-lock.yaml docs
git commit -m "chore: initialize repository workspace"
```

### Task 2: Create Shared Protocol Package

**Files:**
- Create: `packages/shared/package.json`
- Create: `packages/shared/tsconfig.json`
- Create: `packages/shared/vitest.config.ts`
- Create: `packages/shared/src/events.ts`
- Create: `packages/shared/src/http.ts`
- Create: `packages/shared/src/index.ts`
- Create: `packages/shared/src/events.test.ts`

- [ ] **Step 1: Create package metadata**

```json
{
  "name": "@codex-transit/shared",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "lint": "tsc -p tsconfig.json --noEmit",
    "test": "vitest run",
    "typecheck": "tsc -p tsconfig.json --noEmit"
  },
  "dependencies": {
    "zod": "^3.24.1"
  },
  "devDependencies": {
    "vitest": "^2.1.8"
  }
}
```

- [ ] **Step 2: Create TypeScript config**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src",
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  },
  "include": ["src/**/*.ts"]
}
```

- [ ] **Step 3: Create Vitest config**

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"]
  }
});
```

- [ ] **Step 4: Write protocol event schemas**

```ts
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
```

- [ ] **Step 5: Write HTTP DTO schemas**

```ts
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
```

- [ ] **Step 6: Export package API**

```ts
export * from "./events";
export * from "./http";
```

- [ ] **Step 7: Add failing schema tests**

```ts
import { describe, expect, it } from "vitest";
import { codexOutputChunkSchema, fileChangedSchema, realtimeEventSchema } from "./events";

const base = {
  eventId: "00000000-0000-4000-8000-000000000001",
  timestamp: "2026-06-01T00:00:00.000Z",
  userId: "00000000-0000-4000-8000-000000000002",
  deviceId: "00000000-0000-4000-8000-000000000003",
  projectId: "00000000-0000-4000-8000-000000000004",
  sessionId: "00000000-0000-4000-8000-000000000005"
};

describe("realtime event schemas", () => {
  it("parses codex output chunks", () => {
    const parsed = codexOutputChunkSchema.parse({
      ...base,
      type: "codex.output.chunk",
      seq: 1,
      stream: "stdout",
      text: "hello"
    });

    expect(parsed.seq).toBe(1);
  });

  it("rejects absolute file paths from file change events", () => {
    const result = fileChangedSchema.safeParse({
      ...base,
      type: "file.changed",
      relativePath: "",
      changeType: "modified"
    });

    expect(result.success).toBe(false);
  });

  it("routes discriminated union events by type", () => {
    const parsed = realtimeEventSchema.parse({
      ...base,
      type: "session.input",
      text: "change the README"
    });

    expect(parsed.type).toBe("session.input");
  });
});
```

- [ ] **Step 8: Run tests to verify schemas**

Run: `pnpm --filter @codex-transit/shared test`

Expected: all tests pass.

- [ ] **Step 9: Build shared package**

Run: `pnpm --filter @codex-transit/shared build`

Expected: `packages/shared/dist/index.js` and `.d.ts` files are emitted.

- [ ] **Step 10: Commit**

```bash
git add packages/shared package.json pnpm-lock.yaml
git commit -m "feat: add shared realtime protocol schemas"
```

## Phase 2: Relay Server

### Task 3: Scaffold Fastify Server And Database Schema

**Files:**
- Create: `apps/server/package.json`
- Create: `apps/server/tsconfig.json`
- Create: `apps/server/vitest.config.ts`
- Create: `apps/server/prisma/schema.prisma`
- Create: `apps/server/src/env.ts`
- Create: `apps/server/src/plugins/prisma.ts`
- Create: `apps/server/src/app.ts`
- Create: `apps/server/src/index.ts`

- [ ] **Step 1: Create server package metadata**

```json
{
  "name": "@codex-transit/server",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "dev": "tsx watch src/index.ts",
    "lint": "tsc -p tsconfig.json --noEmit",
    "test": "vitest run",
    "typecheck": "tsc -p tsconfig.json --noEmit",
    "prisma:generate": "prisma generate",
    "prisma:migrate": "prisma migrate dev"
  },
  "dependencies": {
    "@codex-transit/shared": "workspace:*",
    "@fastify/cors": "^10.0.2",
    "@fastify/jwt": "^9.0.2",
    "@fastify/websocket": "^11.0.1",
    "@prisma/client": "^6.0.1",
    "argon2": "^0.41.1",
    "fastify": "^5.2.1",
    "nanoid": "^5.0.9",
    "zod": "^3.24.1"
  },
  "devDependencies": {
    "prisma": "^6.0.1",
    "tsx": "^4.19.2",
    "vitest": "^2.1.8"
  }
}
```

- [ ] **Step 2: Create TypeScript config**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src",
    "types": ["node"]
  },
  "include": ["src/**/*.ts", "test/**/*.ts"]
}
```

- [ ] **Step 3: Create Vitest config**

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["test/**/*.test.ts"]
  }
});
```

- [ ] **Step 4: Create Prisma schema**

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum DevicePlatform {
  windows
  macos
  unknown
}

enum SessionStatus {
  idle
  running
  stopped
  failed
  agent_disconnected
  unknown
}

enum OutputStream {
  stdout
  stderr
}

enum FileChangeType {
  created
  modified
  deleted
  renamed
}

model User {
  id           String   @id @default(uuid())
  email        String   @unique
  passwordHash String
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
  devices      Device[]
  sessions     Session[]
}

model Device {
  id         String         @id @default(uuid())
  userId     String
  name       String
  platform   DevicePlatform @default(unknown)
  tokenHash  String?
  online     Boolean        @default(false)
  lastSeenAt DateTime?
  createdAt  DateTime       @default(now())
  updatedAt  DateTime       @updatedAt
  user       User           @relation(fields: [userId], references: [id], onDelete: Cascade)
  projects   Project[]
  sessions   Session[]
}

model DeviceBindCode {
  id        String   @id @default(uuid())
  userId    String
  codeHash  String   @unique
  expiresAt DateTime
  usedAt    DateTime?
  createdAt DateTime @default(now())
}

model Project {
  id          String    @id @default(uuid())
  userId      String
  deviceId    String
  displayName String
  pathAlias   String
  agentKey    String
  available   Boolean   @default(true)
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt
  device      Device    @relation(fields: [deviceId], references: [id], onDelete: Cascade)
  sessions    Session[]

  @@unique([deviceId, agentKey])
}

model Session {
  id        String        @id @default(uuid())
  userId    String
  deviceId  String
  projectId String
  title     String
  status    SessionStatus @default(idle)
  createdAt DateTime      @default(now())
  updatedAt DateTime      @updatedAt
  user      User          @relation(fields: [userId], references: [id], onDelete: Cascade)
  device    Device        @relation(fields: [deviceId], references: [id], onDelete: Cascade)
  project   Project       @relation(fields: [projectId], references: [id], onDelete: Cascade)
  messages  SessionMessage[]
  outputs   TerminalOutputChunk[]
  changes   FileChangeEvent[]
}

model SessionMessage {
  id        String   @id @default(uuid())
  sessionId String
  role      String
  text      String
  createdAt DateTime @default(now())
  session   Session  @relation(fields: [sessionId], references: [id], onDelete: Cascade)
}

model TerminalOutputChunk {
  id        String       @id @default(uuid())
  sessionId String
  seq       Int
  stream    OutputStream
  text      String
  createdAt DateTime     @default(now())
  session   Session      @relation(fields: [sessionId], references: [id], onDelete: Cascade)

  @@unique([sessionId, seq])
}

model FileChangeEvent {
  id              String         @id @default(uuid())
  sessionId       String
  relativePath    String
  oldRelativePath String?
  changeType      FileChangeType
  createdAt       DateTime       @default(now())
  session         Session        @relation(fields: [sessionId], references: [id], onDelete: Cascade)
}

model AuditLog {
  id        String   @id @default(uuid())
  userId    String
  deviceId  String?
  action    String
  metadata  Json
  createdAt DateTime @default(now())
}
```

- [ ] **Step 5: Create env parser**

```ts
import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  JWT_SECRET: z.string().min(32),
  PORT: z.coerce.number().int().positive().default(4000)
});

export type Env = z.infer<typeof envSchema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  return envSchema.parse(source);
}
```

- [ ] **Step 6: Create Prisma plugin**

```ts
import fp from "fastify-plugin";
import { PrismaClient } from "@prisma/client";

declare module "fastify" {
  interface FastifyInstance {
    prisma: PrismaClient;
  }
}

export const prismaPlugin = fp(async (app) => {
  const prisma = new PrismaClient();
  app.decorate("prisma", prisma);
  app.addHook("onClose", async () => {
    await prisma.$disconnect();
  });
});
```

- [ ] **Step 7: Create Fastify app**

```ts
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
```

- [ ] **Step 8: Create server entrypoint**

```ts
import { buildApp } from "./app";
import { loadEnv } from "./env";

const env = loadEnv();
const app = await buildApp({ jwtSecret: env.JWT_SECRET });

await app.listen({ port: env.PORT, host: "0.0.0.0" });
```

- [ ] **Step 9: Generate Prisma client**

Run: `$env:DATABASE_URL='postgresql://codex_transit:codex_transit@localhost:54321/codex_transit'; pnpm --filter @codex-transit/server prisma:generate`

Expected: Prisma client generation succeeds.

- [ ] **Step 10: Typecheck server**

Run: `pnpm --filter @codex-transit/server typecheck`

Expected: command exits with code 0.

- [ ] **Step 11: Commit**

```bash
git add apps/server package.json pnpm-lock.yaml
git commit -m "feat: scaffold relay server database"
```

### Task 4: Implement Auth, Devices, Projects, And Sessions APIs

**Files:**
- Create: `apps/server/src/plugins/auth.ts`
- Create: `apps/server/src/lib/ids.ts`
- Create: `apps/server/src/modules/auth/auth.service.ts`
- Create: `apps/server/src/modules/auth/auth.routes.ts`
- Create: `apps/server/src/modules/devices/device.service.ts`
- Create: `apps/server/src/modules/devices/device.routes.ts`
- Create: `apps/server/src/modules/projects/project.service.ts`
- Create: `apps/server/src/modules/projects/project.routes.ts`
- Create: `apps/server/src/modules/sessions/session.service.ts`
- Create: `apps/server/src/modules/sessions/session.routes.ts`
- Modify: `apps/server/src/app.ts`
- Create: `apps/server/test/auth.service.test.ts`

- [ ] **Step 1: Write auth service tests**

```ts
import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "../src/modules/auth/auth.service";

describe("auth service", () => {
  it("verifies a valid password hash", async () => {
    const hash = await hashPassword("correct horse battery staple");
    await expect(verifyPassword(hash, "correct horse battery staple")).resolves.toBe(true);
  });

  it("rejects an invalid password", async () => {
    const hash = await hashPassword("correct horse battery staple");
    await expect(verifyPassword(hash, "wrong password")).resolves.toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @codex-transit/server test -- auth.service`

Expected: FAIL because `auth.service.ts` does not exist.

- [ ] **Step 3: Implement auth service helpers**

```ts
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
```

- [ ] **Step 4: Create auth plugin**

```ts
import fp from "fastify-plugin";

declare module "fastify" {
  interface FastifyRequest {
    authUser?: { id: string; email: string };
  }
}

export const authPlugin = fp(async (app) => {
  app.decorateRequest("authUser", null);
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
```

- [ ] **Step 5: Create id helper**

```ts
import { randomUUID } from "node:crypto";

export function createId() {
  return randomUUID();
}
```

- [ ] **Step 6: Implement auth routes**

```ts
import type { FastifyInstance } from "fastify";
import { loginRequestSchema } from "@codex-transit/shared";
import { hashPassword, signUserToken, verifyPassword } from "./auth.service";

export async function registerAuthRoutes(app: FastifyInstance) {
  app.post("/auth/register", async (request, reply) => {
    const input = loginRequestSchema.parse(request.body);
    const existing = await app.prisma.user.findUnique({ where: { email: input.email } });
    if (existing) return reply.code(409).send({ error: "email_already_registered" });

    const user = await app.prisma.user.create({
      data: { email: input.email, passwordHash: await hashPassword(input.password) }
    });
    const token = await signUserToken(app, user);
    return { token, user: { id: user.id, email: user.email } };
  });

  app.post("/auth/login", async (request, reply) => {
    const input = loginRequestSchema.parse(request.body);
    const user = await app.prisma.user.findUnique({ where: { email: input.email } });
    if (!user) return reply.code(401).send({ error: "invalid_credentials" });
    const ok = await verifyPassword(user.passwordHash, input.password);
    if (!ok) return reply.code(401).send({ error: "invalid_credentials" });
    const token = await signUserToken(app, user);
    return { token, user: { id: user.id, email: user.email } };
  });
}
```

- [ ] **Step 7: Implement device service**

```ts
import { createHash, randomBytes } from "node:crypto";

export function createBindCode() {
  return randomBytes(6).toString("base64url");
}

export function hashSecret(secret: string) {
  return createHash("sha256").update(secret).digest("hex");
}

export function bindCodeExpiry(now = new Date()) {
  return new Date(now.getTime() + 5 * 60 * 1000);
}
```

- [ ] **Step 8: Implement device routes**

```ts
import type { FastifyInstance } from "fastify";
import { requireUser } from "../../plugins/auth";
import { bindCodeExpiry, createBindCode, hashSecret } from "./device.service";

export async function registerDeviceRoutes(app: FastifyInstance) {
  app.get("/devices", async (request) => {
    const user = await requireUser(request);
    return app.prisma.device.findMany({
      where: { userId: user.id },
      select: { id: true, name: true, platform: true, online: true, lastSeenAt: true },
      orderBy: { updatedAt: "desc" }
    });
  });

  app.post("/devices/bind-codes", async (request) => {
    const user = await requireUser(request);
    const code = createBindCode();
    const expiresAt = bindCodeExpiry();
    await app.prisma.deviceBindCode.create({
      data: { userId: user.id, codeHash: hashSecret(code), expiresAt }
    });
    return { bindCode: code, expiresAt: expiresAt.toISOString() };
  });
}
```

- [ ] **Step 9: Implement project routes**

```ts
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireUser } from "../../plugins/auth";

const syncProjectsSchema = z.object({
  deviceId: z.string().uuid(),
  projects: z.array(z.object({
    agentKey: z.string().min(1),
    displayName: z.string().min(1),
    pathAlias: z.string().min(1),
    available: z.boolean()
  }))
});

export async function registerProjectRoutes(app: FastifyInstance) {
  app.get("/devices/:deviceId/projects", async (request) => {
    const user = await requireUser(request);
    const params = z.object({ deviceId: z.string().uuid() }).parse(request.params);
    return {
      deviceId: params.deviceId,
      projects: await app.prisma.project.findMany({
        where: { userId: user.id, deviceId: params.deviceId },
        select: { id: true, displayName: true, pathAlias: true, available: true }
      })
    };
  });

  app.post("/agent/projects/sync", async (request) => {
    const input = syncProjectsSchema.parse(request.body);
    for (const project of input.projects) {
      await app.prisma.project.upsert({
        where: { deviceId_agentKey: { deviceId: input.deviceId, agentKey: project.agentKey } },
        update: project,
        create: {
          ...project,
          userId: request.authUser!.id,
          deviceId: input.deviceId
        }
      });
    }
    return { ok: true };
  });
}
```

- [ ] **Step 10: Implement session routes**

```ts
import type { FastifyInstance } from "fastify";
import { createSessionRequestSchema } from "@codex-transit/shared";
import { z } from "zod";
import { requireUser } from "../../plugins/auth";

export async function registerSessionRoutes(app: FastifyInstance) {
  app.get("/projects/:projectId/sessions", async (request) => {
    const user = await requireUser(request);
    const params = z.object({ projectId: z.string().uuid() }).parse(request.params);
    return app.prisma.session.findMany({
      where: { userId: user.id, projectId: params.projectId },
      orderBy: { updatedAt: "desc" }
    });
  });

  app.post("/sessions", async (request) => {
    const user = await requireUser(request);
    const input = createSessionRequestSchema.parse(request.body);
    return app.prisma.session.create({
      data: {
        userId: user.id,
        deviceId: input.deviceId,
        projectId: input.projectId,
        title: input.title,
        status: "idle"
      }
    });
  });

  app.get("/sessions/:sessionId/output", async (request) => {
    const user = await requireUser(request);
    const params = z.object({ sessionId: z.string().uuid() }).parse(request.params);
    return app.prisma.terminalOutputChunk.findMany({
      where: { session: { id: params.sessionId, userId: user.id } },
      orderBy: { seq: "asc" }
    });
  });
}
```

- [ ] **Step 11: Register routes in app**

```ts
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
```

- [ ] **Step 12: Run auth tests**

Run: `pnpm --filter @codex-transit/server test -- auth.service`

Expected: PASS.

- [ ] **Step 13: Typecheck server**

Run: `pnpm --filter @codex-transit/server typecheck`

Expected: PASS.

- [ ] **Step 14: Commit**

```bash
git add apps/server package.json pnpm-lock.yaml
git commit -m "feat: add relay server auth and REST APIs"
```

### Task 5: Implement Realtime Gateway And Event Persistence

**Files:**
- Create: `apps/server/src/modules/realtime/connection-registry.ts`
- Create: `apps/server/src/modules/realtime/realtime.gateway.ts`
- Modify: `apps/server/src/app.ts`
- Create: `apps/server/test/realtime.gateway.test.ts`

- [ ] **Step 1: Write connection registry tests**

```ts
import { describe, expect, it, vi } from "vitest";
import { ConnectionRegistry } from "../src/modules/realtime/connection-registry";

describe("ConnectionRegistry", () => {
  it("routes messages to a connected agent by device id", () => {
    const registry = new ConnectionRegistry();
    const send = vi.fn();
    registry.addAgent("device-1", { send: send as (message: string) => void });

    const delivered = registry.sendToAgent("device-1", { type: "ping" });

    expect(delivered).toBe(true);
    expect(send).toHaveBeenCalledWith(JSON.stringify({ type: "ping" }));
  });

  it("returns false when a device is offline", () => {
    const registry = new ConnectionRegistry();
    expect(registry.sendToAgent("missing", { type: "ping" })).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @codex-transit/server test -- realtime.gateway`

Expected: FAIL because the registry does not exist.

- [ ] **Step 3: Implement connection registry**

```ts
type Sender = { send: (message: string) => void };

export class ConnectionRegistry {
  private readonly agents = new Map<string, Sender>();
  private readonly viewersBySession = new Map<string, Set<Sender>>();

  addAgent(deviceId: string, sender: Sender) {
    this.agents.set(deviceId, sender);
  }

  removeAgent(deviceId: string) {
    this.agents.delete(deviceId);
  }

  addViewer(sessionId: string, sender: Sender) {
    const viewers = this.viewersBySession.get(sessionId) ?? new Set<Sender>();
    viewers.add(sender);
    this.viewersBySession.set(sessionId, viewers);
  }

  removeViewer(sessionId: string, sender: Sender) {
    const viewers = this.viewersBySession.get(sessionId);
    if (!viewers) return;
    viewers.delete(sender);
    if (viewers.size === 0) this.viewersBySession.delete(sessionId);
  }

  sendToAgent(deviceId: string, payload: unknown) {
    const sender = this.agents.get(deviceId);
    if (!sender) return false;
    sender.send(JSON.stringify(payload));
    return true;
  }

  broadcastToSession(sessionId: string, payload: unknown) {
    const viewers = this.viewersBySession.get(sessionId);
    if (!viewers) return 0;
    const message = JSON.stringify(payload);
    for (const viewer of viewers) viewer.send(message);
    return viewers.size;
  }
}
```

- [ ] **Step 4: Implement realtime gateway**

```ts
import type { FastifyInstance } from "fastify";
import { realtimeEventSchema } from "@codex-transit/shared";
import { z } from "zod";
import { ConnectionRegistry } from "./connection-registry";

export const connectionRegistry = new ConnectionRegistry();

const querySchema = z.object({
  role: z.enum(["agent", "viewer"]),
  token: z.string().min(1),
  deviceId: z.string().uuid().optional(),
  sessionId: z.string().uuid().optional()
});

export async function registerRealtimeGateway(app: FastifyInstance) {
  app.get("/realtime", { websocket: true }, async (socket, request) => {
    const query = querySchema.parse(request.query);
    const payload = app.jwt.verify<{ sub: string; email?: string }>(query.token);

    if (query.role === "agent") {
      if (!query.deviceId) throw new Error("deviceId_required");
      connectionRegistry.addAgent(query.deviceId, socket);
      await app.prisma.device.update({
        where: { id: query.deviceId },
        data: { online: true, lastSeenAt: new Date() }
      });
      socket.on("close", async () => {
        connectionRegistry.removeAgent(query.deviceId!);
        await app.prisma.device.update({
          where: { id: query.deviceId! },
          data: { online: false, lastSeenAt: new Date() }
        });
      });
    }

    if (query.role === "viewer") {
      if (!query.sessionId) throw new Error("sessionId_required");
      connectionRegistry.addViewer(query.sessionId, socket);
      socket.on("close", () => connectionRegistry.removeViewer(query.sessionId!, socket));
    }

    socket.on("message", async (raw) => {
      const event = realtimeEventSchema.parse(JSON.parse(raw.toString()));
      if ("sessionId" in event) {
        connectionRegistry.broadcastToSession(event.sessionId, event);
      }
      if (event.type === "codex.output.chunk") {
        await app.prisma.terminalOutputChunk.upsert({
          where: { sessionId_seq: { sessionId: event.sessionId, seq: event.seq } },
          update: { text: event.text, stream: event.stream },
          create: { sessionId: event.sessionId, seq: event.seq, stream: event.stream, text: event.text }
        });
      }
      if (event.type === "file.changed") {
        await app.prisma.fileChangeEvent.create({
          data: {
            sessionId: event.sessionId,
            relativePath: event.relativePath,
            oldRelativePath: event.oldRelativePath,
            changeType: event.changeType
          }
        });
      }
    });

    socket.send(JSON.stringify({ type: "connected", userId: payload.sub }));
  });
}
```

- [ ] **Step 5: Register realtime gateway in app**

Add this import and registration to `apps/server/src/app.ts`:

```ts
import { registerRealtimeGateway } from "./modules/realtime/realtime.gateway";

// inside buildApp after REST routes
await registerRealtimeGateway(app);
```

- [ ] **Step 6: Run realtime tests**

Run: `pnpm --filter @codex-transit/server test -- realtime.gateway`

Expected: PASS.

- [ ] **Step 7: Typecheck server**

Run: `pnpm --filter @codex-transit/server typecheck`

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add apps/server
git commit -m "feat: add realtime relay gateway"
```

## Phase 3: Desktop Agent Core

### Task 6: Scaffold Tauri Agent Shell

**Files:**
- Create: `apps/agent/package.json`
- Create: `apps/agent/src/main.tsx`
- Create: `apps/agent/src/App.tsx`
- Create: `apps/agent/src-tauri/Cargo.toml`
- Create: `apps/agent/src-tauri/tauri.conf.json`
- Create: `apps/agent/src-tauri/src/main.rs`

- [ ] **Step 1: Create agent package metadata**

```json
{
  "name": "@codex-transit/agent",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "tauri dev",
    "build": "tauri build",
    "lint": "cargo check --manifest-path src-tauri/Cargo.toml",
    "test": "cargo test --manifest-path src-tauri/Cargo.toml",
    "typecheck": "cargo check --manifest-path src-tauri/Cargo.toml"
  },
  "dependencies": {
    "@tauri-apps/api": "^2.2.0",
    "@vitejs/plugin-react": "^4.3.4",
    "vite": "^6.0.3",
    "typescript": "^5.7.2",
    "react": "^18.3.1",
    "react-dom": "^18.3.1"
  },
  "devDependencies": {
    "@tauri-apps/cli": "^2.2.0",
    "@types/react": "^18.3.16",
    "@types/react-dom": "^18.3.5"
  }
}
```

- [ ] **Step 2: Create minimal React entry**

```tsx
import React from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

- [ ] **Step 3: Create minimal agent UI**

```tsx
export function App() {
  return (
    <main style={{ fontFamily: "system-ui", padding: 24 }}>
      <h1>Codex Transit Agent</h1>
      <p>Desktop agent is running. Project whitelist management will appear here.</p>
    </main>
  );
}
```

- [ ] **Step 4: Create Rust manifest**

```toml
[package]
name = "codex-transit-agent"
version = "0.1.0"
edition = "2021"

[lib]
name = "codex_transit_agent"
path = "src/main.rs"

[dependencies]
anyhow = "1"
serde = { version = "1", features = ["derive"] }
serde_json = "1"
tauri = { version = "2", features = ["tray-icon"] }
tauri-plugin-shell = "2"
tokio = { version = "1", features = ["macros", "process", "rt-multi-thread", "sync", "time", "io-util"] }
uuid = { version = "1", features = ["v4", "serde"] }
```

- [ ] **Step 5: Create Tauri config**

```json
{
  "$schema": "https://schema.tauri.app/config/2",
  "productName": "Codex Transit Agent",
  "version": "0.1.0",
  "identifier": "dev.codex-transit.agent",
  "build": {
    "beforeDevCommand": "pnpm vite --host 127.0.0.1",
    "beforeBuildCommand": "pnpm vite build",
    "devUrl": "http://127.0.0.1:5173",
    "frontendDist": "../dist"
  },
  "app": {
    "windows": [
      {
        "title": "Codex Transit Agent",
        "width": 720,
        "height": 520
      }
    ]
  },
  "bundle": {
    "active": true,
    "targets": "all"
  }
}
```

- [ ] **Step 6: Create Tauri main**

```rust
fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .run(tauri::generate_context!())
        .expect("failed to run Codex Transit Agent");
}
```

- [ ] **Step 7: Verify Rust compiles**

Run: `pnpm --filter @codex-transit/agent typecheck`

Expected: cargo check succeeds.

- [ ] **Step 8: Commit**

```bash
git add apps/agent package.json pnpm-lock.yaml
git commit -m "feat: scaffold tauri desktop agent"
```

### Task 7: Implement Agent Path Guard And Project Registry

**Files:**
- Create: `apps/agent/src-tauri/src/path_guard.rs`
- Create: `apps/agent/src-tauri/src/project_registry.rs`
- Create: `apps/agent/src-tauri/tests/path_guard_test.rs`
- Modify: `apps/agent/src-tauri/src/main.rs`

- [ ] **Step 1: Write path guard tests**

```rust
use std::path::PathBuf;

use codex_transit_agent::path_guard::resolve_inside;

#[test]
fn accepts_relative_path_inside_root() {
    let root = PathBuf::from("C:/work/project");
    let resolved = resolve_inside(&root, "src/main.rs").unwrap();
    assert!(resolved.ends_with("src/main.rs"));
}

#[test]
fn rejects_parent_traversal() {
    let root = PathBuf::from("C:/work/project");
    let err = resolve_inside(&root, "../secret.txt").unwrap_err();
    assert!(err.to_string().contains("outside project"));
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @codex-transit/agent test -- path_guard`

Expected: FAIL because `path_guard` does not exist.

- [ ] **Step 3: Implement path guard**

```rust
use std::path::{Component, Path, PathBuf};

use anyhow::{bail, Result};

pub fn resolve_inside(root: &Path, relative_path: &str) -> Result<PathBuf> {
    let requested = Path::new(relative_path);
    if requested.is_absolute() {
        bail!("path is absolute");
    }

    for component in requested.components() {
        if matches!(component, Component::ParentDir | Component::RootDir | Component::Prefix(_)) {
            bail!("path resolves outside project");
        }
    }

    Ok(root.join(requested))
}
```

- [ ] **Step 4: Implement project registry**

```rust
use std::{collections::HashMap, path::PathBuf};

use anyhow::{bail, Result};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct ProjectEntry {
    pub project_id: Uuid,
    pub display_name: String,
    pub path_alias: String,
    pub root: PathBuf,
    pub available: bool,
}

#[derive(Default)]
pub struct ProjectRegistry {
    projects: HashMap<Uuid, ProjectEntry>,
}

impl ProjectRegistry {
    pub fn add_project(&mut self, root: PathBuf) -> Result<ProjectEntry> {
        if !root.exists() || !root.is_dir() {
            bail!("project directory does not exist");
        }
        let display_name = root
            .file_name()
            .and_then(|value| value.to_str())
            .unwrap_or("Project")
            .to_string();
        let entry = ProjectEntry {
            project_id: Uuid::new_v4(),
            path_alias: display_name.clone(),
            display_name,
            root,
            available: true,
        };
        self.projects.insert(entry.project_id, entry.clone());
        Ok(entry)
    }

    pub fn get(&self, project_id: &Uuid) -> Option<&ProjectEntry> {
        self.projects.get(project_id)
    }

    pub fn list(&self) -> Vec<ProjectEntry> {
        self.projects.values().cloned().collect()
    }
}
```

- [ ] **Step 5: Export modules from main**

Replace `main.rs` content with:

```rust
pub mod path_guard;
pub mod project_registry;

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .run(tauri::generate_context!())
        .expect("failed to run Codex Transit Agent");
}
```

- [ ] **Step 6: Run Rust tests**

Run: `pnpm --filter @codex-transit/agent test -- path_guard`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/agent/src-tauri
git commit -m "feat: add agent project registry and path guard"
```

### Task 8: Implement Codex Adapter And File Watcher

**Files:**
- Create: `apps/agent/src-tauri/src/codex_adapter.rs`
- Create: `apps/agent/src-tauri/src/file_watcher.rs`
- Modify: `apps/agent/src-tauri/Cargo.toml`
- Modify: `apps/agent/src-tauri/src/main.rs`

- [ ] **Step 1: Add Rust dependencies**

Add these dependencies to `apps/agent/src-tauri/Cargo.toml`:

```toml
notify = "7"
tokio-stream = "0.1"
```

- [ ] **Step 2: Implement Codex adapter**

```rust
use std::path::PathBuf;

use anyhow::Result;
use tokio::{
    io::{AsyncBufReadExt, AsyncWriteExt, BufReader},
    process::{Child, ChildStdin, Command},
    sync::mpsc,
};

#[derive(Debug)]
pub struct ProcessOutput {
    pub stream: OutputStream,
    pub text: String,
}

#[derive(Debug)]
pub enum OutputStream {
    Stdout,
    Stderr,
}

pub struct CodexSessionProcess {
    child: Child,
    stdin: ChildStdin,
}

pub struct CodexAdapter {
    command: String,
}

impl CodexAdapter {
    pub fn new(command: impl Into<String>) -> Self {
        Self { command: command.into() }
    }

    pub async fn start(
        &self,
        working_dir: PathBuf,
        output_tx: mpsc::Sender<ProcessOutput>,
    ) -> Result<CodexSessionProcess> {
        let mut child = Command::new(&self.command)
            .current_dir(working_dir)
            .arg("--help")
            .stdin(std::process::Stdio::piped())
            .stdout(std::process::Stdio::piped())
            .stderr(std::process::Stdio::piped())
            .spawn()?;

        let stdin = child.stdin.take().expect("child stdin should be piped");
        if let Some(stdout) = child.stdout.take() {
            let tx = output_tx.clone();
            tokio::spawn(async move {
                let mut lines = BufReader::new(stdout).lines();
                while let Ok(Some(line)) = lines.next_line().await {
                    let _ = tx.send(ProcessOutput { stream: OutputStream::Stdout, text: line }).await;
                }
            });
        }
        if let Some(stderr) = child.stderr.take() {
            let tx = output_tx;
            tokio::spawn(async move {
                let mut lines = BufReader::new(stderr).lines();
                while let Ok(Some(line)) = lines.next_line().await {
                    let _ = tx.send(ProcessOutput { stream: OutputStream::Stderr, text: line }).await;
                }
            });
        }

        Ok(CodexSessionProcess { child, stdin })
    }
}

impl CodexSessionProcess {
    pub async fn send_input(&mut self, text: &str) -> Result<()> {
        self.stdin.write_all(text.as_bytes()).await?;
        self.stdin.write_all(b"\n").await?;
        self.stdin.flush().await?;
        Ok(())
    }

    pub async fn stop(&mut self) -> Result<()> {
        self.child.kill().await?;
        Ok(())
    }
}
```

Note: the temporary `--help` invocation is intentional for the first compile-safe adapter. Replace it after discovery confirms the correct Codex CLI non-interactive invocation.

- [ ] **Step 3: Implement file watcher**

```rust
use std::{path::PathBuf, time::Duration};

use anyhow::Result;
use notify::{Config, Event, RecommendedWatcher, RecursiveMode, Watcher};
use tokio::sync::mpsc;

pub struct FileWatcher {
    _watcher: RecommendedWatcher,
}

impl FileWatcher {
    pub fn watch(root: PathBuf, tx: mpsc::Sender<Event>) -> Result<Self> {
        let mut watcher = RecommendedWatcher::new(
            move |result| {
                if let Ok(event) = result {
                    let _ = tx.blocking_send(event);
                }
            },
            Config::default().with_poll_interval(Duration::from_millis(500)),
        )?;
        watcher.watch(&root, RecursiveMode::Recursive)?;
        Ok(Self { _watcher: watcher })
    }
}
```

- [ ] **Step 4: Export modules**

Add to `main.rs`:

```rust
pub mod codex_adapter;
pub mod file_watcher;
```

- [ ] **Step 5: Run cargo check**

Run: `pnpm --filter @codex-transit/agent typecheck`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/agent/src-tauri
git commit -m "feat: add agent process adapter and file watcher"
```

### Task 9: Implement Agent Server Client Protocol

**Files:**
- Create: `apps/agent/src-tauri/src/protocol.rs`
- Create: `apps/agent/src-tauri/src/server_client.rs`
- Modify: `apps/agent/src-tauri/Cargo.toml`
- Modify: `apps/agent/src-tauri/src/main.rs`

- [ ] **Step 1: Add Rust dependencies**

Add these dependencies to `Cargo.toml`:

```toml
futures-util = "0.3"
tokio-tungstenite = { version = "0.26", features = ["rustls-tls-webpki-roots"] }
url = "2"
```

- [ ] **Step 2: Implement protocol structs**

```rust
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum RealtimeEvent {
    #[serde(rename = "session.start")]
    SessionStart {
        event_id: Uuid,
        timestamp: String,
        user_id: Uuid,
        device_id: Uuid,
        project_id: Uuid,
        session_id: Uuid,
    },
    #[serde(rename = "session.input")]
    SessionInput {
        event_id: Uuid,
        timestamp: String,
        user_id: Uuid,
        device_id: Uuid,
        project_id: Uuid,
        session_id: Uuid,
        text: String,
    },
    #[serde(rename = "session.stop")]
    SessionStop {
        event_id: Uuid,
        timestamp: String,
        user_id: Uuid,
        device_id: Uuid,
        project_id: Uuid,
        session_id: Uuid,
    },
    #[serde(rename = "codex.output.chunk")]
    CodexOutputChunk {
        event_id: Uuid,
        timestamp: String,
        user_id: Uuid,
        device_id: Uuid,
        project_id: Uuid,
        session_id: Uuid,
        seq: u64,
        stream: String,
        text: String,
    },
    #[serde(rename = "file.changed")]
    FileChanged {
        event_id: Uuid,
        timestamp: String,
        user_id: Uuid,
        device_id: Uuid,
        project_id: Uuid,
        session_id: Uuid,
        relative_path: String,
        old_relative_path: Option<String>,
        change_type: String,
    },
}
```

- [ ] **Step 3: Implement server client skeleton**

```rust
use anyhow::Result;
use futures_util::{SinkExt, StreamExt};
use tokio::sync::mpsc;
use tokio_tungstenite::{connect_async, tungstenite::Message};

use crate::protocol::RealtimeEvent;

pub struct ServerClient {
    url: String,
}

impl ServerClient {
    pub fn new(url: impl Into<String>) -> Self {
        Self { url: url.into() }
    }

    pub async fn connect(
        &self,
        outbound_rx: mpsc::Receiver<RealtimeEvent>,
        inbound_tx: mpsc::Sender<RealtimeEvent>,
    ) -> Result<()> {
        let (socket, _) = connect_async(&self.url).await?;
        let (mut write, mut read) = socket.split();
        let mut outbound_rx = outbound_rx;

        let writer = tokio::spawn(async move {
            while let Some(event) = outbound_rx.recv().await {
                let payload = serde_json::to_string(&event)?;
                write.send(Message::Text(payload.into())).await?;
            }
            anyhow::Ok(())
        });

        let reader = tokio::spawn(async move {
            while let Some(message) = read.next().await {
                let message = message?;
                if message.is_text() {
                    let event: RealtimeEvent = serde_json::from_str(message.to_text()?)?;
                    inbound_tx.send(event).await?;
                }
            }
            anyhow::Ok(())
        });

        let _ = tokio::try_join!(writer, reader)?;
        Ok(())
    }
}
```

- [ ] **Step 4: Export modules**

Add to `main.rs`:

```rust
pub mod protocol;
pub mod server_client;
```

- [ ] **Step 5: Run cargo check**

Run: `pnpm --filter @codex-transit/agent typecheck`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/agent/src-tauri
git commit -m "feat: add agent websocket protocol client"
```

## Phase 4: Mobile PWA

### Task 10: Scaffold Mobile Web App

**Files:**
- Create: `apps/web/package.json`
- Create: `apps/web/tsconfig.json`
- Create: `apps/web/vite.config.ts`
- Create: `apps/web/index.html`
- Create: `apps/web/src/main.tsx`
- Create: `apps/web/src/App.tsx`
- Create: `apps/web/src/styles.css`

- [ ] **Step 1: Create web package metadata**

```json
{
  "name": "@codex-transit/web",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "build": "vite build",
    "dev": "vite --host 0.0.0.0",
    "lint": "tsc -p tsconfig.json --noEmit",
    "test": "vitest run",
    "typecheck": "tsc -p tsconfig.json --noEmit"
  },
  "dependencies": {
    "@codex-transit/shared": "workspace:*",
    "@vitejs/plugin-react": "^4.3.4",
    "vite": "^6.0.3",
    "typescript": "^5.7.2",
    "react": "^18.3.1",
    "react-dom": "^18.3.1"
  },
  "devDependencies": {
    "@types/react": "^18.3.16",
    "@types/react-dom": "^18.3.5",
    "vitest": "^2.1.8"
  }
}
```

- [ ] **Step 2: Create TypeScript config**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "jsx": "react-jsx",
    "types": ["vite/client"],
    "noEmit": true
  },
  "include": ["src/**/*.ts", "src/**/*.tsx", "vite.config.ts"]
}
```

- [ ] **Step 3: Create Vite config**

```ts
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5174
  }
});
```

- [ ] **Step 4: Create HTML shell**

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Codex Transit</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 5: Create React entry**

```tsx
import React from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import "./styles.css";

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

- [ ] **Step 6: Create first mobile app shell**

```tsx
export function App() {
  return (
    <main className="app-shell">
      <header className="top-bar">
        <div>
          <p className="eyebrow">Codex Transit</p>
          <h1>Remote sessions</h1>
        </div>
      </header>
      <section className="panel">
        <p>Login, device selection, project sessions, and the live console will be added in the next tasks.</p>
      </section>
    </main>
  );
}
```

- [ ] **Step 7: Create mobile-first CSS**

```css
:root {
  color: #172026;
  background: #f6f8f9;
  font-family:
    Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}

* {
  box-sizing: border-box;
}

body {
  margin: 0;
}

button,
input,
textarea {
  font: inherit;
}

.app-shell {
  min-height: 100vh;
  max-width: 720px;
  margin: 0 auto;
  padding: 18px;
}

.top-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 0 16px;
}

.eyebrow {
  margin: 0 0 4px;
  color: #5f6f78;
  font-size: 0.82rem;
  text-transform: uppercase;
  letter-spacing: 0;
}

h1 {
  margin: 0;
  font-size: 1.6rem;
}

.panel {
  background: #ffffff;
  border: 1px solid #d9e1e5;
  border-radius: 8px;
  padding: 16px;
}
```

- [ ] **Step 8: Typecheck web**

Run: `pnpm --filter @codex-transit/web typecheck`

Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add apps/web package.json pnpm-lock.yaml
git commit -m "feat: scaffold mobile pwa"
```

### Task 11: Implement PWA API Client And Main Views

**Files:**
- Create: `apps/web/src/api/client.ts`
- Create: `apps/web/src/api/realtime.ts`
- Create: `apps/web/src/components/LoginView.tsx`
- Create: `apps/web/src/components/DeviceListView.tsx`
- Create: `apps/web/src/components/SessionConsole.tsx`
- Modify: `apps/web/src/App.tsx`
- Modify: `apps/web/src/styles.css`

- [ ] **Step 1: Implement HTTP client**

```ts
import type { DeviceSummary, LoginResponse, SessionSummary } from "@codex-transit/shared";

const API_BASE = import.meta.env.VITE_API_BASE ?? "http://localhost:4000";

export class ApiClient {
  constructor(private token: string | null) {}

  async login(email: string, password: string): Promise<LoginResponse> {
    return this.request("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password })
    });
  }

  async devices(): Promise<DeviceSummary[]> {
    return this.request("/devices");
  }

  async sessions(projectId: string): Promise<SessionSummary[]> {
    return this.request(`/projects/${projectId}/sessions`);
  }

  async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const response = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers: {
        "content-type": "application/json",
        ...(this.token ? { authorization: `Bearer ${this.token}` } : {}),
        ...init.headers
      }
    });
    if (!response.ok) throw new Error(`Request failed: ${response.status}`);
    return response.json();
  }
}
```

- [ ] **Step 2: Implement realtime client**

```ts
import { realtimeEventSchema, type RealtimeEvent } from "@codex-transit/shared";

const WS_BASE = import.meta.env.VITE_WS_BASE ?? "ws://localhost:4000";

export function connectSessionStream(options: {
  token: string;
  sessionId: string;
  onEvent: (event: RealtimeEvent) => void;
}) {
  const url = new URL("/realtime", WS_BASE);
  url.searchParams.set("role", "viewer");
  url.searchParams.set("token", options.token);
  url.searchParams.set("sessionId", options.sessionId);

  const socket = new WebSocket(url);
  socket.addEventListener("message", (message) => {
    const raw = JSON.parse(message.data);
    const parsed = realtimeEventSchema.safeParse(raw);
    if (parsed.success) options.onEvent(parsed.data);
  });

  return () => socket.close();
}
```

- [ ] **Step 3: Implement login view**

```tsx
import { FormEvent, useState } from "react";

export function LoginView(props: { onLogin: (email: string, password: string) => Promise<void> }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      await props.onLogin(email, password);
    } catch {
      setError("Login failed");
    }
  }

  return (
    <form className="panel stack" onSubmit={submit}>
      <label>
        Email
        <input value={email} onChange={(event) => setEmail(event.target.value)} />
      </label>
      <label>
        Password
        <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
      </label>
      {error ? <p className="error">{error}</p> : null}
      <button type="submit">Log in</button>
    </form>
  );
}
```

- [ ] **Step 4: Implement device list view**

```tsx
import type { DeviceSummary } from "@codex-transit/shared";

export function DeviceListView(props: {
  devices: DeviceSummary[];
  onSelect: (device: DeviceSummary) => void;
}) {
  return (
    <section className="stack">
      {props.devices.map((device) => (
        <button className="list-row" key={device.id} onClick={() => props.onSelect(device)}>
          <span>{device.name}</span>
          <span className={device.online ? "status online" : "status"}>{device.online ? "Online" : "Offline"}</span>
        </button>
      ))}
    </section>
  );
}
```

- [ ] **Step 5: Implement session console**

```tsx
import { useEffect, useState } from "react";
import type { RealtimeEvent } from "@codex-transit/shared";
import { connectSessionStream } from "../api/realtime";

export function SessionConsole(props: { token: string; sessionId: string }) {
  const [lines, setLines] = useState<string[]>([]);
  const [files, setFiles] = useState<string[]>([]);

  useEffect(() => {
    return connectSessionStream({
      token: props.token,
      sessionId: props.sessionId,
      onEvent(event: RealtimeEvent) {
        if (event.type === "codex.output.chunk") {
          setLines((current) => [...current, event.text]);
        }
        if (event.type === "file.changed") {
          setFiles((current) => Array.from(new Set([...current, event.relativePath])));
        }
      }
    });
  }, [props.token, props.sessionId]);

  return (
    <section className="console-grid">
      <pre className="console">{lines.join("\n")}</pre>
      <aside className="panel stack">
        <h2>Changed files</h2>
        {files.map((file) => (
          <button className="file-row" key={file}>{file}</button>
        ))}
      </aside>
    </section>
  );
}
```

- [ ] **Step 6: Wire App state**

```tsx
import { useMemo, useState } from "react";
import type { DeviceSummary } from "@codex-transit/shared";
import { ApiClient } from "./api/client";
import { DeviceListView } from "./components/DeviceListView";
import { LoginView } from "./components/LoginView";
import { SessionConsole } from "./components/SessionConsole";

export function App() {
  const [token, setToken] = useState<string | null>(localStorage.getItem("token"));
  const [devices, setDevices] = useState<DeviceSummary[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const api = useMemo(() => new ApiClient(token), [token]);

  async function login(email: string, password: string) {
    const result = await api.login(email, password);
    localStorage.setItem("token", result.token);
    setToken(result.token);
    const deviceList = await new ApiClient(result.token).devices();
    setDevices(deviceList);
  }

  async function refreshDevices() {
    setDevices(await api.devices());
  }

  return (
    <main className="app-shell">
      <header className="top-bar">
        <div>
          <p className="eyebrow">Codex Transit</p>
          <h1>Remote sessions</h1>
        </div>
        {token ? <button onClick={refreshDevices}>Refresh</button> : null}
      </header>

      {!token ? <LoginView onLogin={login} /> : null}
      {token && !selectedSessionId ? (
        <DeviceListView devices={devices} onSelect={(_device) => setSelectedSessionId(prompt("Session ID") ?? null)} />
      ) : null}
      {token && selectedSessionId ? <SessionConsole token={token} sessionId={selectedSessionId} /> : null}
    </main>
  );
}
```

- [ ] **Step 7: Add view styles**

Append to `styles.css`:

```css
.stack {
  display: grid;
  gap: 12px;
}

label {
  display: grid;
  gap: 6px;
  color: #33434c;
}

input,
textarea {
  width: 100%;
  border: 1px solid #c9d4da;
  border-radius: 6px;
  padding: 10px 12px;
  background: white;
}

button {
  min-height: 40px;
  border: 1px solid #1f6feb;
  border-radius: 6px;
  padding: 8px 12px;
  color: white;
  background: #1f6feb;
}

.list-row,
.file-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  color: #172026;
  background: white;
  border-color: #d9e1e5;
}

.status {
  color: #8a4b00;
}

.status.online {
  color: #18794e;
}

.console-grid {
  display: grid;
  gap: 12px;
}

.console {
  min-height: 320px;
  margin: 0;
  overflow: auto;
  border-radius: 8px;
  padding: 12px;
  color: #d7e2ea;
  background: #11181c;
}

.error {
  margin: 0;
  color: #b42318;
}
```

- [ ] **Step 8: Typecheck web**

Run: `pnpm --filter @codex-transit/web typecheck`

Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add apps/web
git commit -m "feat: add mobile pwa session console"
```

## Phase 5: Integration Loop

### Task 12: Route Session Commands From Web To Agent

**Files:**
- Modify: `apps/server/src/modules/sessions/session.routes.ts`
- Modify: `apps/server/src/modules/realtime/realtime.gateway.ts`
- Modify: `apps/web/src/api/client.ts`
- Modify: `apps/web/src/components/SessionConsole.tsx`

- [ ] **Step 1: Add server endpoint to send session input**

Add to `registerSessionRoutes`:

```ts
app.post("/sessions/:sessionId/input", async (request, reply) => {
  const user = await requireUser(request);
  const params = z.object({ sessionId: z.string().uuid() }).parse(request.params);
  const body = z.object({ text: z.string().min(1) }).parse(request.body);
  const session = await app.prisma.session.findFirst({
    where: { id: params.sessionId, userId: user.id }
  });
  if (!session) return reply.code(404).send({ error: "session_not_found" });

  await app.prisma.sessionMessage.create({
    data: { sessionId: session.id, role: "user", text: body.text }
  });

  const event = {
    type: "session.input",
    eventId: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    userId: user.id,
    deviceId: session.deviceId,
    projectId: session.projectId,
    sessionId: session.id,
    text: body.text
  };

  const { connectionRegistry } = await import("../realtime/realtime.gateway");
  const delivered = connectionRegistry.sendToAgent(session.deviceId, event);
  if (!delivered) return reply.code(409).send({ error: "agent_offline" });
  return { ok: true };
});
```

- [ ] **Step 2: Add server endpoint to start session**

Add to `registerSessionRoutes`:

```ts
app.post("/sessions/:sessionId/start", async (request, reply) => {
  const user = await requireUser(request);
  const params = z.object({ sessionId: z.string().uuid() }).parse(request.params);
  const session = await app.prisma.session.findFirst({
    where: { id: params.sessionId, userId: user.id }
  });
  if (!session) return reply.code(404).send({ error: "session_not_found" });

  const event = {
    type: "session.start",
    eventId: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    userId: user.id,
    deviceId: session.deviceId,
    projectId: session.projectId,
    sessionId: session.id
  };

  const { connectionRegistry } = await import("../realtime/realtime.gateway");
  const delivered = connectionRegistry.sendToAgent(session.deviceId, event);
  if (!delivered) return reply.code(409).send({ error: "agent_offline" });
  await app.prisma.session.update({ where: { id: session.id }, data: { status: "running" } });
  return { ok: true };
});
```

- [ ] **Step 3: Add API client methods**

Add to `ApiClient`:

```ts
async startSession(sessionId: string): Promise<{ ok: boolean }> {
  return this.request(`/sessions/${sessionId}/start`, { method: "POST" });
}

async sendSessionInput(sessionId: string, text: string): Promise<{ ok: boolean }> {
  return this.request(`/sessions/${sessionId}/input`, {
    method: "POST",
    body: JSON.stringify({ text })
  });
}
```

- [ ] **Step 4: Add input form to `SessionConsole`**

Update component signature and add form state:

```tsx
export function SessionConsole(props: {
  token: string;
  sessionId: string;
  onSend: (text: string) => Promise<void>;
}) {
  const [prompt, setPrompt] = useState("");
  // keep existing lines/files state
}
```

Render this form below the console:

```tsx
<form
  className="panel stack"
  onSubmit={async (event) => {
    event.preventDefault();
    if (!prompt.trim()) return;
    await props.onSend(prompt);
    setPrompt("");
  }}
>
  <textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} />
  <button type="submit">Send</button>
</form>
```

- [ ] **Step 5: Pass send handler from `App`**

```tsx
{token && selectedSessionId ? (
  <SessionConsole
    token={token}
    sessionId={selectedSessionId}
    onSend={(text) => api.sendSessionInput(selectedSessionId, text)}
  />
) : null}
```

- [ ] **Step 6: Typecheck**

Run: `pnpm typecheck`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/server apps/web
git commit -m "feat: route session input to agent"
```

### Task 13: Wire Agent Runtime Event Handling

**Files:**
- Create: `apps/agent/src-tauri/src/commands.rs`
- Modify: `apps/agent/src-tauri/src/main.rs`
- Modify: `apps/agent/src-tauri/src/server_client.rs`

- [ ] **Step 1: Implement Tauri commands for adding projects**

```rust
use std::{path::PathBuf, sync::Mutex};

use tauri::State;

use crate::project_registry::{ProjectEntry, ProjectRegistry};

pub struct AgentState {
    pub projects: Mutex<ProjectRegistry>,
}

#[tauri::command]
pub fn add_project(path: String, state: State<AgentState>) -> Result<ProjectEntry, String> {
    let mut projects = state.projects.lock().map_err(|_| "project registry locked".to_string())?;
    projects.add_project(PathBuf::from(path)).map_err(|error| error.to_string())
}

#[tauri::command]
pub fn list_projects(state: State<AgentState>) -> Result<Vec<ProjectEntry>, String> {
    let projects = state.projects.lock().map_err(|_| "project registry locked".to_string())?;
    Ok(projects.list())
}
```

- [ ] **Step 2: Register commands and state**

Update `main.rs`:

```rust
pub mod codex_adapter;
pub mod commands;
pub mod file_watcher;
pub mod path_guard;
pub mod project_registry;
pub mod protocol;
pub mod server_client;

use commands::{add_project, list_projects, AgentState};
use project_registry::ProjectRegistry;
use std::sync::Mutex;

fn main() {
    tauri::Builder::default()
        .manage(AgentState { projects: Mutex::new(ProjectRegistry::default()) })
        .invoke_handler(tauri::generate_handler![add_project, list_projects])
        .plugin(tauri_plugin_shell::init())
        .run(tauri::generate_context!())
        .expect("failed to run Codex Transit Agent");
}
```

- [ ] **Step 3: Run agent checks**

Run: `pnpm --filter @codex-transit/agent typecheck`

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add apps/agent/src-tauri
git commit -m "feat: wire agent project commands"
```

### Task 14: Implement Stop Session And Diff Request Flow

**Files:**
- Modify: `apps/server/src/modules/sessions/session.routes.ts`
- Modify: `apps/web/src/api/client.ts`
- Modify: `apps/web/src/components/SessionConsole.tsx`
- Modify: `apps/agent/src-tauri/src/path_guard.rs`
- Create: `apps/agent/src-tauri/src/diff_provider.rs`
- Modify: `apps/agent/src-tauri/src/main.rs`

- [ ] **Step 1: Add server endpoint to stop a session**

Add to `registerSessionRoutes`:

```ts
app.post("/sessions/:sessionId/stop", async (request, reply) => {
  const user = await requireUser(request);
  const params = z.object({ sessionId: z.string().uuid() }).parse(request.params);
  const session = await app.prisma.session.findFirst({
    where: { id: params.sessionId, userId: user.id }
  });
  if (!session) return reply.code(404).send({ error: "session_not_found" });

  const event = {
    type: "session.stop",
    eventId: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    userId: user.id,
    deviceId: session.deviceId,
    projectId: session.projectId,
    sessionId: session.id
  };

  const { connectionRegistry } = await import("../realtime/realtime.gateway");
  const delivered = connectionRegistry.sendToAgent(session.deviceId, event);
  if (!delivered) return reply.code(409).send({ error: "agent_offline" });
  await app.prisma.session.update({ where: { id: session.id }, data: { status: "stopped" } });
  return { ok: true };
});
```

- [ ] **Step 2: Add server endpoint to request a diff**

Add to `registerSessionRoutes`:

```ts
app.post("/sessions/:sessionId/diff", async (request, reply) => {
  const user = await requireUser(request);
  const params = z.object({ sessionId: z.string().uuid() }).parse(request.params);
  const body = z.object({ relativePath: z.string().min(1) }).parse(request.body);
  const session = await app.prisma.session.findFirst({
    where: { id: params.sessionId, userId: user.id }
  });
  if (!session) return reply.code(404).send({ error: "session_not_found" });

  const event = {
    type: "diff.request",
    eventId: crypto.randomUUID(),
    requestId: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    userId: user.id,
    deviceId: session.deviceId,
    projectId: session.projectId,
    sessionId: session.id,
    relativePath: body.relativePath
  };

  const { connectionRegistry } = await import("../realtime/realtime.gateway");
  const delivered = connectionRegistry.sendToAgent(session.deviceId, event);
  if (!delivered) return reply.code(409).send({ error: "agent_offline" });
  return { ok: true, requestId: event.requestId };
});
```

- [ ] **Step 3: Add API client methods**

Add to `ApiClient`:

```ts
async stopSession(sessionId: string): Promise<{ ok: boolean }> {
  return this.request(`/sessions/${sessionId}/stop`, { method: "POST" });
}

async requestDiff(sessionId: string, relativePath: string): Promise<{ ok: boolean; requestId: string }> {
  return this.request(`/sessions/${sessionId}/diff`, {
    method: "POST",
    body: JSON.stringify({ relativePath })
  });
}
```

- [ ] **Step 4: Update session console props**

Update `SessionConsole` props:

```tsx
export function SessionConsole(props: {
  token: string;
  sessionId: string;
  onSend: (text: string) => Promise<void>;
  onStop: () => Promise<void>;
  onRequestDiff: (relativePath: string) => Promise<void>;
}) {
```

- [ ] **Step 5: Render stop and diff controls**

Add the stop button near the prompt form:

```tsx
<button type="button" className="secondary" onClick={props.onStop}>
  Stop session
</button>
```

Replace file buttons with:

```tsx
{files.map((file) => (
  <button className="file-row" key={file} onClick={() => props.onRequestDiff(file)}>
    {file}
  </button>
))}
```

- [ ] **Step 6: Pass stop and diff handlers from `App`**

Update `SessionConsole` usage:

```tsx
<SessionConsole
  token={token}
  sessionId={selectedSessionId}
  onSend={(text) => api.sendSessionInput(selectedSessionId, text)}
  onStop={() => api.stopSession(selectedSessionId)}
  onRequestDiff={(relativePath) => api.requestDiff(selectedSessionId, relativePath).then(() => undefined)}
/>
```

- [ ] **Step 7: Add secondary button style**

Append to `apps/web/src/styles.css`:

```css
.secondary {
  color: #172026;
  background: #ffffff;
  border-color: #c9d4da;
}
```

- [ ] **Step 8: Implement diff provider**

```rust
use std::{path::Path, process::Command};

use anyhow::Result;

use crate::path_guard::resolve_inside;

pub fn diff_file(project_root: &Path, relative_path: &str) -> Result<String> {
    let _validated = resolve_inside(project_root, relative_path)?;
    let output = Command::new("git")
        .arg("diff")
        .arg("--")
        .arg(relative_path)
        .current_dir(project_root)
        .output()?;

    if output.status.success() {
        Ok(String::from_utf8_lossy(&output.stdout).to_string())
    } else {
        Ok(String::from_utf8_lossy(&output.stderr).to_string())
    }
}
```

- [ ] **Step 9: Export diff provider module**

Add to `main.rs`:

```rust
pub mod diff_provider;
```

- [ ] **Step 10: Run typechecks**

Run: `pnpm typecheck`

Expected: PASS.

- [ ] **Step 11: Run agent tests**

Run: `pnpm --filter @codex-transit/agent test`

Expected: PASS.

- [ ] **Step 12: Commit**

```bash
git add apps/server apps/web apps/agent
git commit -m "feat: add session stop and diff requests"
```

### Task 15: Add Agent Binding Consumption Endpoint

**Files:**
- Modify: `apps/server/src/modules/devices/device.routes.ts`
- Modify: `apps/server/src/modules/devices/device.service.ts`

- [ ] **Step 1: Add device token helper**

Add to `device.service.ts`:

```ts
export function createDeviceToken() {
  return randomBytes(32).toString("base64url");
}
```

- [ ] **Step 2: Add bind consumption route**

Add to `registerDeviceRoutes`:

```ts
app.post("/agent/bind", async (request, reply) => {
  const body = z.object({
    bindCode: z.string().min(8),
    name: z.string().min(1),
    platform: z.enum(["windows", "macos", "unknown"])
  }).parse(request.body);

  const codeHash = hashSecret(body.bindCode);
  const bindCode = await app.prisma.deviceBindCode.findUnique({ where: { codeHash } });
  if (!bindCode || bindCode.usedAt || bindCode.expiresAt.getTime() < Date.now()) {
    return reply.code(401).send({ error: "invalid_bind_code" });
  }

  const token = createDeviceToken();
  const device = await app.prisma.device.create({
    data: {
      userId: bindCode.userId,
      name: body.name,
      platform: body.platform,
      tokenHash: hashSecret(token),
      online: false
    }
  });
  await app.prisma.deviceBindCode.update({
    where: { id: bindCode.id },
    data: { usedAt: new Date() }
  });

  return { deviceId: device.id, token };
});
```

- [ ] **Step 3: Import zod and helper**

At the top of `device.routes.ts`, ensure these imports exist:

```ts
import { z } from "zod";
import { bindCodeExpiry, createBindCode, createDeviceToken, hashSecret } from "./device.service";
```

- [ ] **Step 4: Typecheck server**

Run: `pnpm --filter @codex-transit/server typecheck`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/server/src/modules/devices
git commit -m "feat: add agent device binding endpoint"
```

### Task 16: Add Local Development And Smoke Test Scripts

**Files:**
- Modify: `package.json`
- Create: `docs/local-development.md`

- [ ] **Step 1: Add scripts to root package**

```json
{
  "scripts": {
    "build": "pnpm -r build",
    "dev": "pnpm --parallel --filter @codex-transit/server --filter @codex-transit/web dev",
    "dev:agent": "pnpm --filter @codex-transit/agent dev",
    "lint": "pnpm -r lint",
    "test": "pnpm -r test",
    "typecheck": "pnpm -r typecheck",
    "db:up": "docker compose up -d postgres",
    "db:down": "docker compose down",
    "verify": "pnpm typecheck && pnpm test"
  }
}
```

Keep the existing package fields; replace only the `scripts` object.

- [ ] **Step 2: Create local development doc**

```markdown
# Local Development

## Prerequisites

- Node.js 22
- pnpm 9
- Docker
- Rust stable
- Tauri prerequisites for the current OS

## Start Database

```bash
pnpm db:up
```

Use this local server URL:

```text
postgresql://codex_transit:codex_transit@localhost:54321/codex_transit
```

## Start Server And Web

```bash
$env:DATABASE_URL="postgresql://codex_transit:codex_transit@localhost:54321/codex_transit"
$env:JWT_SECRET="01234567890123456789012345678901"
pnpm dev
```

The server runs on `http://localhost:4000`.
The PWA runs on `http://localhost:5174`.

## Start Agent

```bash
pnpm dev:agent
```

## Smoke Test

1. Register or login through the API.
2. Bind or seed a test device.
3. Add a project directory in the agent.
4. Create a session in the PWA.
5. Start the session.
6. Send input from the PWA.
7. Confirm raw output appears in the session console.
8. Modify a file in the selected project and confirm a file change event appears.
```

- [ ] **Step 3: Run full verification**

Run: `pnpm verify`

Expected: Typecheck and tests pass for all workspace packages.

- [ ] **Step 4: Commit**

```bash
git add package.json docs/local-development.md
git commit -m "docs: add local development workflow"
```

## Phase 6: MVP Completion Checks

### Task 17: Manual End-To-End Verification

**Files:**
- Modify only if verification exposes issues.

- [ ] **Step 1: Start database**

Run: `pnpm db:up`

Expected: `postgres` container is healthy or running.

- [ ] **Step 2: Start server and web**

Run: `pnpm dev`

Expected: server logs show `http://0.0.0.0:4000`; web logs show `http://localhost:5174`.

- [ ] **Step 3: Start agent**

Run: `pnpm dev:agent`

Expected: Tauri window opens and cargo logs show no runtime panic.

- [ ] **Step 4: Exercise session flow**

Use the PWA and server API to:

1. Login.
2. Open device list.
3. Select a project.
4. Select or create a session.
5. Start the session.
6. Send session input.
7. Confirm output chunks render in the console.
8. Confirm changed file names appear in the file change panel.
9. Click a changed file and confirm a diff request is sent.
10. Stop the session and confirm the running process exits.

- [ ] **Step 5: Record gaps**

If Codex CLI invocation is not yet confirmed, record the exact CLI behavior in `docs/local-development.md` under a `Codex CLI Discovery` section.

- [ ] **Step 6: Final verification**

Run: `pnpm verify`

Expected: PASS.

- [ ] **Step 7: Commit fixes or discovery notes**

```bash
git add .
git commit -m "test: verify local codex transit loop"
```

## Self-Review Notes

- Spec coverage:
  - Account/password auth: Tasks 3-4.
  - Device binding foundation: Tasks 4 and 15.
  - Multi-device list: Task 4.
  - Manual project whitelist: Tasks 7 and 13.
  - PWA device/session/console flow: Tasks 10-12.
  - Raw output streaming: Tasks 5, 8, 9, 11, 12.
  - File change streaming: Tasks 5, 8, 11.
  - Diff on demand: Task 14.
  - Stop session: Task 14.
- Placeholder scan: no TBD/TODO placeholders are intentionally left in implementation steps.
- Type consistency: event names and session statuses match the design spec and shared schemas.
