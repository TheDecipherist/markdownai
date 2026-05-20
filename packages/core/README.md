# @markdownai/core

<p align="center">
  <a href="https://markdownai.dev">
    <img src="https://img.shields.io/badge/📖_Documentation-markdownai.dev-00e5cc?style=for-the-badge&labelColor=08090f" alt="Documentation Site" />
  </a>
  &nbsp;
  <a href="https://markdownai.dev/user-guide.html">
    <img src="https://img.shields.io/badge/📚_User_Guide-Full_Reference-00ff88?style=for-the-badge&labelColor=08090f" alt="User Guide" />
  </a>
</p>

The `mai` CLI. Everything you need to render, validate, strip, serve, and inspect MarkdownAI live documents from the terminal.

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

`@markdownai/core` is the user-facing layer of MarkdownAI. It provides the `mai` binary with a full command set for working with live documents: rendering them, validating them, stripping directives, building output files, watching for changes, managing the cache, configuring security, and inspecting document structure.

It's also importable as a library if you want to embed `mai` commands in your own tooling.

## Installation

```bash
npm install -g @markdownai/core
```

Verify:
```bash
mai --version
```

Requires Node.js >= 18.

## Quick Start

```bash
# Create a live document
cat > status.md << 'EOF'
@markdownai

# Project Status

Branch: @query "git branch --show-current" label="branch"
{{ branch }}

TypeScript files: @count ./src/ match="**/*.ts"

Last commit: @query "git log --oneline -1"
EOF

# Render it
mai render status.md
```

## Universal flags

Every `mai` command accepts these flags:

| Flag | Description |
|------|-------------|
| `--env <file>` | Load a `.env` file for environment variable resolution |
| `--cwd <path>` | Run as if you were in a different directory |
| `--verbose` | Show warnings and security events in terminal output |
| `--strict` | Treat warnings as errors, stop on any blocked directive |
| `--silent` | Suppress all output except `SECURITY_ALERT` and fatal errors |

---

## Commands

### `mai render <file>`

Executes the document and prints fully rendered Markdown to stdout.

```bash
mai render report.md
mai render report.md -o dist/report.md          # write to file
mai render report.md --env .env.production      # use production env
mai render report.md --consumer ai              # AI-optimized output
mai render report.md --strict                   # fail on any warning
```

**Flags:**
- `-o, --output <path>` - write output to a file instead of stdout
- `--consumer <human|ai>` - target audience for consumer-conditional sections
- `--budget <N>` - token budget for AI-format output (drops low-priority sections to fit)
- `--phase <name>` - render only a specific named phase

---

### `mai validate <file>`

Checks the document for errors and warnings without producing output. Exits with code 1 if errors are found.

```bash
mai validate report.md
mai validate report.md --strict    # treat warnings as errors too
mai validate report.md --env .env.production
```

Validation catches:
- Unclosed block directives
- Unset environment variables with no fallback
- Circular `@include`/`@import` references
- Blocked directives that would be stripped at render time
- Platform-incompatible pipe commands (shell-only on Unix)

---

### `mai parse <file>`

Parses the document and outputs its internal AST as JSON. Useful for debugging directive structure.

```bash
mai parse report.md
mai parse report.md --pretty              # formatted JSON
mai parse report.md --node EnvNode        # filter to specific node type
```

---

### `mai eval "<expression>"`

Evaluates a single MarkdownAI expression against your current environment and prints the result. Good for testing expressions before putting them in a document.

```bash
mai eval "file.exists './src/enterprise/'"
mai eval "date format='YYYY-MM-DD'"
mai eval "env.APP_ENV ?? 'development'"
mai eval --env .env.staging "env.DATABASE_URL"
```

---

### `mai strip <file>`

Removes all MarkdownAI directives from a document, producing clean static Markdown. Conditional blocks are resolved against your environment - the right branch is kept, the rest is discarded.

```bash
mai strip report.md                                    # print to stdout
mai strip report.md -o dist/report.md                  # write to file
mai strip report.md --env .env.production -o dist/     # env-aware, write to dir
mai strip ./docs/ --env .env.production -o ./dist/     # strip entire directory
```

