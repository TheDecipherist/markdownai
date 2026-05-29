# @markdownai/mcp

Model Context Protocol server for MarkdownAI. JSON-RPC over stdio. 11 tools that let an MCP client (Claude Code, etc.) read, render, and walk MarkdownAI documents.

[Root README](../../README.md) · [Engine](../engine/README.md) · [GitHub](https://github.com/TheDecipherist/markdownai)

## Install

```bash
npm install -g @markdownai/core    # installs both the CLI and mai-serve
```

Then point your MCP client at `mai-serve`. With Claude Code, run `mai init` to write the config, or add it manually:

```json
{
  "mcpServers": {
    "markdownai": { "command": "mai-serve", "args": [] }
  }
}
```

## The 11 tools

| Tool | What it does |
|---|---|
| `read_file` | Render a document, optionally scoped to one phase. Returns ai-format by default. |
| `render` | Alias of `read_file` with the parameter renamed `path` -> `file` (consistent with the other tools). |
| `list_phases` | Inventory of `@phase` blocks. |
| `resolve_phase` | Render one phase. Returns `{ content, nextPhase }` - `nextPhase` reflects the `@on-complete` that fired (honors `@if` / `@switch`). |
| `next_phase` | Get the next phase after a given one. Renders the phase with skill context so conditional transitions resolve correctly. |
| `call_macro` | Invoke a `@define`-d macro by name with args. |
| `execute_directive` | Run a single directive. Allowlist: `@env`, `@date`, `@count`, `@list`, `@read`, `@read-frontmatter`, `@hash`, `@if`, `@markdownai-detect`, `@plugin-data`. |
| `get_constraints` | Extract `@constraint` declarations from a document. |
| `get_env` | Read an env var through the security gate (credential-pattern keys are blocked). |
| `invalidate_cache` | Drop cached directive output. |
| `available_directives` | Catalog every registered directive. As of 1.3.0 this includes `@template` and `@data` (for reusable partials with bound data). They are deliberately NOT on the `execute_directive` allowlist - both can transitively invoke other directives, so they remain available only through the full document-rendering tools (`read_file`, `render`, `resolve_phase`, `next_phase`). |

## Session state (v2)

The server keys per-`(session × document)` state by `skill_session_id`. `@set` values written in one phase persist into later `resolve_phase` calls on the same document. Required for multi-phase flows (mdd2 build, audit, etc.) where phase 5 needs values bound back in phase 1.

Thread `skill_args` + `skill_session_id` on **every** `resolve_phase` / `next_phase` call in a multi-phase flow. Also useful: `skill_named_args`, `skill_effort`, `skill_dir`. They bind to `$ARGUMENTS`, `argsList`, `arg0..argN`, `CLAUDE_EFFORT`, and `CLAUDE_SKILL_DIR` inside the document.

## Multi-phase walk

```
1. list_phases  { file: "flow.md" }
   -> ["setup", "build", "verify"]

2. resolve_phase  { file: "flow.md", phase: "setup",
                   skill_args: "auth", skill_session_id: "<uuid>" }
   -> { content: "...", nextPhase: "build" }

3. next_phase    { file: "flow.md", current_phase: "build",
                   skill_session_id: "<uuid>" }
   -> "verify"

4. resolve_phase { file: "flow.md", phase: "verify",
                   skill_session_id: "<uuid>" }   # @set values from setup still bound
   -> { content: "...", nextPhase: null }
```

## Companion hooks

`mai init` installs two Claude Code hooks:

- **PreToolUse** - intercepts `Read` on any MarkdownAI document and redirects the AI back to the MCP tool catalog. Raw directive source never reaches the model.
- **SessionStart** - if `CLAUDE-MarkdownAI.md` exists at the project root, the hook renders it on every session start and injects the output into session context with the same authority as `CLAUDE.md`. Your `CLAUDE.md` is not modified.

## Public surface

The MCP server is the product. Library entry points exist if you're embedding it:

```ts
import { startServer } from '@markdownai/mcp'
import type { ServerOptions } from '@markdownai/mcp'

startServer({ cwd: process.cwd(), passthrough: false })
```

## License

MIT.
