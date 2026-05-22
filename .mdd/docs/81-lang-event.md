---
id: 81-lang-event
title: Language — @event Directive (Transport-Based Event Broadcast)
edition: Both
depends_on: [03-engine, 21-lang-phases, 22-security-config, 23-security-filesystem, 27-security-immutable-rules, 30-mcp-server]
source_files:
  - packages/parser/src/args.ts
  - packages/parser/src/directives/event.ts
  - packages/parser/src/types.ts
  - packages/engine/src/event.ts
  - packages/engine/src/transports/index.ts
  - packages/engine/src/transports/dispatch-worker.ts
  - packages/engine/src/transports/log.ts
  - packages/engine/src/transports/mcp.ts
  - packages/engine/src/transports/vscode.ts
  - packages/engine/src/transports/websocket.ts
  - packages/engine/src/transports/file.ts
  - packages/engine/src/transports/http.ts
  - packages/engine/src/transports/db.ts
  - packages/engine/src/context.ts
  - packages/engine/src/engine.ts
  - packages/mcp/src/tools/execute_directive.ts
  - packages/vscode/src/completion-provider.ts
  - README.md
  - packages/core/README.md
routes: []
models: []
test_files:
  - packages/parser/src/__tests__/event.test.ts
  - packages/engine/src/__tests__/event.test.ts
  - packages/engine/src/__tests__/event-transports.test.ts
data_flow: greenfield
last_synced: 2026-05-22
status: complete
phase: complete
mdd_version: 1.8.7
tags: [event, directive, transport, broadcast, progress, logging, mcp, vscode, signal]
path: Language/Event
integration_contracts: []
satisfies_contracts:
  - from: 23-security-filesystem
    function: applyMasking(value, config)
    when: before any transport dispatch in executeEvent()
    status: done
    verified_at: "2026-05-22"
  - from: 27-security-immutable-rules
    function: applyImmutableRules(content)
    when: before masking, to catch always_alert patterns in the resolved value
    status: done
    verified_at: "2026-05-22"
known_issues: []
security_read_sites: []
---

# 81 — Language — @event Directive (Transport-Based Event Broadcast)

## Purpose

`@event` is a single-line directive that fires a named signal with a value when the engine processes it during document rendering. Signals are delivered simultaneously to one or more transports - pluggable output channels modeled after Winston's transport system. Built-in transports cover the most common targets (VS Code status bar, MCP clients, log, WebSocket, file, HTTP, database), and custom transports can be registered via config for anything else.

Documents use this for progress indicators, live status updates, structured logging, and any "push a value somewhere at this point in rendering" use case.

## Syntax

```
@event name='<event-name>' data='<string-or-json>' transport='<transport1>,<transport2>'
@event name='<event-name>' data='<string-or-json>' transport='<transport>' visible
```

**Parameters:**

| Parameter | Required | Description |
|-----------|----------|-------------|
| `name` | yes | Event name - identifies what happened (e.g. `phase-complete`, `progress`, `status`) |
| `data` | yes | The payload. Plain string for simple signals; JSON object string for structured data (recommended for anything with more than one field) |
| `transport` | no | Comma-separated transport names. Defaults to `log` if omitted |
| `visible` | no | Flag (no value). When present, renders the event as a blockquote in the output document |

### data: plain string vs JSON object

Both forms are valid. JSON is encouraged whenever you want to send more than one piece of information at once:

```markdown
@markdownai v1.0

// Plain string - fine for simple signals
@event name='phase-done' data='setup' transport='log'

// JSON object - encouraged for structured data
@event name='progress' data='{"step": 2, "total": 5, "label": "Loading config"}' transport='vscode,log'
@event name='build-status' data='{"status": "running", "startedAt": "{{ date }}"}' transport='mcp,websocket'
@event name='row-saved' data='{"id": "{{ row.id }}", "collection": "users"}' transport='log,file'
```

