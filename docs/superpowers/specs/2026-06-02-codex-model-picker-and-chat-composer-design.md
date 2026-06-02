# Codex Transit Dynamic Model Picker And Chat Composer Design

## Goal

Add a dynamic model picker to the mobile chat experience without hardcoding model names, and redesign the chat composer so all send, waiting, streaming, and failure states live inside the conversation as model bubbles instead of top banners or inline form errors.

This design must preserve the current relay-first architecture:

- mobile/web is a viewer and controller
- server is a relay and auth layer
- desktop agent is the source of truth for Codex availability and provider-backed model availability
- Codex CLI remains the execution engine

## Scope

This spec covers:

- dynamic model list retrieval from the desktop agent's active Codex provider configuration
- syncing available models to the mobile/web client
- letting users choose a model from the chat composer footer
- passing the selected model through server and agent into `codex exec` and `codex exec resume`
- redesigning the chat composer into a two-zone structure
- pre-inserting a model bubble for waiting, streaming, timeout, and failure states

This spec does not cover:

- storing custom model lists in the database
- a top-of-page model selector
- multi-provider account management UI
- changing Codex history storage rules

## User Experience

### Composer Layout

The composer becomes a structured panel with two vertical zones:

- upper zone: the multiline question input
- lower zone: left side model selector, right side send button

The visual style should fit the existing dark mobile console, but the structure should follow the user's requested pattern rather than the current single-row textarea-and-send layout.

### Send Behavior

When the user submits:

1. Insert the user bubble immediately.
2. Insert a placeholder Codex bubble immediately after it.
3. Put the send button into loading and disabled state.
4. Render the placeholder Codex bubble as a waiting state.
5. As Codex text arrives, mutate that placeholder bubble into the real assistant bubble instead of appending separate status banners.
6. If Codex fails, render the error text inside that same Codex bubble.
7. If Codex times out before first meaningful output, render the timeout message inside that same Codex bubble.
8. Only unlock sending again when the turn finishes or fails.

There should be no waiting or failure text at the top of the page or below the input box.

### Model Selection

- The model selector only appears in the composer footer.
- The selector loads from realtime model data provided by the desktop agent.
- No model names are hardcoded in the web app.
- If the list is not yet available, the selector shows a loading state.
- If list retrieval fails, the selector becomes unavailable but chat can still fall back to the agent default model.

## Architecture

## Model List Source

The desktop agent is responsible for discovering available models.

Source of truth:

- the same provider configuration and environment variables that the local Codex CLI already uses

Chosen strategy:

- agent startup prefetches model availability once
- agent can refresh on demand later, but that is not required for the first delivery

This avoids duplicating secrets in the server and keeps model availability device-specific.

## Data Flow

### Model List Sync

1. Agent starts.
2. Agent reads local Codex provider-related configuration and environment.
3. Agent requests the provider model list using those credentials.
4. Agent normalizes the response into a transport-safe schema:
   - `id`
   - `label`
   - `provider`
   - `available`
   - optional metadata such as `ownedBy`
5. Agent sends a realtime event to the server for device viewers.
6. Web stores the latest model list for the selected device.
7. Session composer reads from that cached realtime list.

### Send Path

1. User chooses a model in the composer.
2. Web posts `text`, optional `codexSessionId`, and optional `model` to the server session input route.
3. Server includes the chosen model in the realtime session input event.
4. Agent receives the event and forwards the model into Codex execution options.
5. `CodexAdapter` applies `--model <selected-model>` to `exec` or `exec resume`.

### Output Path

1. Web inserts a local pending assistant bubble before network completion.
2. Agent streams Codex JSON assistant content back through existing realtime.
3. Web binds streamed content to the pending assistant bubble for the active turn.
4. `codex.turn.completed` finalizes the bubble and clears loading.
5. `codex.turn.failed` finalizes the bubble with error text and clears loading.

## Protocol Changes

The shared realtime protocol needs new events and fields:

- `device.models.updated`
  - emitted by agent
  - broadcast to device viewers
  - contains normalized model list and optional default model

- `session.input`
  - add optional `model`

- HTTP `POST /sessions/:sessionId/input`
  - accept optional `model`

No database persistence is required for the model list in the first version.

## Agent Design

## Provider Model Discovery

The agent introduces a model discovery module responsible for:

