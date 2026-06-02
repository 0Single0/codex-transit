# Codex Model Picker And Chat Composer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a dynamic provider-backed model picker to the mobile chat composer and refactor live chat rendering so waiting, streaming, timeout, and failure states render inside a single assistant bubble.

**Architecture:** The desktop agent discovers available models from the same provider configuration that local Codex already uses, then pushes normalized model metadata through realtime to device viewers. The web app stores per-device model state, passes the selected model through session input, and replaces the current multi-bubble output stream with a single live assistant turn model.

**Tech Stack:** React, TypeScript, Fastify, Zod, Rust, Tauri, Tokio, Vitest

---

## File Map

- Create: `apps/agent/src-tauri/src/provider_models.rs`
- Create: `apps/web/src/components/ChatComposer.tsx`
- Create: `apps/web/src/components/LiveTurnBubble.tsx`
- Modify: `packages/shared/src/events.ts`
- Modify: `packages/shared/src/events.test.ts`
- Modify: `apps/server/src/modules/sessions/session.service.ts`
- Modify: `apps/server/src/modules/sessions/session.routes.ts`
- Modify: `apps/server/test/session.service.test.ts`
- Modify: `apps/server/test/realtime.gateway.test.ts`
- Modify: `apps/agent/src-tauri/src/protocol.rs`
- Modify: `apps/agent/src-tauri/src/lib.rs`
- Modify: `apps/agent/src-tauri/src/agent_runtime.rs`
- Modify: `apps/agent/src-tauri/src/server_client.rs`
- Modify: `apps/agent/src-tauri/src/session_manager.rs`
- Modify: `apps/agent/src-tauri/src/codex_adapter.rs`
- Modify: `apps/agent/src-tauri/tests/protocol_test.rs`
- Modify: `apps/agent/src-tauri/tests/session_manager_test.rs`
- Modify: `apps/web/src/App.tsx`
- Modify: `apps/web/src/api/client.ts`
- Modify: `apps/web/src/api/client.test.ts`
- Modify: `apps/web/src/components/SessionConsole.tsx`
- Modify: `apps/web/src/api/realtime.test.ts`
- Modify: `apps/web/src/i18n.ts`
- Modify: `apps/web/src/conversationItems.test.ts`

### Task 1: Shared Protocol For Models And Session Input

**Files:**
- Modify: `packages/shared/src/events.ts`
- Modify: `packages/shared/src/events.test.ts`

- [ ] **Step 1: Write the failing shared schema test**

```ts
it("parses device model update events and session input model fields", () => {
  const event = realtimeEventSchema.parse({
    eventId: "00000000-0000-4000-8000-000000000001",
    timestamp: "2026-06-02T00:00:00.000Z",
    userId: "00000000-0000-4000-8000-000000000002",
    deviceId: "00000000-0000-4000-8000-000000000003",
    type: "device.models.updated",
    models: [
      {
        id: "gpt-5.3-codex",
        label: "gpt-5.3-codex",
        provider: "custom",
        available: true
      }
    ],
    defaultModel: "gpt-5.3-codex"
  });

  const input = realtimeEventSchema.parse({
    eventId: "00000000-0000-4000-8000-000000000004",
    timestamp: "2026-06-02T00:00:00.000Z",
    userId: "00000000-0000-4000-8000-000000000002",
    deviceId: "00000000-0000-4000-8000-000000000003",
    projectId: "00000000-0000-4000-8000-000000000005",
    sessionId: "00000000-0000-4000-8000-000000000006",
    type: "session.input",
    text: "hello",
    model: "gpt-5.3-codex"
  });

  expect(event.type).toBe("device.models.updated");
  expect(input.type).toBe("session.input");
  if (input.type === "session.input") {
    expect(input.model).toBe("gpt-5.3-codex");
  }
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @codex-transit/shared test`
Expected: FAIL because `device.models.updated` and `session.input.model` are not in the schema.

- [ ] **Step 3: Write minimal shared schema implementation**

```ts
export const codexModelSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  provider: z.string().min(1),
  available: z.boolean(),
  ownedBy: z.string().min(1).optional()
});

export const deviceModelsUpdatedSchema = baseEventSchema.extend({
  type: z.literal("device.models.updated"),
  models: z.array(codexModelSchema),
  defaultModel: z.string().min(1).optional(),
  error: z.string().min(1).optional()
});

export const sessionInputSchema = sessionBaseSchema.extend({
  type: z.literal("session.input"),
  text: z.string().min(1),
  model: z.string().min(1).optional()
});
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @codex-transit/shared test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/events.ts packages/shared/src/events.test.ts
git commit -m "feat(shared): add model update realtime protocol"
```

