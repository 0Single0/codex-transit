# Codex Transit

Codex Transit 是一个把 Web 端会话控制台和本地桌面 Agent 连接起来的多端协作工具。它的目标是让用户在浏览器里管理设备、项目和会话，把指令安全地下发到绑定设备上的本地工作目录中执行，并实时查看输出、文件变化和上下文信息。

## 主要功能

- 账号登录与鉴权：服务端提供用户注册、登录和 JWT 鉴权能力。
- 设备绑定：支持通过绑定码或登录配对把桌面 Agent 绑定到用户账号。
- 设备管理：查看设备列表、在线状态、最近活跃时间，并向 Agent 拉取模型信息。
- 项目同步：桌面 Agent 可以把本机可用项目同步到服务端，Web 端按设备查看项目列表。
- 运行时会话：Web 端可以基于设备和项目创建运行时会话，启动、输入、停止一次远程 Codex 会话。
- 实时通信：服务端通过 WebSocket 在 Web 控制台和桌面 Agent 之间转发实时事件。
- 附件上传：Web 端支持上传附件，并把附件地址随会话输入一起传递给 Agent。
- 文件变更查看：会话运行期间可以对指定相对路径发起 diff 请求，便于查看本地代码变化。
- 历史会话接入：服务端预留了按设备和项目查询 Codex 历史会话的能力，用于恢复或复用既有上下文。

## 仓库结构

```text
apps/
  agent/    Tauri 桌面 Agent，运行在开发者本机
  server/   Fastify + Prisma 服务端
  web/      React + Vite Web / PWA 控制台
packages/
  shared/   共享协议、类型、事件和传输工具
docs/
  local-development.md
```

## 系统架构

1. 用户在 `web` 中登录，并查看已绑定设备与项目。
2. 桌面 `agent` 在本机运行，负责项目扫描、设备注册、与服务端建立连接，以及执行本地会话相关操作。
3. `server` 负责账号、设备、项目、会话路由、附件上传和实时事件转发。
4. `shared` 提供三端复用的类型定义、事件协议和传输加密工具。

## 技术栈

- Web：React 18、Vite、Tailwind
- Agent：Tauri 2、React、Rust
- Server：Fastify 5、Prisma、PostgreSQL、WebSocket
- Shared：TypeScript、Zod
- Workspace：pnpm monorepo

## 本地开发

### 环境要求

- Node.js 22
- pnpm 10
- Rust stable
- Tauri 运行依赖
- PostgreSQL

### 1. 安装依赖

```powershell
pnpm install
```

### 2. 启动数据库

仓库自带本地 PostgreSQL Compose：

```powershell
pnpm db:up
```

默认映射端口：

- PostgreSQL: `localhost:54321`

### 3. 配置环境变量

服务端参考 [apps/server/.env.example](/E:/code/codex-transit/apps/server/.env.example)：

```env
DATABASE_URL=postgresql://postgres:root@localhost:5432/codex_transit
JWT_SECRET=01234567890123456789012345678901
PORT=4000
```

Web 端参考 [apps/web/.env.example](/E:/code/codex-transit/apps/web/.env.example)：

```env
VITE_WEB_PORT=5174
VITE_API_BASE=http://localhost:4000
VITE_WS_BASE=ws://localhost:4000
```

如果使用仓库自带的 Docker PostgreSQL，请把 `DATABASE_URL` 改成：

```env
DATABASE_URL=postgresql://codex_transit:codex_transit@localhost:54321/codex_transit
```

### 4. 执行 Prisma

```powershell
pnpm --filter @codex-transit/server prisma:generate
pnpm --filter @codex-transit/server prisma:migrate
```

### 5. 启动 Web 和 Server

```powershell
pnpm dev
```

默认地址：

- Server: `http://localhost:4000`
- Web: `http://localhost:5174`

### 6. 启动桌面 Agent

```powershell
pnpm dev:agent
```

## 推荐验证流程

1. 启动 `server`、`web` 和 `agent`。
2. 先注册或登录一个账号。
3. 在 Web 端生成绑定码，或发起登录配对。
4. 在 Agent 中完成设备绑定。
5. 让 Agent 同步本机项目。
6. 在 Web 端选择设备与项目，创建并启动运行时会话。
7. 发送输入，观察实时输出和文件变更事件。

## 部署方式

当前仓库建议拆成两部分部署：

- 服务端部署：`server + web + postgres`
- 桌面端分发：单独构建并安装 `agent`

### 方式一：使用 Docker Compose 部署服务端

仓库已经提供 [docker-compose.deploy.yml](/E:/code/codex-transit/docker-compose.deploy.yml)。

启动：

```powershell
pnpm docker:deploy
```

停止：

```powershell
pnpm docker:stop
```

查看日志：

```powershell
pnpm docker:logs
```

默认暴露端口：

- PostgreSQL: `54321`
- Server API: `4000`
- Web: `5700`

说明：

- `server` 容器启动时会自动执行 `prisma migrate deploy`。
- `web` 会在构建时注入 `VITE_API_BASE` 和 `VITE_WS_BASE`。
- 生产环境部署前，建议把 `docker-compose.deploy.yml` 中的 API / WS 地址、数据库密码和 `JWT_SECRET` 改成真实配置。

### 方式二：分别部署 Server 与 Web

如果你希望把前后端分别部署到不同机器或平台，可以按下面方式处理：

1. `server`

```powershell
pnpm --filter @codex-transit/server prisma:generate
pnpm --filter @codex-transit/server build
pnpm --filter @codex-transit/server exec prisma migrate deploy
pnpm --filter @codex-transit/server exec tsx src/index.ts
```

2. `web`

```powershell
pnpm --filter @codex-transit/web build
```

然后把 `apps/web/dist` 部署到任意静态站点或 Nginx，并确保：

- `VITE_API_BASE` 指向服务端公网地址
- `VITE_WS_BASE` 指向服务端 WebSocket 地址

### 桌面 Agent 的部署与分发

`agent` 不是服务端容器的一部分，它需要安装在开发者本机或目标设备上。

开发模式：

```powershell
pnpm dev:agent
```

构建桌面安装包：

```powershell
pnpm agent:bundle
```

Agent 构建基于 Tauri，打包前需要目标系统满足对应的 Rust 和 Tauri 依赖。打包完成后，可将生成的安装包分发给需要绑定设备的用户。

## 常用命令

```powershell
pnpm dev
pnpm dev:agent
pnpm build
pnpm test
pnpm typecheck
pnpm verify
pnpm db:up
pnpm db:down
pnpm docker:deploy
pnpm docker:stop
pnpm docker:logs
```