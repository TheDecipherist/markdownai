# @markdownai/mcp

<p align="center">
  <a href="https://markdownai.dev">
    <img src="https://img.shields.io/badge/📖_Documentation-markdownai.dev-0891b2?style=for-the-badge&labelColor=08090f" alt="Documentation Site" />
  </a>
  &nbsp;
  <a href="https://markdownai.dev/user-guide.html">
    <img src="https://img.shields.io/badge/📚_User_Guide-Full_Reference-059669?style=for-the-badge&labelColor=08090f" alt="User Guide" />
  </a>
</p>

MCP (Model Context Protocol) server for MarkdownAI. Bridges AI assistants and live documents - intercepts file reads, resolves directives, serves phase-aware content, and delivers `@event` broadcasts through 10 tools AI tools can call directly.

**All packages:**
[@markdownai/core](https://www.npmjs.com/package/@markdownai/core) &nbsp;·&nbsp;
[@markdownai/engine](https://www.npmjs.com/package/@markdownai/engine) &nbsp;·&nbsp;
[@markdownai/parser](https://www.npmjs.com/package/@markdownai/parser) &nbsp;·&nbsp;
[@markdownai/renderer](https://www.npmjs.com/package/@markdownai/renderer) &nbsp;·&nbsp;
[@markdownai/mcp](https://www.npmjs.com/package/@markdownai/mcp) &nbsp;·&nbsp;
[@markdownai](https://www.npmjs.com/package/@markdownai/markdownai)

**Links:** [GitHub](https://github.com/TheDecipherist/markdownai) &nbsp;·&nbsp; [npm org](https://www.npmjs.com/package/@markdownai/markdownai)

---

## What it does

`@markdownai/mcp` solves the core problem of AI tools reading live documents: without it, an AI opens a `.md` file and sees raw source - directives, macro definitions, unexpanded expressions. With the MCP server configured, the AI receives fully rendered, up-to-date content every time it reads a MarkdownAI document.

The server implements the [Model Context Protocol](https://modelcontextprotocol.io) over stdio. It exposes 8 tools AI assistants can call to interact with documents, navigate phases, invoke macros, and manage cache state.

**Key capability - lazy phase loading.** For multi-phase documents (workflows, runbooks, multi-step guides), the server loads only the currently active phase into AI context. A 20-phase document doesn't flood the AI with everything at once - the AI works through phases in sequence, requesting each one as needed.

## Installation

```bash
npm install -g @markdownai/core
```

This installs the `mai` CLI and the `mai-serve` binary, which is what your AI client will use as the MCP server process.

## Setup with Claude Code

You don't start the server manually. Claude Code starts it automatically when you open a session, based on the configuration you add once.

The easiest way is `mai init`, which writes the config for you:

```bash
mai init
```

Or add it manually to your project's `.claude/settings.json` (or your global Claude Code settings):

```json
{
  "mcpServers": {
    "markdownai": {
      "command": "mai-serve",
      "args": []
    }
  }
}
```

That's it. Claude Code reads this config on startup, launches `mai-serve` as a subprocess, and connects to it over stdio. From that point on, every `.md` file with a `@markdownai` header that Claude reads is automatically rendered before Claude sees it - no manual steps needed per session.

To scope the server to a specific project directory, add `--cwd`:

```json
{
  "mcpServers": {
    "markdownai": {
      "command": "mai-serve",
      "args": ["--cwd", "/path/to/your/project"]
    }
  }
}
```

To pass plain markdown files through the engine unchanged (instead of returning raw source), add `--passthrough`. This is useful when you want `@event` logging or directive tracing to cover all files in a directory, not just MarkdownAI documents:

```json
{
  "mcpServers": {
    "markdownai": {
      "command": "mai-serve",
      "args": ["--passthrough"]
    }
  }
}
```

To enable developer tracing, add a `MARKDOWNAI_TRACE` env var to the server config:

```json
{
  "mcpServers": {
    "markdownai": {
      "command": "mai-serve",
      "args": [],
      "env": {
        "MARKDOWNAI_TRACE": "file:/tmp/markdownai.jsonl"
      }
    }
  }
}
```

Trace output is JSON-Lines: one span per line, written for every directive the engine executes. All directive args are masked before serialization. See `@markdownai/engine` for the full span format.

## The 10 MCP tools

Once the server is configured, Claude can call these tools directly during a session.

### `read_file`

Reads and renders a MarkdownAI document, resolving all directives. Returns the same output you'd get from `mai render`.

```json
{
  "name": "read_file",
  "arguments": {
    "path": "./docs/status.md"
  }
}
```

Optional `budget` parameter (in tokens) enables AI-format compression - drops low-priority sections to fit within the limit.

```json
{
  "name": "read_file",
  "arguments": {
    "path": "./docs/status.md",
    "budget": 4000
  }
}
```

---

### `list_phases`

Lists all phases defined in a document and their transitions.

```json
{
  "name": "list_phases",
  "arguments": {
    "file": "./runbooks/deploy.md"
  }
}
```

Returns an array like:
```json
[
  { "name": "preflight", "transitions": ["deploy"] },
  { "name": "deploy", "transitions": ["verify", "@call notify_team"] },
  { "name": "verify", "transitions": [] }
]
```

---

### `resolve_phase`

Renders the content of a specific named phase, running all its directives.

```json
{
  "name": "resolve_phase",
  "arguments": {
    "file": "./runbooks/deploy.md",
    "phase": "preflight"
  }
}
```

---

### `next_phase`

Returns the name of the phase that follows the given phase, or `null` if it's the last one. Used to walk through a multi-phase document step by step.

```json
{
  "name": "next_phase",
  "arguments": {
    "file": "./runbooks/deploy.md",
    "phase": "preflight"
  }
}
// returns: "deploy"
```

---

### `call_macro`

Invokes a named macro defined in a document, with optional arguments.

```json
{
  "name": "call_macro",
  "arguments": {
    "file": "./report-template.md",
    "macro": "summary-block",
    "args": { "period": "Q1 2026", "format": "concise" }
  }
}
```

---

### `get_env`

Retrieves an environment variable value, with an optional fallback.

```json
{
  "name": "get_env",
  "arguments": {
    "key": "DATABASE_URL",
    "fallback": "postgres://localhost:5432/dev"
  }
}
```

Keys matching credential patterns (`PASSWORD`, `SECRET`, `TOKEN`, `API_KEY`, etc.) are blocked - the tool returns an error rather than exposing sensitive values.

---

### `execute_directive`

Runs a single MarkdownAI directive and returns its output. Useful for ad-hoc queries during a session.

```json
{
  "name": "execute_directive",
  "arguments": {
    "directive": "@query \"git log --oneline -5\""
  }
}
```

Security rules apply exactly as they do during a full render - the directive must pass the shell allowlist, HTTP domain allowlist, or database jail before it executes.

`@event` directives with `transport='mcp'` are supported. Events fired to the `mcp` transport appear in the tool's `events` array in the response, alongside the rendered `output`:

```json
{
  "name": "execute_directive",
  "arguments": {
    "directive": "@event name='status' data='{\"step\":1}' transport='mcp'"
  }
}
// response includes:
// { "output": "", "events": [{ "name": "status", "data": "{\"step\":1}", "meta": { ... } }] }
```

---

### `invalidate_cache`

Clears cached rendered output for a specific file, or for all files if no path is given.

```json
{
  "name": "invalidate_cache",
  "arguments": {
    "file": "./docs/live-metrics.md"
  }
}
```

```json
{
  "name": "invalidate_cache",
  "arguments": {}
}
```

---

### `get_constraints`

Returns the `@constraint` declarations in a document without rendering the rest of the file. Use this when you want the rules without paying the token cost of the full document.

```json
{
  "name": "get_constraints",
  "arguments": {
    "filePath": "./docs/security-policy.md",
    "cwd": "/path/to/project"
  }
}
```

Returns `{ constraints: Array<{ id, severity, body }>, isMarkdownAI: boolean }`.

---

### `available_directives`

Returns the complete catalog of directives registered in the parser - name, whether it is a block directive, and optional close-tag. Useful for AI tools that need to know what syntax is valid without hallucinating directive names.

```json
{
  "name": "available_directives",
  "arguments": {}
}
```

Pass `include_plugin_directives: false` to exclude directives that are only valid inside plugin files (`@plugin-meta`, `@plugin-detect`, `@plugin-layout`, `@plugin-conventions`):

```json
{
  "name": "available_directives",
  "arguments": {
    "include_plugin_directives": false
  }
}
```

Returns `{ directives: Array<{ name, block, closeTag? }>, count: number }`.

## Companion Hooks (v1.0+)

The MCP server is one of three pieces in the AI-integration stack. The other two are Claude Code hooks installed by `mai init`:

**PreToolUse hook** intercepts direct `Read` of any MarkdownAI document (bare `@markdownai` header OR YAML frontmatter then `@markdownai`) and returns a redirect message that contains the full catalogue of these 10 MCP tools - including arg shapes, return shapes, and a 5-step workflow. The AI never reads raw directive syntax; it's pushed back to the MCP every time.

**SessionStart hook** runs at every Claude Code session start (and on `resume` / `clear` / `compact`). If the project root has a `CLAUDE-MarkdownAI.md` file, the hook renders it via `mai render` and emits a JSON envelope on stdout:

```json
{
  "hookSpecificOutput": {
    "hookEventName": "SessionStart",
    "additionalContext": "<rendered markdown>"
  }
}
```

Claude Code injects `additionalContext` into the session with the same authority as `CLAUDE.md`. The render lives only in conversation context for that session - no file is written. Your `CLAUDE.md` is never modified.

The pattern: keep `CLAUDE.md` as static, user-owned project rules. Put live data (today's date, current branch, open features, last test result) into `CLAUDE-MarkdownAI.md` using flat MarkdownAI directives. Every new session starts with a fresh render of that file in context.

> **Note for AI-tool authors:** if the AI gets a `Read` blocked on `CLAUDE-MarkdownAI.md` mid-session, the rendered content is already in the session context (from the SessionStart hook). The redirect message points back to that context and provides the exact `read_file` MCP call for a fresh fetch.

## Security at the MCP boundary

The server enforces the same security rules as the CLI:

- **File access** - only files within the project's document root can be read. Path traversal attempts (`../../../etc/passwd`) are rejected.
- **Environment variables** - keys matching credential patterns are blocked in `get_env` responses.
- **Directives** - `execute_directive` calls run through the full security jail. Shell-injection sequences are blocked.
- **Event transports** - `@event` dispatch is deny-all by default. The server's security config must include `allowed_transports` for any transport to fire. Data masking is unconditional - secrets in event payloads are replaced with `***MASKED***` before any transport receives them.
- **Server resilience** - a bad request never crashes the server. The server recovers and keeps running.

## API Reference (library usage)

If you're building your own MCP server or tooling on top of this package:

### `startServer(options?): Promise<void>`

Starts the MCP stdio server. Blocks until the client disconnects.

```ts
import { startServer } from '@markdownai/mcp'

await startServer({
  cwd: process.cwd(),
  passthrough: false,  // set true to pass plain .md files through the engine
})
```

### Individual tools

Each tool is exported as a standalone function:

```ts
import {
  readFile,
  listPhases,
  resolvePhase,
  nextPhase,
  callMacro,
  getEnv,
  executeDirective,
  invalidateCache,
  availableDirectives,
} from '@markdownai/mcp'

const rendered = await readFile({ path: './docs/status.md' })
const phases = await listPhases({ file: './runbook.md' })
```

### Connection registry

The server maintains a session-level connection registry so database connections are established once and reused across all tool calls.

```ts
import { registerConnection, getConnection, listConnections, clearConnections } from '@markdownai/mcp'

registerConnection('reports', { type: 'mongodb', uri: process.env.MONGODB_URI })

const conn = getConnection('reports')
clearConnections()  // closes all connections
```

## TypeScript

```ts
import type { ServerOptions } from '@markdownai/mcp'
```

## Part of the MarkdownAI toolchain

- **Parse documents** - use [`@markdownai/parser`](https://www.npmjs.com/package/@markdownai/parser)
- **Execute directives** - use [`@markdownai/engine`](https://www.npmjs.com/package/@markdownai/engine)
- **Format output** - use [`@markdownai/renderer`](https://www.npmjs.com/package/@markdownai/renderer)
- **Run from the CLI** - install [`@markdownai/core`](https://www.npmjs.com/package/@markdownai/core) globally

## License

MIT - [GitHub](https://github.com/TheDecipherist/markdownai)