### Task 2: Server Passthrough For Selected Model

**Files:**
- Modify: `apps/server/src/modules/sessions/session.service.ts`
- Modify: `apps/server/src/modules/sessions/session.routes.ts`
- Modify: `apps/server/test/session.service.test.ts`

- [ ] **Step 1: Write the failing server tests**

```ts
it("builds session input events with an optional model", () => {
  const session = {
    id: "00000000-0000-4000-8000-000000000001",
    userId: "00000000-0000-4000-8000-000000000002",
    deviceId: "00000000-0000-4000-8000-000000000003",
    projectId: "00000000-0000-4000-8000-000000000004",
    project: { agentKey: "00000000-0000-4000-8000-000000000099" }
  };

  const events = buildStartAndInputEvents(
    session,
    "hello",
    {
      eventId: () => "00000000-0000-4000-8000-000000000010",
      now: () => "2026-06-02T00:00:00.000Z"
    },
    undefined,
    "gpt-5.3-codex"
  );

  expect(events[1]).toMatchObject({
    type: "session.input",
    model: "gpt-5.3-codex"
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @codex-transit/server test -- session.service.test.ts`
Expected: FAIL because the helper does not accept a model argument.

- [ ] **Step 3: Write minimal server passthrough implementation**

```ts
export function buildStartAndInputEvents(
  session: SessionShape,
  text: string,
  clock = defaultClock,
  codexSessionId?: string,
  model?: string
) {
  const base = buildSessionRealtimeBase(session);
  const inputEvent = {
    type: "session.input",
    eventId: clock.eventId(),
    timestamp: clock.now(),
    ...base,
    ...(codexSessionId ? { codexSessionId } : {}),
    ...(model ? { model } : {}),
    text
  };
  ...
}
```

And in the route:

```ts
const body = z.object({
  text: z.string().min(1),
  codexSessionId: z.string().min(1).optional(),
  model: z.string().min(1).optional()
}).parse(request.body);

for (const event of buildStartAndInputEvents(
  session,
  body.text,
  undefined,
  body.codexSessionId,
  body.model
)) {
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @codex-transit/server test -- session.service.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/server/src/modules/sessions/session.service.ts apps/server/src/modules/sessions/session.routes.ts apps/server/test/session.service.test.ts
git commit -m "feat(server): pass selected model through session input"
```

### Task 3: Agent Protocol Support For Model Updates And Input Model

**Files:**
- Modify: `apps/agent/src-tauri/src/protocol.rs`
- Modify: `apps/agent/src-tauri/tests/protocol_test.rs`

- [ ] **Step 1: Write the failing Rust protocol test**

```rust
#[test]
fn parses_device_models_updated_event() {
    let payload = r#"{
        "type":"device.models.updated",
        "eventId":"00000000-0000-4000-8000-000000000001",
        "timestamp":"2026-06-02T00:00:00.000Z",
        "userId":"00000000-0000-4000-8000-000000000002",
        "deviceId":"00000000-0000-4000-8000-000000000003",
        "models":[{"id":"gpt-5.3-codex","label":"gpt-5.3-codex","provider":"custom","available":true}],
        "defaultModel":"gpt-5.3-codex"
    }"#;

    let event: RealtimeEvent = serde_json::from_str(payload).unwrap();

    assert!(matches!(event, RealtimeEvent::DeviceModelsUpdated { .. }));
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cargo test --manifest-path apps/agent/src-tauri/Cargo.toml protocol_test -- --nocapture`
Expected: FAIL because the enum variant and model struct do not exist yet.

- [ ] **Step 3: Write minimal Rust protocol implementation**

```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CodexModel {
    pub id: String,
    pub label: String,
    pub provider: String,
    pub available: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub owned_by: Option<String>,
}
```

And add:

```rust
#[serde(rename = "device.models.updated", rename_all = "camelCase")]
DeviceModelsUpdated {
    event_id: Uuid,
    timestamp: String,
    user_id: Uuid,
    device_id: Uuid,
    models: Vec<CodexModel>,
    #[serde(skip_serializing_if = "Option::is_none")]
    default_model: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    error: Option<String>
},
```

Also add `model: Option<String>` to `SessionInput`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cargo test --manifest-path apps/agent/src-tauri/Cargo.toml protocol_test -- --nocapture`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/agent/src-tauri/src/protocol.rs apps/agent/src-tauri/tests/protocol_test.rs
git commit -m "feat(agent): add model update protocol types"
```

