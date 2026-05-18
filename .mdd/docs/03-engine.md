---
id: 03-engine
title: Engine — AST Execution
edition: Both
depends_on: [01-parser, 02-renderer]
source_files:
  - packages/engine/package.json
  - packages/engine/tsconfig.json
  - packages/engine/src/engine.ts
  - packages/engine/src/context.ts
  - packages/engine/src/macros.ts
  - packages/engine/src/conditions.ts
  - packages/engine/src/pipe.ts
  - packages/engine/src/shell.ts
  - packages/engine/src/cache.ts
  - packages/engine/src/index.ts
routes: []
models: []
test_files: []
data_flow: greenfield
last_synced: 2026-05-15
status: complete
phase: all
mdd_version: 1
tags: [engine, template, ast-walker, pipe-execution, macro-registry, context, phase-state, cache]
path: Toolchain/Engine
wave: markdownai-core-wave-1
wave_status: complete
initiative: markdownai-core
integration_contracts: []
satisfies_contracts:
  - from: 23-security-filesystem
    function: checkFilePath(resolved, ctx.jailRoot, ctx.security)
    when: before readFileSync in executeInclude and executeImport
    status: done
  - from: 24-security-shell
    function: checkShellCommand(command, ctx.security)
    when: before execSync in engine/shell.ts
    status: done
  - from: 26-security-http
    function: checkHttpUrl(url, ctx.security)
    when: before HTTP execution in engine
    status: done
  - from: 25-security-database
    function: checkDatabaseOperation(connection, operation, ctx.security)
    when: before @db/@query execution
    status: done
  - from: 28-caching
    function: applyMasking(value, ctx.security)
    when: before writeCache stores any value
    status: done
known_issues: []
---

# 03 — Engine — AST Execution

## Purpose

Walks the AST produced by the parser and resolves every node to its output string. Manages env resolution, macro expansion, phase state, pipe execution, and the cache layer. The engine is the orchestrator -- it delegates formatting to the renderer and parsing to the parser.

**Package:** `@markdownai/engine` -- internal to monorepo, not published standalone.

## Architecture

```
packages/engine/
  src/
    engine.ts      main AST walker -- dispatches each node to its handler
    context.ts     EngineContext type and factory
    macros.ts      @define registry, parameter substitution
    conditions.ts  @if expression evaluator
    pipe.ts        pipe chain orchestration, built-in command runner
    shell.ts       child_process shell execution (jailed directives)
    cache.ts       session and persist cache manager
  index.ts
```

## Data Model

**EngineContext:**

```typescript
interface EngineContext {
  env: Record<string, string>           // process.env
  envFiles: Record<string, string>      // --env file values
  envFallbacks: Record<string, string>  // @env fallbacks from @import files
  connections: Record<string, Connection>
  macros: Record<string, MacroNode>
  phase: string | null
  cwd: string
  security: SecurityConfig
  mcp: MCPContext | null
}
```

**Env resolution -- `resolveEnv()` must implement this exact order:**

```typescript
function resolveEnv(key: string, directiveFallback: string | null, ctx: EngineContext): string {
  return ctx.env[key]           // 1. process.env -- always wins
    ?? ctx.envFiles[key]        // 2. --env file
    ?? ctx.envFallbacks[key]    // 3. @import fallback registry
    ?? directiveFallback        // 4. fallback= on the directive
    ?? ""                       // 5. empty string -- never an error
}
```

## Business Rules

**AST walking:**
- Walk nodes sequentially, accumulate output strings, join with newlines
- `header` node → empty string (consumed by parser, not rendered)
- `markdown` node → pass through as-is
- `passthrough` node → pass through as-is
- `interpolation` node → resolve expression, substitute inline
- `conditional` node → evaluate condition, walk matching branch only
- `define` node → register macro, return empty string
- `call` node → look up macro, substitute params, walk body, return output
- `connect` node → register connection, return empty string
- `phase` node → only walk if this phase is active (or no active phase), transitions registered not executed
- `pipe` node → execute all stages in sequence, return final output
- `graph` node → pass through fenced block as-is (documentation only)

**Built-in pipe commands (cross-platform, Node.js implementations, no shell):**
- `grep <pattern>` -- filter lines matching pattern
- `grep -v <pattern>` -- filter lines NOT matching pattern
- `grep -i <pattern>` -- case-insensitive
- `sort` -- alphabetical
- `sort -r` -- reverse alphabetical
- `sort -n` -- numeric
- `sort -rn` -- numeric reversed
- `head -n N` -- first N lines
- `tail -n N` -- last N lines
- `wc -l` -- count lines, returns number string
- `uniq` -- remove consecutive duplicate lines
These never spawn a child process. All other pipe commands go through `shell.ts`.

**Expression evaluation in `conditions.ts`:**
- Valid operators: `==`, `!=`, `>`, `<`, `>=`, `<=`, `&&`, `||`, `!`, `?:`, `?.`, `??`, `()`
- `file.exists(path)` → boolean (Node.js `fs.existsSync`)
- `file.isFile(path)` → boolean (`fs.statSync(path).isFile()`)
- `file.isDir(path)` → boolean (`fs.statSync(path).isDirectory()`)
- Left-hand side of `where` clauses is a field name on row data, not env var
- Use `vm.runInNewContext` with a sandboxed context -- never `eval()`

**Cache (`cache.ts`):**
- Session cache: `Map<string, string>` in memory, keyed by content hash of directive + options
- Persist cache: disk at `~/.markdownai/cache/`, JSON files named by content hash
- TTL: persist entries include `expires` timestamp, checked on read
- Mock: reads from specified file path, never executes directive
- Masking applied before caching -- sensitive values never stored
- Cache key: `sha256(directive_type + ":" + JSON.stringify(sortedOptions))`

## Known Issues

(none)
