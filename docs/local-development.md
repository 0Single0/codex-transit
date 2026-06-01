# Local Development

## Prerequisites

- Node.js 22
- pnpm 10
- Rust stable
- Tauri prerequisites for the current OS
- PostgreSQL available at `localhost:5432`

## Database

Use the local database URL provided for this project:

```text
postgresql://postgres:root@localhost:5432/postgres
```

PowerShell:

```powershell
$env:DATABASE_URL="postgresql://postgres:root@localhost:5432/postgres"
$env:JWT_SECRET="01234567890123456789012345678901"
```

## Start Server And Web

```powershell
pnpm dev
```

The server runs on `http://localhost:4000`.
The PWA runs on `http://localhost:5174`.

## Start Agent

```powershell
pnpm dev:agent
```

## Smoke Test

1. Register or login through the API.
2. Create a bind code from the phone or API.
3. Bind a test device through `/agent/bind`.
4. Add a project directory in the agent.
5. Create a session in the PWA.
6. Start the session.
7. Send input from the PWA.
8. Confirm raw output appears in the session console.
9. Modify a file in the selected project and confirm a file change event appears.
10. Click a changed file and confirm a diff request is sent.
11. Stop the session and confirm the running process exits.

## Verification

```powershell
pnpm verify
```

## Codex CLI Discovery

The Rust `CodexAdapter` currently uses `codex --help` as a compile-safe placeholder command. Before full end-to-end use, confirm the installed Codex CLI command name, non-interactive input mode, working-directory behavior, stop behavior, and any native session resume support.