### Task 4: Agent Provider Model Discovery

**Files:**
- Create: `apps/agent/src-tauri/src/provider_models.rs`
- Modify: `apps/agent/src-tauri/src/lib.rs`
- Modify: `apps/agent/src-tauri/src/server_client.rs`
- Modify: `apps/agent/src-tauri/src/agent_runtime.rs`

- [ ] **Step 1: Write the failing provider model normalization test**

Use `provider_models.rs` unit tests like:

```rust
#[test]
fn normalizes_openai_style_model_payload() {
    let payload = serde_json::json!({
        "data": [
            { "id": "gpt-5.3-codex", "owned_by": "openai" },
            { "id": "gpt-4.1", "owned_by": "openai" }
        ]
    });

    let models = normalize_provider_models("custom", &payload).unwrap();

    assert_eq!(models[0].id, "gpt-5.3-codex");
    assert!(models[0].available);
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cargo test --manifest-path apps/agent/src-tauri/Cargo.toml normalizes_openai_style_model_payload -- --nocapture`
Expected: FAIL because the module does not exist.

- [ ] **Step 3: Write minimal provider discovery implementation**

Implementation outline:

```rust
pub async fn fetch_provider_models() -> ProviderModelsResult {
    let provider = std::env::var("OPENAI_PROVIDER").unwrap_or_else(|_| "custom".to_string());
    let base_url = std::env::var("OPENAI_BASE_URL")
        .or_else(|_| std::env::var("OPENAI_API_BASE"))
        .unwrap_or_else(|_| "https://api.openai.com/v1".to_string());
    let api_key = std::env::var("OPENAI_API_KEY").ok();

    if api_key.is_none() {
        return ProviderModelsResult::failure("OPENAI_API_KEY is not configured");
    }

    let url = format!("{}/models", base_url.trim_end_matches('/'));
    let response = reqwest::Client::new()
        .get(url)
        .bearer_auth(api_key.unwrap())
        .send()
        .await?;
    let value: serde_json::Value = response.json().await?;
    let models = normalize_provider_models(&provider, &value)?;
    Ok(ProviderModelsSnapshot {
        provider,
        default_model: std::env::var("OPENAI_MODEL").ok().or_else(|| std::env::var("CODEX_MODEL").ok()),
        models,
        error: None,
    })
}
```

Wire a startup call in the agent runtime after websocket connect and send a `RealtimeEvent::DeviceModelsUpdated`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cargo test --manifest-path apps/agent/src-tauri/Cargo.toml normalizes_openai_style_model_payload -- --nocapture`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/agent/src-tauri/src/provider_models.rs apps/agent/src-tauri/src/lib.rs apps/agent/src-tauri/src/server_client.rs apps/agent/src-tauri/src/agent_runtime.rs
git commit -m "feat(agent): sync provider model list on startup"
```

### Task 5: Agent Execution Options For Selected Model

**Files:**
- Modify: `apps/agent/src-tauri/src/codex_adapter.rs`
- Modify: `apps/agent/src-tauri/src/session_manager.rs`
- Modify: `apps/agent/src-tauri/tests/session_manager_test.rs`

- [ ] **Step 1: Write the failing session manager test**

```rust
#[tokio::test]
async fn forwards_selected_model_to_runner() {
    let runner = FakeRunner::default();
    let state = runner.state.clone();
    let mut manager = SessionManager::new(runner);
    let session_id = SESSION_ID.parse().unwrap();
    let project_id = PROJECT_ID.parse().unwrap();

    manager.register_project(project_id, PathBuf::from("C:/projects/demo"));
    manager.handle_event(start_event()).await.unwrap();
    manager.handle_event(RealtimeEvent::SessionInput {
        event_id: "00000000-0000-4000-8000-000000000011".parse().unwrap(),
        timestamp: "2026-06-02T00:00:01.000Z".to_string(),
        user_id: USER_ID.parse().unwrap(),
        device_id: DEVICE_ID.parse().unwrap(),
        project_id,
        session_id,
        codex_session_id: None,
        model: Some("gpt-5.3-codex".to_string()),
        text: "hello".to_string(),
    }).await.unwrap();

    assert_eq!(state.lock().unwrap().selected_models, vec!["gpt-5.3-codex".to_string()]);
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cargo test --manifest-path apps/agent/src-tauri/Cargo.toml forwards_selected_model_to_runner -- --nocapture`
Expected: FAIL because the runner interface does not carry model options.

- [ ] **Step 3: Write minimal model forwarding implementation**

Refactor the runner trait signatures to include execution options:

