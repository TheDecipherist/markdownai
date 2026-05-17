---
id: 49-stdlib
title: Standard Library (stdlib)
edition: Both
status: complete
path: engine/stdlib
source_files:
  - packages/engine/src/stdlib.md
  - packages/engine/src/engine.ts
depends_on:
  - 03-engine
  - 06-lang-interpolation
  - 08-lang-macros
last_synced: 2026-05-17
tags: [stdlib, macros, git, filesystem, project-detection, code-analysis, environment, performance]
known_issues: []
mdd_version: 2
---

## Purpose

The standard library is a set of 32 pre-defined `@define` macros shipped with the engine and
auto-loaded into every `@markdownai` document. No `@import` needed - they just work.

The driving insight: AI assistants (and the humans writing AI-driven workflows) write the same
shell commands thousands of times per day. `git status`, `git log --oneline`, `find . -name '*.ts'`,
`ls -la` - these appear in nearly every session. Each one costs tokens to generate, tokens to output,
and mental overhead to get right. The stdlib solves all three.

When a document says `@call git-status`, the engine runs `git status --short` and stores the result
in `{{ git_status }}`. The document then references it in text or `@if` conditions without ever
touching a shell command.

## Design Principles

**Zero configuration.** Macros are available the moment `@markdownai` is at the top of a file.
No imports, no setup.

**User macros win.** Any `@define` in the document or its @imported files with the same name
as a stdlib macro overrides it. This lets projects customize stdlib behavior for their specific
environment.

**Output capped.** Every stdlib macro that could produce large output (grep results, find output,
git log) is hard-limited to 30-100 lines. Context tokens are expensive.

**Silent on failure.** If stdlib.md is missing (e.g., running from a partial install), `execute()`
catches the exception and continues. Documents degrade gracefully.

## The 32 Macros

### Git Operations (9)

| Macro | Sets | What it does |
|---|---|---|
| `git-status` | `git_status` | Compact status: M/A/D/?? flags, one file per line |
| `git-branch` | `current_branch` | Active branch name |
| `git-log` | `git_log` | Last 10 commits, hash + subject |
| `git-diff-stat` | `diff_stat` | Files changed with +/- counts, no line diff |
| `git-staged` | `staged_files` | Files in the staging area |
| `git-modified` | `modified_files` | Tracked files modified but not staged |
| `git-untracked` | `untracked_files` | New files not yet tracked |
| `git-ahead` | `commits_ahead` | Commits ahead of the tracked remote branch |
| `git-last-commit` | `last_commit` | Most recent commit hash + message |

### Filesystem (7)

| Macro | Sets | What it does |
|---|---|---|
| `fs-ls` | `dir_listing` | `ls -la` output |
| `fs-find(pattern)` | `found_files` | Files matching a glob, capped at 100 lines |
| `fs-large-files` | `large_files` | Source files over 300 lines, sorted |
| `fs-recent` | `recent_files` | Files modified in the last 7 days |
| `fs-tree` | `dir_tree` | Directory tree 2 levels deep |
| `fs-count(ext)` | `file_count` | Count files by extension |
| `fs-size` | `dir_sizes` | du -sh on src, dist, build, etc. |

### Project Detection (5)

| Macro | Sets | What it does |
|---|---|---|
| `project-manager` | `pkg_manager` | npm/pnpm/yarn/bun/cargo/go/pip |
| `project-language` | `main_language` | TypeScript/Rust/Go/Python/JavaScript |
| `project-name` | `project_name` | From package.json, Cargo.toml, go.mod |
| `project-version` | `project_version` | From package.json or Cargo.toml |
| `project-test-cmd` | `test_cmd` | Detected test runner command |

### Code Analysis (5)

| Macro | Sets | What it does |
|---|---|---|
| `code-todos` | `todos` | TODO/FIXME/HACK/XXX with file:line, cap 30 |
| `code-console-logs` | `console_logs` | console.log in non-test source, cap 30 |
| `code-any-types` | `any_count` | Count of TypeScript `any` usages |
| `code-test-files` | `test_files` | All .test.ts/.spec.ts/test_*.py files |
| `code-grep(pattern)` | `grep_results` | Pattern search across source, cap 30 |

### Environment (6)

| Macro | Sets | What it does |
|---|---|---|
| `env-node` | `node_version` | Node.js version |
| `env-os` | `os_type` | wsl / macos / linux / windows |
| `env-port(port)` | `port_in_use` | Whether a TCP port is bound |
| `env-has(cmd)` | `cmd_available` | Whether a CLI command is on PATH |
| `env-ci` | `in_ci` | Whether running inside a CI environment |
| `env-git-author` | `git_author` | Configured git user name and email |

## Usage Examples

### Session context at a glance

```markdown
@markdownai
@call git-branch
@call project-manager
@call project-language

Working on: {{ current_branch }}
Stack: {{ main_language }} / {{ pkg_manager }}
```

### Branch safety check before destructive operation

```markdown
@markdownai
@call git-branch
@call git-status

@if {{ current_branch }} == "main"
@constraint STOP - on main branch. Switch to a feature branch first.
@endif

@if {{ git_status }} != ""
@constraint Uncommitted changes detected:
{{ git_status }}
Commit or stash before continuing.
@endif
```

### Quick health check

```markdown
@markdownai
@call code-any-types
@call code-console-logs
@call fs-large-files

TypeScript any count: {{ any_count }}
console.log in library code:
{{ console_logs }}

Files over 300 lines:
{{ large_files }}
```

### Find a function across the codebase

```markdown
@markdownai
@call code-grep pattern="function validateConfig"

Results:
{{ grep_results }}
```

### Is the dev server already running?

```markdown
@markdownai
@call env-port port=3000

@if {{ port_in_use }} == "true"
Server is already running on port 3000 - skip startup.
@else
@constraint Start the dev server before proceeding.
@endif
```

## Implementation

**Auto-loading in engine.ts:**

```typescript
function loadStdlib(ctx: EngineContext): void {
  try {
    const stdlibPath = join(dirname(fileURLToPath(import.meta.url)), 'stdlib.md')
    const source = readFileSync(stdlibPath, 'utf8')
    const ast = parse(source, { filePath: stdlibPath, inImport: true })
    for (const n of ast.nodes) {
      if (n.type === 'define') ctx.macros[n.name] = { body: n.body, params: n.params }
    }
  } catch {
    // stdlib unavailable - not fatal
  }
}
```

Called at the start of `execute()` before the user document's nodes are walked. This means
stdlib macros are registered first. Any `@define` encountered while processing the user document
or its @imports will overwrite the stdlib entry for that name.

**Build step:** `tsc && cp src/stdlib.md dist/stdlib.md`

The `stdlib.md` file ships alongside the compiled JS. `import.meta.url` resolves to the engine module
at runtime, so `./stdlib.md` always finds the file regardless of install path.

## Security

Stdlib macros run through the same security gates as any other `@query`. The engine already
enforces `allowShell`, `shellConfig`, `jailRoot`, and metadata endpoint blocking. Stdlib provides
no new attack surface - it just saves users from writing the same trusted shell commands repeatedly.

## Token Economics

A typical 30-minute AI coding session runs an estimated 100,000+ tokens on shell command output
alone. Stdlib addresses this in two ways:

1. **Output capping** - every grep/find/log result is hard-capped so it cannot balloon context
2. **Compact formats** - `git status --short` over `git status`, `--oneline` over full log

The real saving is on the INPUT side - Claude doesn't spend 40-80 tokens generating and explaining
a `find . -name '*.ts' -not -path '*/node_modules/*' | wc -l` command. It just says
`@call fs-count ext=ts`.