---

### `mai build <file>`

Render a document and write the output to disk. Equivalent to `mai render -o`, but designed as a build step.

```bash
mai build report.md --output dist/report.md
mai build report.md --output dist/report.md --watch    # rebuild on file changes
```

**Flags:**
- `-o, --output <path>` - output file path (required)
- `--watch` - rebuild whenever the source document or any included file changes

---

### `mai watch <file>`

Watch a document for changes and re-render automatically whenever the source or any dependency changes.

```bash
mai watch report.md --output dist/report.md
mai watch report.md -o dist/ --verbose
```

---

### `mai serve`

Start the MarkdownAI MCP server. Use this to connect Claude Code or other MCP-compatible AI tools to your live documents.

```bash
mai serve
mai serve --cwd /path/to/project
mai serve --port 3000
```

After starting, configure your AI client to connect. See [`@markdownai/mcp`](https://www.npmjs.com/package/@markdownai/mcp) for Claude Code setup instructions.

---

### `mai init`

Auto-detect your AI client and install the PreToolUse hook so it automatically routes MarkdownAI documents through the engine.

```bash
mai init                           # auto-detect client
mai init --client claude-code      # explicit Claude Code
mai init --client cursor           # explicit Cursor
mai init --global-claude-md        # append MarkdownAI guidance to ~/.claude/CLAUDE.md
```

After `mai init`, every `.md` file with a `@markdownai` header that your AI reads is automatically rendered before the AI sees it.

`--global-claude-md` appends a section to your global `~/.claude/CLAUDE.md` that teaches Claude to prefer MarkdownAI syntax when writing new `.md` files and to use the CLI when no MCP server is running. Safe to run multiple times - idempotent.

---

## Cache Commands

### `mai cache show [file]`

Show cached data for a document (or all documents if no file given).

```bash
mai cache show
mai cache show report.md
mai cache show report.md --session    # only in-memory entries
mai cache show report.md --persist    # only disk entries
mai cache show --expired              # include expired entries
```

### `mai cache clear [file]`

Clear cached data.

```bash
mai cache clear                         # clear everything
mai cache clear report.md               # clear for one document
mai cache clear --session               # only in-memory cache
mai cache clear --persist               # only disk cache
mai cache clear --directive db          # only @db results
```

### `mai cache seed <file>`

Pre-populate the persistent cache by running all fetches in a document. Run this once before going offline so subsequent renders use cached data.

```bash
mai cache seed report.md
mai cache seed report.md --env .env.production
mai cache seed report.md --directive db          # seed only @db results
```

---

## Security Commands

### `mai security show`

Display the active security policy.

```bash
mai security show
```

### `mai security init`

Create or import a security policy file at `~/.markdownai/security.json`.

```bash
mai security init
mai security init --from .markdownai.json   # import from local file
```

### Shell jail - `mai security shell`

```bash
mai security shell enable                    # turn on shell execution
mai security shell disable                   # turn off
mai security shell add "git log *"           # add to allowlist
mai security shell remove "git log *"        # remove from allowlist
mai security shell list                      # show all patterns
mai security shell test "git log --oneline"  # test a specific command
```

### HTTP jail - `mai security http`

```bash
mai security http enable                        # enable outbound HTTP
mai security http disable                       # disable
mai security http add-domain api.github.com     # add to allowlist
mai security http remove-domain api.github.com  # remove
mai security http test "https://api.github.com" # test a URL
```

### Database jail - `mai security db`

```bash
mai security db add reports                     # add a connection to config
mai security db set reports.readonly true       # enforce read-only
mai security db allow-collection reports users  # restrict to this collection
mai security db deny-keyword reports DROP       # block a keyword
mai security db test reports "db.users.find()"  # test a query
mai security db disable reports                  # disable a connection
```

### Filesystem - `mai security filesystem`

```bash
mai security filesystem show
mai security filesystem add-block-path /etc
mai security filesystem test ./docs/report.md
mai security filesystem test-mask ./config/.env
```

### Audit log - `mai security audit`

```bash
mai security audit show                   # show all events
mai security audit show --blocked         # show only blocked events
mai security audit clear                  # clear the log
```

---

## Inspection Commands

### `mai list-phases <file>`

List all phases in a document and their `@on complete` transitions.

```bash
mai list-phases runbook.md
```

### `mai list-macros <file>`

List all macros defined or used in a document, with their source file.

```bash
mai list-macros report.md
```

### `mai list-imports <file>`

Show the full dependency tree - every `@include` and `@import` chain the document pulls in.

```bash
mai list-imports report.md
```

---

## Library Usage

All commands are exported as functions for use in your own tools:

```ts
import {
  runRender,
  runValidate,
  runParse,
  runEval,
  runStrip,
  runBuild,
  runServe,
  runWatch,
  runInit,
  runCacheShow,
  runCacheClear,
  runListPhases,
  runListMacros,
  runListImports,
  shouldRoute,
  isMarkdownAIFile,
} from '@markdownai/core'
```

### `runRender(filePath, options?): RenderResult`

```ts
import { runRender } from '@markdownai/core'
import type { RenderOptions } from '@markdownai/core'

const result = runRender('./docs/status.md', {
  env: '.env.production',
  consumer: 'ai',
  silent: false,
  verbose: true,
})

console.log(result.output)
console.log(result.exitCode)   // 0 = success, 1 = errors
```

### `runValidate(filePath, options?): ValidateResult`

```ts
const result = runValidate('./docs/status.md', { strict: true })
// result.valid, result.errors, result.warnings
```

### `shouldRoute(filePath): boolean`

Returns `true` if a file should be routed through the MarkdownAI engine (has the `@markdownai` header).

```ts
import { shouldRoute, isMarkdownAIFile } from '@markdownai/core'

if (shouldRoute('/path/to/doc.md')) {
  // render it
}
```

### `isMarkdownAIFile(filePath): boolean`

Reads the first line of a file and returns `true` if it starts with `@markdownai`.

---

## The `@markdownai` header

Every live document starts with `@markdownai` on line 1:

```markdown
@markdownai

# Your Document Title
```

Optionally pin a version:

```markdown
@markdownai v1.0
```

If the header is missing, `mai` treats the file as plain Markdown and skips all directive processing.

---

## Security model

By default, all operations that could have side effects are blocked:

- `@query` (shell execution) - blocked unless `mai security shell enable`
- `@http` (HTTP requests) - blocked unless `mai security http enable`
- `@db` (database queries) - blocked unless a connection is configured

Blocked directives are silently removed from output (with a warning when `--verbose`). Use `--strict` to treat them as errors.

Certain operations are permanently blocked and cannot be enabled regardless of configuration:
- Cloud metadata endpoints (`169.254.169.254`, `metadata.google.internal`)
- Pipe-to-shell patterns (`curl ... | bash`)
- Filesystem access outside the document root

---

## TypeScript

All exported types:

```ts
import type {
  RenderOptions,
  RenderResult,
  ValidateOptions,
  ValidateResult,
  ParseCmdOptions,
  ParseCmdResult,
  EvalOptions,
  EvalResult,
  StripCmdOptions,
  StripCmdResult,
  BuildOptions,
  BuildResult,
  InitOptions,
  InitResult,
  ServeOptions,
  ServeResult,
  WatchOptions,
  WatchHandle,
  HookDecision,
} from '@markdownai/core'
```

## Part of the MarkdownAI toolchain

- **Parse documents** - use [`@markdownai/parser`](https://www.npmjs.com/package/@markdownai/parser)
- **Execute directives** - use [`@markdownai/engine`](https://www.npmjs.com/package/@markdownai/engine)
- **Format output** - use [`@markdownai/renderer`](https://www.npmjs.com/package/@markdownai/renderer)
- **Serve to AI tools** - use [`@markdownai/mcp`](https://www.npmjs.com/package/@markdownai/mcp)

## License

MIT - [GitHub](https://github.com/TheDecipherist/markdownai)
