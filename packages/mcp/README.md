# @markdownai/mcp

MCP (Model Context Protocol) server for MarkdownAI. Bridges AI assistants and live documents - intercepts file reads, resolves directives, and serves phase-aware content through 8 tools AI tools can call directly.

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

`@markdownai/mcp` solves the core problem of AI tools reading live documents: without it, an AI opens a `.md` file and sees raw source - directives, macro definitions, unexpanded expressions. With the MCP server running, the AI receives fully rendered, up-to-date content every time it reads a MarkdownAI document.

The server implements the [Model Context Protocol](https://modelcontextprotocol.io) over stdio. It exposes 8 tools AI assistants can call to interact with documents, navigate phases, invoke macros, and manage cache state.

**Key capability - lazy phase loading.** For multi-phase documents (workflows, runbooks, multi-step guides), the server loads only the currently active phase into AI context. A 20-phase document doesn't flood the AI with everything at once - the AI works through phases in sequence, requesting each one as needed.

## Installation

```bash
# As a CLI (runs the MCP server)
npm install -g @markdownai/core
mai serve

# As a library
npm install @markdownai/mcp
```

## Using with Claude Code

The recommended setup is via `mai init`, which installs the PreToolUse hook automatically:

```bash
mai init
```

This configures Claude Code to route all MarkdownAI document reads through the MCP server. After setup, every `.md` file with a `@markdownai` header that Claude reads is automatically rendered before Claude sees it.

For manual setup, configure the MCP server in your `.claude/settings.json`:

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

## Starting the server

```bash
# Start in the current directory
mai-serve

# Or via the mai CLI
mai serve

# With a specific project root
mai serve --cwd /path/to/project
```

The server communicates over stdio (stdin/stdout) using JSON-RPC, which is the standard MCP transport.

## The 8 MCP tools

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

## Security at the MCP boundary

The MCP server enforces the same security rules as the CLI:

- **File access** - only files within the project's document root can be read. Path traversal attempts (`../../../etc/passwd`) are rejected.
- **Environment variables** - keys matching credential patterns are blocked in `get_env` responses.
- **Directives** - `execute_directive` calls run through the full security jail. Shell-injection sequences are blocked.
- **Server resilience** - a bad request never crashes the server. The server recovers and keeps running.

## API Reference (library usage)

### `startServer(options?): Promise<void>`

Starts the MCP stdio server. Blocks until the client disconnects.

```ts
import { startServer } from '@markdownai/mcp'

await startServer({
  cwd: process.cwd(),
  port: undefined,  // stdio mode (default)
})
```

### Individual tools

Each tool is also exported as a standalone function for use outside the MCP protocol:

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
} from '@markdownai/mcp'

// Use directly in your own MCP server or tool
const rendered = await readFile({ path: './docs/status.md' })
const phases = await listPhases({ file: './runbook.md' })
```

### Connection registry

The MCP server maintains a session-level connection registry so database connections are established once and reused across all tool calls.

```ts
import { registerConnection, getConnection, listConnections, clearConnections } from '@markdownai/mcp'

registerConnection('reports', { type: 'mongodb', uri: process.env.MONGODB_URI })

const conn = getConnection('reports')
const all = listConnections()

clearConnections()  // closes all connections and clears the registry
```

## TypeScript

```ts
import type { ServerOptions } from '@markdownai/mcp'

const opts: ServerOptions = {
  cwd: '/path/to/project',
}
```

## Part of the MarkdownAI toolchain

- **Parse documents** - use [`@markdownai/parser`](https://www.npmjs.com/package/@markdownai/parser)
- **Execute directives** - use [`@markdownai/engine`](https://www.npmjs.com/package/@markdownai/engine)
- **Format output** - use [`@markdownai/renderer`](https://www.npmjs.com/package/@markdownai/renderer)
- **Run from the CLI** - install [`@markdownai/core`](https://www.npmjs.com/package/@markdownai/core) globally

## License

MIT - [GitHub](https://github.com/TheDecipherist/markdownai)
