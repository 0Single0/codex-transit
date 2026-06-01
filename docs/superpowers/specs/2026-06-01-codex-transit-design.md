# Codex Transit Design

Date: 2026-06-01

## Goal

Codex Transit lets a user operate local Codex CLI sessions from a phone. A server relays commands and events between the phone and one or more local desktop agents. The local agent runs on Windows and macOS, exposes only user-approved project directories, starts Codex CLI inside a selected project, streams the original CLI output to the phone, and reports file change events in near real time.

The first version targets a mobile Web/PWA experience and a Tauri desktop tray agent. The server is designed for local development first, then self-hosted VPS deployment.

## Confirmed Product Decisions

- Project directories are added manually in the desktop agent. There is no automatic full-disk scan.
- The first mobile client is a Web/PWA. A native app can come later.
- Projects contain multiple sessions. Users can create new sessions or inspect/continue old ones.
- The desktop agent is a Tauri tray app. Rust owns the background logic.
- Development starts with local three-part integration, then moves to a self-hosted VPS.
- Authentication uses account password login plus QR-code or binding-code device pairing.
- Live progress shows raw Codex CLI output plus file change events. Diff is fetched on demand.
- The project uses a TypeScript monorepo for server, web, and shared protocol types. The Tauri agent uses Rust for local background work.

## Architecture

The system has three main surfaces:

1. **Relay server**
   - Provides account authentication, device binding, device presence, project metadata, session metadata, event persistence, and WebSocket routing.
   - Does not directly access local source code.
   - Stores only metadata, terminal output chunks, file change events, audit logs, and optionally non-sensitive project labels.

2. **Desktop agent**
   - Runs as a Windows/macOS Tauri tray app.
   - Maintains an outbound WebSocket connection to the relay server.
   - Stores device credentials in the OS credential store.
   - Manages a local registry of user-approved project directories.
   - Starts and stops Codex CLI child processes in selected project directories.
   - Streams stdout/stderr and file change events through the server.
   - Produces file diffs only when requested.

3. **Mobile Web/PWA**
   - Lets users log in, choose a bound device, choose an approved project, view project sessions, create or continue sessions, send prompts, watch raw Codex output, see file change events, request diffs, and stop running sessions.

The phone never connects directly to the computer. Both the phone and the agent connect to the relay server. This avoids NAT, firewall, and mobile network issues.

## Monorepo Layout

```text
apps/
  server/        # Node.js + TypeScript API and WebSocket relay
  web/           # React/Vite mobile-first PWA
  agent/         # Tauri desktop tray app; Rust owns background logic
packages/
  shared/        # TypeScript protocol types, event schemas, API contracts
  config/        # Shared lint, TypeScript, and formatting config
```

## Server Components

- **AuthService**: account registration, password login, password hashing, session/JWT issuance, token revocation.
- **DeviceService**: device records, binding codes, QR binding, device token issuance, device online/offline state.
- **ProjectService**: stores server-side project metadata synced from each agent.
- **SessionService**: manages project sessions, session states, messages, terminal output chunks, and file events.
- **RealtimeGateway**: WebSocket gateway for phone clients and agents; handles authentication, routing, heartbeats, and disconnect state.
- **EventStore**: appends terminal chunks, file changes, session status changes, and audit events.

## Agent Components

- **Tray/UI**: Tauri tray menu and settings window for login/binding, project directory management, and connection status.
- **CredentialStore**: stores device tokens in the OS credential store or platform keychain.
- **ServerClient**: Rust WebSocket client that maintains the outbound server connection and reconnects with backoff.
- **ProjectRegistry**: local store of approved directories. Full paths stay local. Server receives project IDs and display metadata.
- **CodexProcessManager**: starts, tracks, writes to, and stops Codex CLI child processes per project/session.
- **FileWatcher**: watches the active project directory during a session, debounces events, and reports create/modify/delete/rename events.
- **DiffProvider**: validates paths and returns current diff content on demand.

## Mobile Web/PWA Components

- **Login**: account password login.
- **DeviceList**: shows bound devices and online/offline state.
- **DeviceDetail**: shows one device's approved projects.
- **ProjectSessions**: lists project sessions and supports creating a new session.
- **SessionConsole**: displays user messages, raw Codex CLI output, status, prompt input, and stop controls.
- **FileChangesPanel**: shows real-time file change events and loads current diff when a file is selected.

## Core Data Flows

### Device Binding

1. Agent starts and shows a login/binding surface.
2. User logs in on the computer or generates a one-time binding code/QR code.
3. Phone logs in and scans the code or enters the binding code.
4. Server binds the connected agent to the user account.
5. Agent receives a device token and stores it in the OS credential store.
6. Future agent starts use the stored token to reconnect automatically.

### Project Directory Whitelist

1. User manually adds project directories in the agent settings UI.
2. Agent validates that each directory exists and records it locally.
3. Agent syncs safe project metadata to the server.
4. Phone displays only these approved projects.
5. Any command referencing a project must pass server authorization and agent local registry validation.

### Session Start And Input

1. Phone creates a session under a device and project.
2. Server persists the session and sends `session.start` to the target agent.
3. Agent validates `projectId` against the local registry.
4. Agent starts Codex CLI in the selected project directory.
5. Phone sends prompt input as `session.input`.
6. Agent writes input to the Codex CLI process stdin.

Continuing an old session in MVP means restoring server-side history and starting a new local Codex CLI process for new work. Native Codex CLI session resume can be added later if the CLI exposes stable support for it.