`{{ expression }}` in `data` is only evaluated when `allow_env_interpolation: true` is set in the security config. By default it is off - the `data` string is dispatched literally. Transports receive `data` as a raw string. It is up to each transport (and the consuming listener) to parse it. The `mcp` transport passes it through as-is; the VS Code transport attempts to JSON-parse it for richer status bar display but falls back to the raw string if parsing fails.

**JSON data and masking:** `applyMasking()` runs on the full JSON string before dispatch. A secret embedded in a JSON property (`"token": "ghp_..."`) is caught and replaced just as it would be in a plain string.

## Architecture

The event system has three layers:

```
Document
  └── @event name=... data=... transport=...
        │
        ▼ (parser)
      EventNode { name, data, transports: string[], visible }
        │
        ▼ (engine walkNode — synchronous, never blocks)
      executeEvent(node, ctx)
        │
        ├── 1. resolve data (if allow_env_interpolation: true)
        ├── 2. applyMasking() on data
        ├── 3. truncate if > max_value_length
        ├── 4. build EventMeta { datetime, line, runId, sessionId, model, tokenUsage, git, callstack }
        ├── 5. build EngineEvent { name, data, document, phase, timestamp, meta }
        │
        ├──▶ [inline] McpTransport
        │      pushes to ctx.events[] immediately
        │      returned in EngineResult — zero overhead
        │
        └──▶ [postMessage] EventDispatchWorker (node:worker_threads)
               worker is lazily created on first @event, unref()'d
               main thread returns immediately — no waiting
               │
               ├──▶ LogTransport      → stderr
               ├──▶ VscodeTransport   → /tmp/markdownai-events-<sessionId>.json
               ├──▶ WebsocketTransport → connected ws:// clients
               ├──▶ FileTransport     → configured file path
               ├──▶ HttpTransport     → POST to configured URL (domain jailed)
               ├──▶ DbTransport       → configured collection (security jailed)
               └──▶ CustomTransport   → user-defined (http | file | db type only)
```

### Why two paths

`mcp` is inline because it writes to `ctx.events[]`, which must be populated before `execute()` returns — that data goes directly into the `EngineResult` the caller reads. There is no I/O involved, so no worker is needed.

Every other transport does I/O (stderr, filesystem, network, database). Putting them in a worker means HTTP timeouts, DB latency, slow file writes, and WebSocket backpressure are completely invisible to document rendering time. A document with twenty `@event` directives renders in exactly the same time as one with none.

### EngineEvent shape

Every `@event` dispatch automatically includes a `meta` object with contextual debugging information. This is generated by the engine at dispatch time and requires no author configuration.

```typescript
interface EventMeta {
  datetime: string                          // ISO 8601 timestamp (from Date.now())
  line: number                              // line number of @event in the source .md file
  runId: string                             // UUID for this execute() invocation
  sessionId: string | null                  // MCP session ID, or null
  model: string | null                      // AI model name (injected by caller, e.g. MCP server)
  tokenUsage: number | null                 // token count at dispatch time (injected by caller)
  git: { hash: string; short: string } | null  // git commit info at execute() start, or null
  callstack: string[]                       // execution context path (e.g. ["phase:setup", "call:myMacro"])
}

interface EngineEvent {
  name: string
  data: string             // raw string or JSON string (always masked before set)
  transport: string        // which transport this copy was routed to
  document: string         // filepath of the source document
  phase: string | null     // active phase name filter, if any
  timestamp: number        // Date.now()
  meta: EventMeta          // automatically populated debugging context
}
```

The `callstack` field tracks which `@phase` blocks and `@call` macro invocations the event was fired from, as a path from outermost to innermost. For example, an event inside `@phase setup` which was itself called from a macro yields `["phase:setup", "call:initMacro"]`.

The `git` hash is resolved once at `execute()` start via `git log -1 --format=%H %h`. If the document is not in a git repo, or git is unavailable, `git` is `null`. Resolution is fast and cached for the duration of the execution.

