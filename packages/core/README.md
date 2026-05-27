# @markdownai/core

The `mai` CLI. Render, validate, strip, and serve MarkdownAI documents from the terminal.

[Root README](../../README.md) · [Engine](../engine/README.md) · [MCP](../mcp/README.md) · [GitHub](https://github.com/TheDecipherist/markdownai)

## Install

```bash
npm install -g @markdownai/core
mai --version
```

Node 18+.

## Subcommands

### `mai render <file>`

Render a document to stdout (or `-o <path>`).

```bash
mai render docs/status.md
mai render docs/status.md --format ai --budget 4000
mai render skill.md --skill-args "audit auth" --skill-dir ~/.claude/commands
```

Flags: `-o`, `--consumer`, `--format`, `--budget`, `--phase`, `--passthrough`, plus the skill-render flags (`--skill-args`, `--skill-dir`, `--skill-effort`, `--skill-session-id`).

### `mai migrate-v2 <file> [--in-place]`

Rewrite v1 directive syntax to v2. Delegates to `packages/parser/scripts/migrate-v1-to-v2.mjs`. Idempotent - re-running on a v2 file is a no-op.

```bash
mai migrate-v2 docs/old.md            # print diff to stdout
mai migrate-v2 docs/old.md --in-place # rewrite the file
```

> Note: at the time of writing this subcommand may not yet be wired into the CLI. Until then, invoke the script directly:
> `node packages/parser/scripts/migrate-v1-to-v2.mjs <file> --in-place`

### `mai serve`

Start the MCP server (stdio JSON-RPC). Used by Claude Code via `mai init`.

```bash
mai serve
mai serve --cwd /path/to/project --passthrough
```

See [`@markdownai/mcp`](../mcp/README.md) for the 11 tools the server exposes and the multi-phase walk pattern.

### `mai validate <file>`

Parse-only check. Exits 1 on errors. No directive execution, no IO.

```bash
mai validate docs/status.md
mai validate docs/status.md --strict   # warnings count as errors
```

## Other commands

`mai parse`, `mai eval`, `mai strip`, `mai build`, `mai watch`, `mai init`, `mai cache (show|clear)`, `mai security (shell|http|db|filesystem|audit ...)`, `mai list-phases`, `mai list-macros`, `mai list-imports`. Run `mai <command> --help` for flags.

Universal flags on every command: `--env <file>`, `--cwd <path>`, `--verbose`, `--strict`, `--silent`.

## Library usage

Every subcommand is also exported as a function:

```ts
import { runRender, runValidate, runServe, runStrip, runBuild, runInit } from '@markdownai/core'

const result = runRender('./docs/status.md', { format: 'ai', budget: 4000 })
console.log(result.output, result.exitCode)
```

Types: `RenderOptions`, `RenderResult`, `ValidateOptions`, `ValidateResult`, `ParseCmdOptions`, `EvalOptions`, `StripCmdOptions`, `BuildOptions`, `InitOptions`, `ServeOptions`, `WatchOptions`, `HookDecision`.

## License

MIT.