### Raw Output Streaming

1. Agent reads Codex CLI stdout and stderr.
2. Agent sends ordered `codex.output.chunk` events to the server.
3. Server persists chunks and broadcasts them to connected phone clients viewing the session.
4. If the phone refreshes, it loads historical chunks first, then resumes the live stream.

### File Change Events

1. Agent starts a watcher for the active project directory while a session is running.
2. Watcher emits create, modify, delete, and rename events.
3. Agent debounces and deduplicates bursts.
4. Agent sends `file.changed` events with relative paths only.
5. Server persists events and broadcasts them to the phone.
6. Phone displays changed files in the session.

### Diff On Demand

1. Phone requests a diff for one changed file.
2. Server checks user/device/session authorization and forwards `diff.request` to the agent.
3. Agent validates that the requested relative path resolves inside the project directory.
4. Agent returns `diff.result` with current diff content or a typed error.
5. The first version does not persist diff content by default.

### Stop Session

1. Phone sends `session.stop`.
2. Server forwards the request to the agent.
3. Agent tries to terminate the Codex CLI child process gracefully.
4. If graceful termination times out, agent force kills the process.
5. Agent reports final `session.status`.

## Protocol Events

All events include:

- `eventId`
- `timestamp`
- `userId`
- `deviceId`

Session events also include:

- `projectId`
- `sessionId`

Initial event set:

```text
agent.online
agent.offline
device.bound
projects.sync
session.start
session.input
session.stop
session.status
codex.output.chunk
file.changed
diff.request
diff.result
error.event
```

`codex.output.chunk` includes:

- `seq`
- `stream`: `stdout` or `stderr`
- `text`

`file.changed` includes:

- `relativePath`
- `changeType`: `created`, `modified`, `deleted`, or `renamed`
- optional `oldRelativePath` for rename events

## Storage Model

First-version server tables or collections:

- `users`
- `devices`
- `device_bind_codes`
- `projects`
- `sessions`
- `session_messages`
- `terminal_output_chunks`
- `file_change_events`
- `audit_logs`

Important storage rules:

- `projects` stores project metadata, not arbitrary source content.
- Full local paths should stay on the agent when possible. Server may store a safe display name, path tail, or agent-local project key.
- `terminal_output_chunks` are append-only and ordered by `sessionId + seq`.
- `file_change_events` store relative paths and event types.
- `audit_logs` record user actions such as session start, input send, stop, device bind, and project sync.
- Diff content is generated on demand and not stored in MVP.

## Security Boundaries

- The agent only works inside directories manually approved by the user.
- The phone cannot send arbitrary shell commands. It can only send controlled protocol commands such as session input, start, stop, and diff request.
- All file paths from the phone are relative paths.
- The agent normalizes requested paths and confirms they remain inside the selected project directory.
- Device binding codes are short-lived and single-use.
- Device tokens are stored in the OS credential store.
- Server-side device credentials should be revocable and stored as hashes or equivalent non-reusable secrets.
- Agent disconnects immediately mark the device offline. Running sessions move to `agent_disconnected` or `unknown`.
- Agent reconnect uses exponential backoff and then resynchronizes device/project/session status.
- Audit logs record security-sensitive operations.

## MVP Scope

MVP includes:

- Account/password login.
- Desktop agent login or binding.
- Multi-device list.
- Manual project directory whitelist in agent.
- Mobile device and project selection.
- Project session list.
- New session creation.
- Remote Codex CLI start.
- Mobile prompt input.
- Raw Codex CLI stdout/stderr streaming.
- File change event streaming.
- On-demand file diff.
- Session stop.
- Basic historical output loading after phone refresh.
- Local development setup for all three apps.

MVP excludes:

- Native mobile app.
- Multi-user collaboration on one device.
- Automatic project scanning.
- Full IDE file tree.
- Browser-based code editor.
- End-to-end encryption.
- Arbitrary remote shell execution.
- Deep integration with the Codex desktop app.
- Full native Codex CLI session resume unless a stable CLI interface is confirmed.
- Complex role-based permissions.

## Implementation Decisions

- Use Fastify for the server. It is lightweight enough for the MVP and still supports a clean plugin/service structure.
- Use PostgreSQL from day one, run locally through Docker Compose, and reuse the same database family on the VPS.
- Use React/Vite for the PWA.
- Use Tauri v2 for the agent.
- Rust owns process management, file watching, token storage, path validation, and WebSocket connectivity.
- TypeScript protocol schemas live in `packages/shared` and use Zod for runtime validation.
- Rust mirrors the event payloads with explicit `serde` structs for the MVP. Schema generation can be added later if drift becomes painful.
- Codex CLI access goes through a Rust `CodexAdapter` boundary. The adapter is responsible for command discovery, invocation, stdin/stdout handling, stop behavior, and future resume support.
- The first development milestone proves the full loop: phone sends input, server routes it, agent starts a local process, output streams back, and file events appear.

## Implementation Discovery Tasks

- Confirm the installed Codex CLI command name, arguments, non-interactive behavior, and exit semantics on Windows.
- Confirm the equivalent Codex CLI behavior on macOS before packaging a macOS agent.
- Confirm whether Codex CLI exposes stable native session resume. Until then, MVP session continuation means server-side history plus a fresh local CLI process.
- Confirm Tauri tray and auto-start behavior on both Windows and macOS during packaging.
