# @markdownai

<p align="center">
  <a href="https://markdownai.dev">
    <img src="https://img.shields.io/badge/📖_Documentation-markdownai.dev-0891b2?style=for-the-badge&labelColor=08090f" alt="Documentation Site" />
  </a>
  &nbsp;
  <a href="https://markdownai.dev/user-guide.html">
    <img src="https://img.shields.io/badge/📚_User_Guide-Full_Reference-059669?style=for-the-badge&labelColor=08090f" alt="User Guide" />
  </a>
</p>

**documentation that cannot lie.**

**Packages:**
[@markdownai/core](https://www.npmjs.com/package/@markdownai/core) &nbsp;·&nbsp;
[@markdownai/engine](https://www.npmjs.com/package/@markdownai/engine) &nbsp;·&nbsp;
[@markdownai/parser](https://www.npmjs.com/package/@markdownai/parser) &nbsp;·&nbsp;
[@markdownai/renderer](https://www.npmjs.com/package/@markdownai/renderer) &nbsp;·&nbsp;
[@markdownai/mcp](https://www.npmjs.com/package/@markdownai/mcp)

---

MarkdownAI is a superset of Markdown that makes documents live. Add `@markdownai` to the first line of any `.md` file and it becomes executable - fetching real values from your environment, databases, APIs, and shell every time it renders.

This org contains the full MarkdownAI toolchain as a set of focused, composable packages.

## v1.3

- **Reusable partials with bound data:** `@template <path> data=<expr> [as=<name>] /` inlines another `.md` file at the call site and binds the expression to `{{ data.* }}` inside the partial. `@data <name> ... @data-end` composes a single object from any in-scope values using `<key> = <expression>` assignments, dot-notation, and `...<expression>` spreads. Reads inherit from the caller; writes stay local, so the same partial composes cleanly inside `@foreach`.

## v1.0

- **Iteration:** `@foreach` and `@set` turn documents into programs.
- **Filesystem writes:** `@mkdir`, `@copy`, `@append-if-missing`, `@update-frontmatter`, `@render-template` behind a `write_enabled` security gate.
- **Execution:** `@test` and `@check` inline the full runner output and expose exit code plus recognized summary as separate labels.
- **Targeted reads:** `@read-frontmatter` for single YAML fields, `@hash` for content hashing.
- **`@if` content helpers:** `file.containsLine`, `file.containsSection`, `file.frontmatterField`.
- **Three-jail path security:** independent `source_root`, `data_root`, and `write_root`. Data ops now default to the process working directory. **Breaking change** for 0.x users - set `filesystem.data_root = "auto"` to restore the old behavior.
- **SessionStart hook:** `mai init` installs a hook that renders `<project>/CLAUDE-MarkdownAI.md` on every session and injects it into Claude Code's context. Your `CLAUDE.md` is never modified.
- **Ironclad PreToolUse hook:** detects MarkdownAI documents behind YAML frontmatter (Claude Code slash commands) and ships the full 9-tool MCP catalogue inline in its redirect message.

See [`changed.md`](https://github.com/TheDecipherist/markdownai/blob/main/changed.md) for the full change log.

---

## Packages

### [@markdownai/core](https://www.npmjs.com/package/@markdownai/core)

The `mai` CLI. Everything you need to render, validate, and manage live documents from the terminal.

```bash
npm install -g @markdownai/core
mai render ./docs/status.md
```

Includes all security commands (`mai security shell enable`), caching, format output, and the MCP integration.

---

### [@markdownai/engine](https://www.npmjs.com/package/@markdownai/engine)

The execution core. Takes a parsed AST and evaluates all directives - shell queries, HTTP requests, database connections, environment resolution, caching, and security enforcement.

If you want to embed MarkdownAI rendering inside your own Node.js app, start here.

```ts
import { execute, parse } from '@markdownai/engine'

const ast = parse(source)
const result = execute(ast, { ctx: { security: { allowShell: true } } })
console.log(result.output)
```

---

### [@markdownai/parser](https://www.npmjs.com/package/@markdownai/parser)

Pure AST production. Reads MarkdownAI source and returns a typed AST with no side effects. No execution, no IO - just parsing.

Use this if you need to analyze or transform MarkdownAI documents without running them.

```ts
import { parse } from '@markdownai/parser'

const ast = parse(source)
// ast.nodes - array of typed directive and markdown nodes
```

---

### [@markdownai/renderer](https://www.npmjs.com/package/@markdownai/renderer)

11 output format modules that turn rendered output into different targets: standard Markdown, AI-optimized context, structured JSON, and more.

The renderer handles post-execution formatting and is consumed by both `@markdownai/engine` and `@markdownai/mcp`.

---

### [@markdownai/mcp](https://www.npmjs.com/package/@markdownai/mcp)

MCP (Model Context Protocol) server for Claude Code and other AI tools. Exposes MarkdownAI rendering as MCP tools so AI assistants can render live documents during a session.

```bash
mai-serve  # starts the MCP stdio server
```

Works with Claude Code hooks to intercept file reads and render live context automatically.

---

## Quick Start

```bash
# Install the CLI globally
npm install -g @markdownai/core

# Create a live document
cat > status.md << 'EOF'
@markdownai

# Project Status

**Files in src:** @count src/**/*.ts
**Node version:** @query "node --version" label="node_ver"
{{ node_ver }}
EOF

# Render it
mai render status.md
```

## Links

- [Full documentation and spec](https://github.com/TheDecipherist/markdownai)
- [Report issues](https://github.com/TheDecipherist/markdownai/issues)
- [npm org page](https://www.npmjs.com/org/markdownai)