```rust
pub struct SessionExecRequest {
    pub working_dir: PathBuf,
    pub prompt: String,
    pub codex_session_id: Option<String>,
    pub model: Option<String>,
}
```

And use it in adapter command construction:

```rust
let mut exec = self.build_exec_command(working_dir.clone(), CodexExecOptions {
    sandbox: None,
    model,
});
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cargo test --manifest-path apps/agent/src-tauri/Cargo.toml forwards_selected_model_to_runner -- --nocapture`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/agent/src-tauri/src/codex_adapter.rs apps/agent/src-tauri/src/session_manager.rs apps/agent/src-tauri/tests/session_manager_test.rs
git commit -m "feat(agent): forward selected model into codex execution"
```

### Task 6: Server Realtime Relay For Device Model Updates

**Files:**
- Modify: `apps/server/src/modules/realtime/realtime.gateway.ts`
- Modify: `apps/server/test/realtime.gateway.test.ts`

- [ ] **Step 1: Write the failing realtime relay test**

Add a case that sends:

```ts
{
  type: "device.models.updated",
  eventId: "00000000-0000-4000-8000-000000000001",
  timestamp: "2026-06-02T00:00:00.000Z",
  userId: "00000000-0000-4000-8000-000000000002",
  deviceId: "00000000-0000-4000-8000-000000000003",
  models: [{ id: "gpt-5.3-codex", label: "gpt-5.3-codex", provider: "custom", available: true }]
}
```

and assert the device viewer receives it.

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @codex-transit/server test -- realtime.gateway.test.ts`
Expected: FAIL because the gateway only rebroadcasts history result events to device viewers.

- [ ] **Step 3: Write minimal relay implementation**

```ts
if (
  event.type === "codex.history.result" ||
  event.type === "codex.history.detail.result" ||
  event.type === "device.models.updated"
) {
  connectionRegistry.broadcastToDeviceViewers(event.deviceId, event);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @codex-transit/server test -- realtime.gateway.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/server/src/modules/realtime/realtime.gateway.ts apps/server/test/realtime.gateway.test.ts
git commit -m "feat(server): relay device model updates to viewers"
```

### Task 7: Web Client API And App State For Models

**Files:**
- Modify: `apps/web/src/App.tsx`
- Modify: `apps/web/src/api/client.ts`
- Modify: `apps/web/src/api/client.test.ts`
- Modify: `apps/web/src/i18n.ts`

- [ ] **Step 1: Write the failing web API/state tests**

Add an API client test for:

```ts
await client.sendSessionInput("session-1", "hello", "codex-session-1", "gpt-5.3-codex");
```

Expect request body:

```ts
{
  text: "hello",
  codexSessionId: "codex-session-1",
  model: "gpt-5.3-codex"
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @codex-transit/web test -- client.test.ts`
Expected: FAIL because the client method does not accept `model`.

- [ ] **Step 3: Write minimal web state implementation**

Update the client:

```ts
async sendSessionInput(
  sessionId: string,
  text: string,
  codexSessionId?: string,
  model?: string
): Promise<{ ok: boolean }> {
  return this.request(`/sessions/${sessionId}/input`, {
    method: "POST",
    data: {
      text,
      ...(codexSessionId ? { codexSessionId } : {}),
      ...(model ? { model } : {})
    }
  });
}
```

Update `App.tsx` to store:

```ts
const [deviceModelsById, setDeviceModelsById] = useState<Record<string, DeviceModelState>>({});
const [selectedModelBySession, setSelectedModelBySession] = useState<Record<string, string | null>>({});
```