`model` and `tokenUsage` are set by the calling layer (e.g., the MCP server) via `ctx.model` and `ctx.tokenUsage`. The engine itself does not know the AI model or token count - those are runtime concerns of the host.

### EngineContext additions

```typescript
interface EngineContext {
  // ... existing fields ...
  events: EngineEvent[]                        // accumulated during execution, flushed to EngineResult
  runId: string                                // UUID generated at execute() start
  gitMeta: { hash: string; short: string } | null  // resolved once at execute() start
  model: string | null                         // AI model name (set by caller, default null)
  tokenUsage: number | null                    // token count (set by caller, default null)
  callstack: string[]                          // live execution context stack
}
```

### EngineResult additions

```typescript
interface EngineResult {
  output: string
  warnings: string[]
  errors: string[]
  events: EngineEvent[]    // all events fired during this execution
}
```

## Transport System

### Built-in transports

| Transport name | What it does |
|---------------|--------------|
| `log` | Writes a structured line to stderr: `[event] name=<name> data=<data>` |
| `mcp` | Accumulates event in `ctx.events[]` - returned in the MCP tool response |
| `vscode` | Writes event JSON to a temp file (`/tmp/markdownai-events-<sessionId>.json`). VS Code extension polls this file and updates the status bar |
| `websocket` | Pushes JSON event to all connected WebSocket clients (requires active `mai serve` session) |
| `file` | Appends JSON event to the path configured in `event.transports.file.path` |
| `http` | POSTs JSON event to the URL configured in `event.transports.http.url` (domain jailed by security config) |
| `db` | Inserts event document into the collection configured in `event.transports.db.connection` and `event.transports.db.collection` (requires allowed connection) |

### Custom transports

Register a custom transport in `.markdownai.json`:

```json
{
  "event": {
    "allowed_transports": ["log", "my-transport"],
    "max_value_length": 200,
    "onError": "silence",
    "transports": {
      "my-transport": {
        "type": "http",
        "url": "https://hooks.example.com/markdownai",
        "headers": { "Authorization": "Bearer ${MY_TOKEN}" }
      }
    }
  }
}
```

The `type` for custom transports must be one of the built-in types (`http`, `file`, `db`). This prevents arbitrary code execution.

**Default config (no `.markdownai.json`):**
```json
{
  "event": {
    "allowed_transports": [],
    "allow_env_interpolation": false,
    "max_value_length": 500,
    "onError": "silence"
  }
}
```

With these defaults, all @event directives are no-ops and `{{ expression }}` syntax in `data` is never evaluated. No events leave the engine and no env vars can be referenced.

### TypeScript interface

```typescript
export interface EventTransportConfig {
  type: 'http' | 'file' | 'db'
  // http:
  url?: string
  headers?: Record<string, string>
  // file:
  path?: string
  // db:
  connection?: string
  collection?: string
}

export interface EventSecurityConfig {
  allowed_transports: string[]            // names of allowed transports; default []
  allow_env_interpolation: boolean        // whether {{ expressions }} in data are evaluated; default false
  max_value_length: number                // max chars after masking; default 500, max 500
  onError: 'silence' | 'warn' | 'fail'   // default 'silence'
  transports?: Record<string, EventTransportConfig>  // custom transport definitions
}
```

### Error handling

Controlled by `event.onError` in config:

| Setting | Behavior |
|---------|---------|
| `silence` (default) | Transport failures are ignored completely |
| `warn` | Transport failures write a line to stderr (worker cannot reach ctx.warnings) |
| `fail` | **Not supported for external transports.** Degrades to `warn` with a one-time stderr notice. External dispatches are fire-and-forget — `execute()` has already returned before the worker knows a transport failed. |

Transport-not-in-allowlist is caught in the main thread (before posting to the worker) and handled per `onError` — for `fail`, this case does throw before `execute()` returns, since the allowlist check is synchronous.

`warn` for worker-dispatched transports writes to stderr rather than `ctx.warnings[]` because the main thread has already returned by the time the worker processes the failure. This is a known and intentional limitation of the fire-and-forget design.