- reading local Codex-compatible provider configuration
- building the upstream request
- parsing provider-specific model payloads into a normalized format

The first implementation should target the provider shape already in use by this machine. The adapter boundary should make it easy to add more providers later.

Suggested structure:

- `provider_models.rs`
  - config resolution
  - request logic
  - normalization

This keeps model discovery out of `codex_adapter.rs`, which should remain focused on process execution.

## Runtime Behavior

At agent startup:

1. Load settings and projects.
2. Start websocket connection.
3. Trigger async model discovery.
4. When ready, emit `device.models.updated`.

If discovery fails:

- do not fail the runtime
- emit a model update event with empty models and an error field, or emit a dedicated failure event if cleaner for the existing protocol

## Web Design

## State Model

The web app keeps per-device model state in memory:

- `models`
- `defaultModel`
- `modelsLoading`
- `modelsError`
- `selectedModelBySession`

The selected model should be session-scoped in the UI so a user can switch models per conversation without affecting all devices or all projects.

## Conversation Rendering

The existing output pipeline currently appends Codex chunks as separate bubbles. That must change for live turns.

New approach:

- keep history bubbles as immutable
- keep local user bubbles as immutable
- keep one mutable pending assistant bubble for the in-flight turn

This can be implemented by splitting rendered conversation into:

- historical messages
- local submitted messages
- current live turn state

The live turn state should own:

- `status`: `idle | waiting | streaming | failed | completed`
- `text`
- `errorMessage`
- `turnKey`

When streaming starts, update `text` on the active live turn instead of appending fresh assistant bubbles per chunk.

## Composer UI

The composer component should likely be split because `SessionConsole.tsx` is already carrying state, layout, realtime handling, and submit logic.

Recommended split:

- `SessionConsole.tsx`
  - orchestration and page layout
- `ChatComposer.tsx`
  - input panel layout and interactions
- `LiveTurnBubble.tsx`
  - waiting, streaming, timeout, and failure assistant bubble rendering

This keeps files below the user's size preference threshold and makes the state transitions easier to test.

## Server Design

The server remains a relay:

- accept optional `model` on session input
- validate and pass through
- no model storage
- no provider secret handling

It also needs to relay model update events from agent to device viewers.

## Error Handling

### Model List Failures

If model discovery fails:

- chat still works using provider default behavior
- selector displays unavailable state
- user can still send without manually selecting a model

### Chat Turn Failures

If Codex returns `turn.failed`:

- pending assistant bubble becomes a failed assistant bubble
- send button leaves loading state
- no extra top banner or composer error block appears

### Timeout Before Output

If the client timeout fires before first streamed assistant content:

- pending assistant bubble text changes to waiting/timeout copy
- bubble remains the assistant bubble for that turn
- send button behavior should follow existing strict one-turn locking rules unless a failure event or timeout policy explicitly releases it

The implementation should decide one timeout policy and make it explicit:

- recommended: timeout marks the live bubble as delayed but does not unlock until failure or completion arrives

This avoids accidental overlapping turns.

## Testing

### Shared

- schema tests for model update event
- schema tests for `session.input.model`

### Server

- route test for accepting `model` in session input
- realtime relay test for model update event to device viewers

### Agent

- provider model normalization tests
- session manager tests for forwarding selected model into execution options

### Web

- composer render tests for loading model selector
- conversation tests for preinserted live assistant bubble
- tests for chunk updates mutating one assistant bubble instead of appending many
- tests for `turn.failed` rendering inside the assistant bubble

## Implementation Plan Shape

The implementation should be broken into phases:

1. Shared protocol additions for model events and optional session model
2. Agent provider model discovery and startup sync
3. Server relay support for model updates and model passthrough
4. Web state for device model list
5. Composer redesign and model selector UI
6. Live assistant bubble refactor
7. Verification and cleanup

## Decisions

- Model list source: provider API, fetched by desktop agent
- Credentials source: reuse existing local Codex provider config and environment
- Fetch timing: prefetch at agent startup
- Selector location: inside composer footer only
- Waiting and failure presentation: inside assistant bubble only
- Send button state: loading during the whole active turn

## Open Questions Resolved

- No top-of-page model selector
- No hardcoded model names in web
- No separate provider credential form
- No database-backed model catalog