Listen for `device.models.updated` on the device stream and cache per device.

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @codex-transit/web test -- client.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/App.tsx apps/web/src/api/client.ts apps/web/src/api/client.test.ts apps/web/src/i18n.ts
git commit -m "feat(web): store device model lists and selected model state"
```

### Task 8: Composer Refactor And Live Assistant Bubble

**Files:**
- Create: `apps/web/src/components/ChatComposer.tsx`
- Create: `apps/web/src/components/LiveTurnBubble.tsx`
- Modify: `apps/web/src/components/SessionConsole.tsx`
- Modify: `apps/web/src/conversationItems.test.ts`

- [ ] **Step 1: Write the failing conversation/composer tests**

Add a test proving one pending assistant bubble is updated instead of appended:

```ts
it("keeps one live assistant bubble through waiting and streaming", () => {
  const liveTurn = {
    status: "streaming",
    text: "partial answer",
    errorMessage: null,
    turnKey: "turn-1"
  };

  const items = buildConversationItems([], [], liveTurn);

  expect(items).toEqual([
    {
      id: "live-turn-turn-1",
      role: "codex",
      text: "partial answer"
    }
  ]);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @codex-transit/web test -- conversationItems.test.ts`
Expected: FAIL because the helper does not understand a live turn model.

- [ ] **Step 3: Write minimal composer/live turn implementation**

Split the composer and live bubble UI into new files and update `SessionConsole.tsx` state:

```ts
const [liveTurn, setLiveTurn] = useState<LiveTurnState | null>(null);
```

On submit:

```ts
setLiveTurn({
  status: "waiting",
  text: "",
  errorMessage: null,
  turnKey: `${props.sessionId}-${Date.now()}`
});
```

On chunk:

```ts
setLiveTurn((current) => current ? {
  ...current,
  status: "streaming",
  text: `${current.text}${event.text}`
} : current);
```

On failure:

```ts
setLiveTurn((current) => current ? {
  ...current,
  status: "failed",
  errorMessage: event.message
} : current);
```

Move the lower controls into `ChatComposer.tsx` with:

- upper multiline input area
- lower footer row with model selector on the left
- loading send button on the right

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @codex-transit/web test -- conversationItems.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/ChatComposer.tsx apps/web/src/components/LiveTurnBubble.tsx apps/web/src/components/SessionConsole.tsx apps/web/src/conversationItems.test.ts
git commit -m "feat(web): redesign chat composer and live assistant bubble"
```

### Task 9: Model Picker Rendering And Session Send Integration

**Files:**
- Modify: `apps/web/src/components/SessionConsole.tsx`
- Modify: `apps/web/src/App.tsx`
- Modify: `apps/web/src/api/realtime.test.ts`

- [ ] **Step 1: Write the failing realtime/UI tests**

Add a realtime parsing assertion for:

```ts
{
  type: "device.models.updated",
  eventId: "00000000-0000-4000-8000-000000000001",
  timestamp: "2026-06-02T00:00:00.000Z",
  userId: "00000000-0000-4000-8000-000000000002",
  deviceId: "00000000-0000-4000-8000-000000000003",
  models: [{ id: "gpt-5.3-codex", label: "gpt-5.3-codex", provider: "custom", available: true }]
}
```

and expect it to be delivered to `onEvent`.

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @codex-transit/web test -- realtime.test.ts`
Expected: FAIL if the new event type is not handled end-to-end in test fixtures or UI state assumptions.

- [ ] **Step 3: Write minimal model picker integration**

Pass model state into `SessionConsole`:

```ts
<SessionConsole
  ...
  models={deviceModelsById[selectedDevice.id]?.models ?? []}
  modelsLoading={deviceModelsById[selectedDevice.id]?.loading ?? true}
  selectedModel={selectedModelBySession[selectedSessionId] ?? deviceModelsById[selectedDevice.id]?.defaultModel ?? null}
  onSelectModel={(model) => {
    setSelectedModelBySession((current) => ({ ...current, [selectedSessionId]: model }));
  }}
  onSend={async (text, model) => {
    await runAuthorized(() => api.sendSessionInput(selectedSessionId, text, activeCodexSessionId ?? undefined, model ?? undefined));
  }}
/>;
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @codex-transit/web test -- realtime.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/App.tsx apps/web/src/components/SessionConsole.tsx apps/web/src/api/realtime.test.ts
git commit -m "feat(web): wire dynamic model picker into chat send flow"
```

### Task 10: Full Verification

**Files:**
- Modify: none unless fixes are needed

- [ ] **Step 1: Run shared tests**

Run: `pnpm --filter @codex-transit/shared test`
Expected: PASS

- [ ] **Step 2: Run web tests and typecheck**

Run: `pnpm --filter @codex-transit/web test`
Expected: PASS

Run: `pnpm --filter @codex-transit/web typecheck`
Expected: PASS

- [ ] **Step 3: Run server tests and typecheck**

Run: `pnpm --filter @codex-transit/server test`
Expected: PASS

Run: `pnpm --filter @codex-transit/server typecheck`
Expected: PASS

- [ ] **Step 4: Run shared typecheck and targeted agent tests**

Run: `pnpm --filter @codex-transit/shared typecheck`
Expected: PASS

Run: `cargo test --manifest-path apps/agent/src-tauri/Cargo.toml protocol_test session_manager_test -- --nocapture`
Expected: PASS, or if the environment still has the known Rust cache/toolchain issue, document the exact failing external condition in the final report.

- [ ] **Step 5: Commit final fixes**

```bash
git add .
git commit -m "feat(transit): add dynamic model picker and live chat composer"
```