### Multiple transports

When `transport='a,b,c'` is specified, all three fire simultaneously. Errors in one transport do not affect the others (under `silence` or `warn` mode).

## Visible Output

Without `visible`, @event produces no output in the rendered document - it is a pure side effect.

With `visible`, it renders as a blockquote. If the value is valid JSON, it is pretty-printed; otherwise it renders as a plain string:

```
> **event** `progress`
> ```json
> { "step": 2, "total": 5, "label": "Loading config" }
> ```

> **event** `phase-done` - setup

The rendered format is fixed - the visible flag is on/off with no format customization. This keeps the directive simple and prevents visible events from becoming a documentation feature (use @note for that).

## Business Rules

1. `name` and `data` are required. Missing either throws a `ParseError`. `data` accepts any string; a JSON object string is the recommended form when sending more than one piece of data.
2. `transport` defaults to `log` if omitted - but `log` still needs to be in `allowed_transports` to fire.
3. Transport names are lowercased and trimmed. Transport not in `allowed_transports` → handled per `onError`.
4. `applyMasking()` runs on every resolved `data` string before dispatch. This rule is unconditional and immutable.
5. `data` strings exceeding `max_value_length` (default 500) are truncated and a warning is added.
6. Multiple transports fire in parallel - order of delivery is not guaranteed.
7. Events accumulate in `ctx.events[]` in execution order (deterministic within a single document).
8. @event is valid inside @phase blocks, @define blocks, and @if branches. It fires at the point in execution where it is encountered.
9. `{{ expression }}` in `data` is only evaluated when `allow_env_interpolation: true` in config. Default is `false` — the raw string is dispatched as written.
10. If `mai strip` is run, @event lines are removed entirely (no visible side effects in stripped output).
11. Default config = all transports disabled. A document with @event directives and no config is always a no-op.
12. The `EventDispatchWorker` is lazily created on the first @event that has at least one allowlisted external transport. It is `unref()`'d immediately so it never prevents the Node process from exiting.
13. `onError: 'fail'` only throws synchronously for the allowlist check (main thread). It cannot halt rendering for a worker-dispatched transport failure — it degrades to `warn` in that case.

## Data Flow

Greenfield - no existing data fields are consumed or transformed. @event introduces new data that flows from EventNode → EngineEvent → transports and EngineResult. No existing data paths are modified.

## Dependencies

- **03-engine** - walkNode execution and EngineContext/EngineResult types
- **21-lang-phases** - @event fires inside @phase blocks; phase name is included in EngineEvent
- **22-security-config** - HTTP and DB transports are jailed by existing security config; config file extended with `event` section
- **30-mcp-server** - MCP transport accumulates in ctx.events[]; execute_directive tool result extended with `events` field

## Security

### Transport allowlist: deny all by default

**No transport fires unless it is explicitly listed in `event.allowed_transports` in the security config.** This is the security floor - it cannot be overridden by directive syntax.

If a directive names a transport that is not in the allowlist, the behavior follows `event.onError` (`silence` by default). The transport is not enabled on-the-fly.

```json
{
  "event": {
    "allowed_transports": ["log", "mcp"],
    "onError": "silence"
  }
}
```

The empty case (`allowed_transports: []`) is the default. With an empty list, every @event directive is a no-op. Documents run normally - they just don't deliver events anywhere.

### Expression interpolation gate: off by default

`allow_env_interpolation` in the security config controls whether `{{ expression }}` syntax inside `data` is evaluated at all. It defaults to `false`.

When `false` (default): the `data` string is treated as a literal and dispatched as written. `{{ env.STRIPE_KEY }}` reaches the transport as the string `{{ env.STRIPE_KEY }}` — the env var is never touched. This is the safest mode and requires no masking to protect against env var leakage, because resolution never happens.

When `true`: expressions are evaluated before masking runs. This is an explicit opt-in that teams enable only when they need dynamic data in events (e.g. `{{ date }}`, `{{ phase }}`).

### Value masking: unconditional and immutable

`applyMasking()` from `packages/engine/src/security/masking.ts` runs on the `data` string before any transport dispatch, regardless of whether interpolation was enabled. **This cannot be disabled or bypassed** — there is no `allow_unmasked` escape hatch for events.

The 14 built-in patterns cover bearer tokens, API keys, passwords, AWS keys, GitHub tokens, Stripe keys, JWTs, private key PEM blocks, MongoDB/Postgres URIs, and similar secrets. User-defined patterns from `filesystem.user_masking_patterns` also apply.

Execution order:
1. Check `allow_env_interpolation`:
   - `false` (default): skip expression evaluation entirely — use raw `data` string as-is
   - `true`: evaluate `{{ expression }}` — resolve to final string
2. `applyMasking()` applied to the data string (catches anything in plain text or any resolved expression)
3. If masking fires: SECURITY_ALERT emitted, masked string continues to transports
4. Masked string dispatched to each allowlisted transport

With both defaults active (`allow_env_interpolation: false` + empty `allowed_transports`), there is no path for env vars or secrets to leave the engine via @event, even if a document author attempts it. Either the transport is not allowlisted (no-op) or interpolation is off (env var never resolved).

### Value length cap

Event values are capped at 500 characters after masking. Values over this limit are truncated to 500 characters and a warning is added to `ctx.warnings[]`. This prevents large document chunks from being exfiltrated via transport payloads.

The cap is not configurable upward - only downward via `event.max_value_length` (minimum: 1, maximum: 500, default: 500).

### Audit logging for external transports

HTTP, DB, WebSocket, and file transport dispatches write a line to the audit log. The log entry contains only the masked data, never the raw value:

```
[event-dispatch] transport=http name=<name> data=<masked> document=<path> ts=<timestamp>
```

Internal transports (`log`, `mcp`) do not write to the audit log.

### Per-transport additional controls

Even when a transport is in the allowlist, its existing security controls remain enforced:

| Transport | Additional control |
|-----------|-------------------|
| `http` | Domain must be in `http.allowed_domains`. POST body contains only masked value. |
| `db` | Connection must already be declared via @connect. Collection must be in `db.allowed_collections` for that connection. |
| `file` | Path must be absolute. Must not be inside the document root (confinement check). |
| `websocket` | Only pushes to clients already connected to an active `mai serve` session. |
| `vscode` | Writes to `/tmp/markdownai-events-<sessionId>.json` - isolated to temp dir. |

### Custom transport security

Custom transports defined in config must specify `type` as one of the built-in types. This means they inherit the built-in type's security controls - an HTTP-backed custom transport is still domain-jailed; a DB-backed one still requires an existing connection.

Arbitrary code, module paths, and shell commands cannot be registered as transport handlers.

### MCP boundary

@event is added to `ALLOWED_DIRECTIVES` in `execute_directive.ts`. The directive caller cannot override `allowed_transports` - transport config comes from the config file only, not from the directive string.

### What a malicious document could still attempt (residual risks)

After all the above controls:
- **DNS oracle via HTTP domain check:** A document could use an allowlisted domain to signal "did rendering reach this point?" via a 1-byte request. Mitigated by requiring explicit domain allowlisting - only domains with a legitimate reason should ever appear in the allowlist.
- **Volume-based timing:** Many @event directives targeting file transport could create a large log file. Mitigated by value length cap, but not by rate limiting (not implemented in v1).
- **Value inference from MASKED sentinel:** A transport receiving `***MASKED***` knows a secret was present in the value. This is expected and acceptable - the transport learns the event happened but not the secret content.

### Input boundary

`name`, `value`, and `transport` come from the document author, not from external/MCP callers. MCP callers invoking `execute_directive` with an @event directive are still subject to the config-file `allowed_transports` list and value masking - there is no MCP-specific override.

## Known Issues

(none yet)

## Bugs

(none yet - populated by /mdd bug when issues are reported)
