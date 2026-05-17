# @markdownai/engine

The execution core of MarkdownAI. Takes a parsed AST and evaluates all directives - shell queries, HTTP requests, database connections, environment resolution, caching, security enforcement, and output assembly.

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

`@markdownai/engine` is the brain of MarkdownAI. It takes a parsed AST from `@markdownai/parser`, walks every node in document order, resolves all dynamic directives, and assembles the final rendered output.

If you want to embed MarkdownAI rendering inside your own Node.js application - or build tools on top of the language - this is the package to use. The CLI (`@markdownai/core`) and MCP server (`@markdownai/mcp`) both use it internally.

## Installation

```bash
npm install @markdownai/engine
```

Requires Node.js >= 18. Database adapters (PostgreSQL, MySQL, MSSQL, MongoDB, SQLite) are included but only loaded when a `@connect` directive references them.

## Quick Start

```ts
import { parse } from '@markdownai/parser'
import { execute } from '@markdownai/engine'

const source = `@markdownai

# Project Status

**Branch:** @query "git branch --show-current" label="branch"
{{ branch }}

**Source files:** @count ./src/ match="**/*.ts"
`

const ast = parse(source)
const result = execute(ast, {
  ctx: {
    security: {
      allowShell: true,
      allowHttp: false,
      allowDb: false,
      jailRoot: null,
    }
  }
})

if (result.errors.length === 0) {
  console.log(result.output)
} else {
  console.error(result.errors)
}
```

## Core API

### `execute(ast, options?): EngineResult`

Executes a parsed MarkdownAI AST and returns the rendered output.

```ts
import { parse } from '@markdownai/parser'
import { execute, makeContext } from '@markdownai/engine'

const ast = parse(source)
const result = execute(ast, {
  filePath: '/path/to/doc.md',   // used for relative path resolution
  ctx: makeContext({
    envFiles: ['.env'],
    cwd: process.cwd(),
    security: {
      allowShell: false,
      allowHttp: false,
      allowDb: false,
      jailRoot: null,
    }
  })
})
```

**`EngineOptions`:**
```ts
interface EngineOptions {
  filePath?: string         // absolute path to the document being executed
  ctx?: Partial<EngineContext>  // execution context (security, env, etc.)
}
```

**`EngineResult`:**
```ts
interface EngineResult {
  output: string            // the final rendered markdown
  errors: string[]          // fatal errors that prevented execution
  warnings: string[]        // non-fatal issues (blocked directives, missing vars, etc.)
}
```

### `makeContext(options?): EngineContext`

Creates a complete execution context with defaults filled in.

```ts
import { makeContext } from '@markdownai/engine'

const ctx = makeContext({
  envFiles: ['.env.production'],
  cwd: '/path/to/project',
  consumer: 'ai',
  security: {
    allowShell: true,
    allowHttp: true,
    allowDb: true,
    jailRoot: '/path/to/project',
    shellConfig: { /* ... */ },
    httpConfig: { /* ... */ },
  }
})
```

### `strip(source, options?): StripResult`

Removes all MarkdownAI directives from a document, producing clean static Markdown. Conditional blocks are evaluated against the provided environment so the correct branch is preserved. `@note` blocks are always stripped regardless of their `visible` flag - `mai strip` is for producing plain markdown, not for consumer-targeted rendering.

```ts
import { strip } from '@markdownai/engine'

const result = strip(source, {
  env: { APP_ENV: 'production' },
  keepPrompts: false,    // strip @prompt blocks (default: false)
})

console.log(result.output)     // clean markdown
console.log(result.stripped)   // count of directives removed
```

**`StripOptions`:**
```ts
interface StripOptions {
  env?: Record<string, string>   // variables for conditional evaluation
  keepPrompts?: boolean           // preserve @prompt blocks in output
}
```

**`StripResult`:**
```ts
interface StripResult {
  output: string
  stripped: number
}
```

## Security

All security is opt-out by default - everything that could have side effects is blocked unless explicitly enabled.

### Security Config

```ts
interface SecurityConfig {
  allowShell: boolean        // enable @query shell execution
  allowHttp: boolean         // enable @http requests
  allowDb: boolean           // enable @db database queries
  jailRoot: string | null    // confine filesystem access to this directory
  shellConfig?: ShellSecurityConfig
  httpConfig?: HttpSecurityConfig
  filesystemConfig?: FilesystemSecurityConfig
}
```

### Loading from disk

The `mai security` commands write to `~/.markdownai/security.json`. Use `loadSecurityConfig()` to read it:

```ts
import { loadSecurityConfig } from '@markdownai/engine'

const json = loadSecurityConfig()
// json.shell.enabled, json.http.enabled, json.db, etc.
```

### Default config

```ts
import { defaultSecurityConfig } from '@markdownai/engine'

// defaultSecurityConfig = {
//   allowShell: false,
//   allowHttp: false,
//   allowDb: false,
//   jailRoot: null,
// }
```

### Immutable rules

Certain operations are permanently blocked regardless of your configuration. These cannot be overridden:

- Cloud metadata endpoints (`169.254.169.254`, `metadata.google.internal`, etc.)
- Pipe-to-shell patterns (`curl ... | bash`, `wget ... | sh`)
- Filesystem paths that escape the jail root

When an immutable rule blocks something, a `SECURITY_ALERT` is emitted to stderr even if `--silent` is set.

### Shell security

When `allowShell: true`, shell commands run through your allowlist and deny patterns:

```ts
const shellConfig: ShellSecurityConfig = {
  enabled: true,
  allow_patterns: ['git log *', 'npm audit *'],
  deny_patterns: ['rm *', 'sudo *'],
  allow_network: false,
  require_confirmation: false,
  audit_log: true,
}
```

### HTTP security

When `allowHttp: true`, HTTP requests are limited to your allowed domains:

```ts
const httpConfig: HttpSecurityConfig = {
  enabled: true,
  allowed_domains: ['api.github.com', 'api.example.com'],
  denied_domains: [],
  allowed_methods: ['GET'],
  max_response_size: 1048576,  // 1 MB
  timeout: 10000,              // 10 seconds
}
```

## Environment Resolution

The engine resolves environment variables in a fixed priority order:

1. Shell environment (`process.env`)
2. Any env files passed via `envFiles` or `--env`
3. Fallbacks registered via `@import` files
4. The `fallback=` value on the directive itself
5. Empty string (no error)

```ts
import { resolveEnv } from '@markdownai/engine'

const value = resolveEnv('DATABASE_URL', ctx)
```

## Expression Evaluation

The expression system is used in `@if` conditions, `{{ }}` interpolations, and `where` filters. It runs in a sandboxed `vm.runInNewContext` context - `eval()` is never used.

```ts
import { evalCondition, evalExpression } from '@markdownai/engine'

// Boolean condition (for @if)
const matches = evalCondition('env.APP_ENV == "production"', ctx)

// Expression result (for {{ }})
const value = evalExpression('date format="YYYY-MM-DD"', ctx)
```

**Supported operators:**
- Equality: `==`, `!=`
- Comparison: `>`, `<`, `>=`, `<=`
- Logical: `&&`, `||`, `!`
- Existence: `file.exists`, `file.isDir`
- String: `.startsWith()`, `.endsWith()`, `.includes()`
- Ternary: `condition ? "yes" : "no"`
- Nullish: `??` (fallback if null/undefined)
- Optional chain: `?.`

## Caching

Add `@cache` to any data directive to cache its result:

```ts
import { cacheKey, readCache, writeCache, clearSessionCache, clearPersistCache, showCacheEntries } from '@markdownai/engine'

// Read a cached value
const cached = readCache(key)

// Write to cache
writeCache(key, value, { mode: 'session' | 'persist', ttl?: number })

// List all cache entries
const entries = showCacheEntries()

// Clear session (in-memory) cache
clearSessionCache()

// Clear persistent (disk) cache
clearPersistCache()
```

Cache modes:
- `session` - in-memory, cleared when the process exits
- `persist` - written to disk, survives restarts
- `ttl=N` - session cache that expires after N seconds
- `persist ttl=N` - disk cache that expires after N seconds
- `mock=./file.json` - always returns the contents of a local file, never hits the real source

Sensitive content is masked before anything is written to the cache.

## Built-in Pipe Commands

The engine includes pure-Node.js implementations of common Unix pipe utilities. These work on all platforms without spawning a shell:

| Command | Behavior |
|---------|----------|
| `grep <pattern>` | Filter lines matching a regex |
| `sort` | Sort lines alphabetically |
| `sort -r` | Sort lines in reverse |
| `head -n N` | Keep first N lines |
| `tail -n N` | Keep last N lines |
| `wc -l` | Count lines |
| `uniq` | Remove consecutive duplicate lines |

Shell-dependent commands (`awk`, `sed`, `jq`, etc.) spawn a child process and are Unix/WSL only. The engine detects platform at startup and warns when shell-only commands are used on Windows.

```ts
import { isBuiltin, runBuiltin } from '@markdownai/engine'

if (isBuiltin('grep \\.ts$')) {
  const filtered = runBuiltin('grep \\.ts$', lines)
}
```

## Database Support

`@markdownai/engine` includes adapters for:

- **MongoDB** (`mongodb://` or `mongodb+srv://`)
- **PostgreSQL** (`postgres://` or `postgresql://`)
- **MySQL** (`mysql://`)
- **MSSQL** (`mssql://`)
- **SQLite** (`sqlite://`)

Connections are established via `@connect` in your document and referenced by name in `@db` blocks. All queries run through the database security jail (read-only by default, operation allowlist, collection restrictions).

## TypeScript

Full type declarations are included for all exports:

```ts
import type {
  EngineContext,
  EngineOptions,
  EngineResult,
  SecurityConfig,
  ShellSecurityConfig,
  HttpSecurityConfig,
  DbSecurityConfig,
  FilesystemSecurityConfig,
  SecurityJsonConfig,
  DbConnectionSecurityConfig,
  Connection,
  MacroDefinition,
  MCPContext,
  CacheEntry,
  StripOptions,
  StripResult,
} from '@markdownai/engine'
```

## Part of the MarkdownAI toolchain

- **Parse documents** - use [`@markdownai/parser`](https://www.npmjs.com/package/@markdownai/parser)
- **Format output** - use [`@markdownai/renderer`](https://www.npmjs.com/package/@markdownai/renderer)
- **Run from the CLI** - install [`@markdownai/core`](https://www.npmjs.com/package/@markdownai/core) globally
- **Serve to AI tools** - use [`@markdownai/mcp`](https://www.npmjs.com/package/@markdownai/mcp)

## License

MIT - [GitHub](https://github.com/TheDecipherist/markdownai)
