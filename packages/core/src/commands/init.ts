import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { join, dirname } from 'node:path'
import { CLAUDE_MD_SECTION, SECTION_START_MARKER, SECTION_END_MARKER } from '../templates/claude-section.js'
import { checkAbsolutePath } from '@markdownai/engine'

export type ClientType = 'claude-code' | 'cursor' | 'auto'

export interface InitOptions {
  client?: ClientType
  cwd?: string
  /**
   * Override the user's home directory. Used by tests to redirect file
   * writes into a tmpdir without touching the real ~/.claude/ or
   * ~/.markdownai/. Defaults to `os.homedir()`.
   */
  homeDir?: string
}

export interface InitResult {
  success: boolean
  clientDetected: string
  configPath: string
  alreadyInstalled: boolean
  message: string
  /** Path to the main client config (Claude .claude.json) where MCP entries live. */
  mcpConfigPath?: string
  /** Status of the @markdownai/mcp server registration in mcpConfigPath. */
  mcpRegistration?: {
    serverName: string
    command: string
    alreadyInstalled: boolean
    error?: string
  }
}

/**
 * Detect whether a file is a MarkdownAI document.
 *
 * Two valid forms:
 *   1. First non-blank line starts with `@markdownai`.
 *   2. File starts with a YAML frontmatter block (a `---` line, then content,
 *      then another `---` line on its own), followed by `@markdownai` on the
 *      first non-blank line after the closing `---`.
 *
 * The parser already accepts both forms (see `packages/parser/src/parser.ts`
 * frontmatter handling). The hook MUST accept both or it leaves a bypass for
 * any file with leading frontmatter (e.g. Claude Code slash-command files
 * like MDD's `mdd.md`).
 *
 * Exported for unit testing.
 */
export function isMarkdownAIDocument(content: string): boolean {
  // Updated 2026-05-25: stricter rule. ANY line whose first non-whitespace
  // token is a directive-style identifier (`@<name>` where <name> starts
  // with a letter/underscore) marks the file as containing MarkdownAI
  // directive syntax. Claude must never see these raw — the engine runs
  // them and substitutes the result.
  //
  // The pattern matches MarkdownAI directives (@phase, @if, @call,
  // @markdownai-detect, @plugin-meta, @define, @import, @include, etc.)
  // without matching JSDoc " * @param" lines (those have a leading
  // asterisk before the @).
  const directiveLineRe = /^\s*@[a-zA-Z_][a-zA-Z0-9_-]*/
  for (const line of content.split('\n')) {
    if (directiveLineRe.test(line)) return true
  }
  return false
}

/**
 * The full message Claude reads when the hook blocks a direct read of a
 * MarkdownAI document. Designed to be self-contained - lists every MCP tool
 * with its argument shape, return shape, and "use this when" - so Claude has
 * no excuse to retry the Read or guess at the API.
 */
export const REDIRECT_MESSAGE = [
  '════════════════════════════════════════════════════════════════════',
  'STOP. I CANNOT read this file.',
  'I MUST forward it to the MarkdownAI MCP server.',
  '════════════════════════════════════════════════════════════════════',
  '',
  'This file is a MarkdownAI document (it contains an `@markdownai` header).',
  'Reading it through Read / read_file / Bash cat / any other local tool is',
  'FORBIDDEN. The raw bytes on disk contain unexecuted directives — they are',
  'NOT the content. The content only exists AFTER the MarkdownAI engine has',
  'processed every directive and substituted the results back in.',
  '',
  'Directives that may be present and that MUST be executed by the engine',
  '(NEVER by me): @if, @foreach, @test, @hash, @read-frontmatter, @date,',
  '@count, @list, @read, @include, @import, @call, @phase, @set, @env,',
  '@update-frontmatter, @render-template, @mkdir, @copy, @append-if-missing,',
  '@query, @markdownai-detect, @plugin-data, @plugin-meta, @plugin-detect,',
  '@plugin-layout, @plugin-conventions.',
  '',
  'RULE: NEVER run a directive yourself. NEVER guess at what a directive',
  'resolves to. NEVER read a .md file with an `@markdownai` header through',
  'any tool other than the MarkdownAI MCP server below. There is no fallback,',
  'no manual interpretation, no inline-execute — the MCP server is the ONLY',
  'way to get the content of a MarkdownAI document.',
  '',
  'The MCP server\'s job is to run every directive in the document, substitute',
  'the result back into the text, and return rendered text to me. Direct file',
  'reads bypass the engine and leave me with raw source — useless and wrong.',
  '',
  'NOTE on CLAUDE-MarkdownAI.md specifically:',
  '  If the blocked file is named `CLAUDE-MarkdownAI.md`, its rendered content',
  '  was already injected into your session context by the SessionStart hook',
  '  at the start of this session - look in your existing context, do not',
  '  re-fetch. If the content is stale (e.g. long session, file changed),',
  '  use `mcp__markdownai__read_file` with `{ path: "CLAUDE-MarkdownAI.md",',
  '  cwd: "<project root>" }` to fetch a fresh render.',
  '',
  'Route this read through the markdownai MCP server. The available tools:',
  '',
  '1. mcp__markdownai__list_phases',
  '   args:    { filePath: string, cwd: string }',
  '   returns: { phases: Array<{name: string, transitions: Array<...>}>, error?: string }',
  '   use:     to discover which @phase blocks exist in the file. Always',
  '            call this first when opening a new MarkdownAI document.',
  '',
  '2. mcp__markdownai__resolve_phase                    <-- PRIMARY TOOL',
  '   args:    { filePath: string, phase: string, cwd: string, env?: Record<string,string> }',
  '   returns: { content: string, warnings: string[], found: boolean, error?: string }',
  '   use:     to read a specific phase. All directives inside the @phase',
  '            block fire and their output is substituted into `content`.',
  '            This is the main way you READ a MarkdownAI document.',
  '',
  '3. mcp__markdownai__next_phase',
  '   args:    { filePath: string, currentPhase: string, cwd: string }',
  '   returns: { phase: string|null, found: boolean, error?: string }',
  '   use:     to follow @on complete -> @phase <next> transitions between',
  '            phases. Pass the current phase name, get the next name.',
  '',
  '4. mcp__markdownai__render',
  '   args:    { file: string, phase?: string, env?: Record<string,string>,',
  '              format?: \'ai\'|\'standard\' }',
  '   returns: { content: string, isMarkdownAI: boolean, warnings: string[] }',
  '   use:     friendly alias for read_file with `file` parameter (consistent',
  '            with list_phases / resolve_phase / call_macro / get_constraints).',
  '            Renders a full MarkdownAI document with all directives executed.',
  '',
  '5. mcp__markdownai__read_file',
  '   args:    { path: string, phase?: string, env?: Record<string,string>,',
  '              format?: \'ai\'|\'standard\', skillArgs?: string,',
  '              skillDir?: string, skillSessionId?: string,',
  '              skillNamedArgs?: Record<string,string> }',
  '   returns: { content: string, isMarkdownAI: boolean, warnings: string[] }',
  '   use:     full-document render (all phases + top-level content). Pass',
  '            `phase` to scope to one phase (equivalent to resolve_phase).',
  '            Pass `skillArgs` / `skillDir` when this file is a Claude Code',
  '            slash command and you need $ARGUMENTS substitution.',
  '',
  '6. mcp__markdownai__execute_directive',
  '   args:    { directive: string, cwd: string, env?: Record<string,string> }',
  '   returns: { output: string, warnings: string[], errors: string[], events: [] }',
  '   use:     to execute a single directive in isolation. Allowlisted:',
  '            @env, @date, @count, @list, @read, @read-frontmatter, @hash,',
  '            @if, @markdownai-detect, @plugin-data. NOT allowed:',
  '            @query/@shell/@http/@db/@include/@import/@connect/@call',
  '            (those need document context — call_macro for @call).',
  '',
  '7. mcp__markdownai__call_macro',
  '   args:    { filePath: string, macroName: string, args: Record<string,string>, cwd: string, env?: Record<string,string> }',
  '   returns: { output: string, warnings: string[], found: boolean, error?: string }',
  '   use:     to invoke a @define-d macro from this file or its @import-ed',
  '            shared library.',
  '',
  '8. mcp__markdownai__get_constraints',
  '   args:    { filePath: string, cwd: string }',
  '   returns: { constraints: Array<{id, severity, body}>, isMarkdownAI: boolean, blocked?: boolean }',
  '   use:     to surface @constraint declarations (immutable rules) without',
  '            rendering the whole document.',
  '',
  '9. mcp__markdownai__get_env',
  '   args:    { key: string, fallback?: string, allowedKeys?: string[] }',
  '   returns: { value: string, found: boolean, denied?: boolean }',
  '   use:     to read a single env var through the security gate. Keys',
  '            containing SECRET/TOKEN/PASSWORD/KEY are denied.',
  '',
  '10. mcp__markdownai__invalidate_cache',
  '    args:    { directive?: string }',
  '    returns: { cleared: { session: boolean, persist: boolean }, error?: string }',
  '    use:     when cached directive output (e.g. @http with @cache persist)',
  '             is stale and you need a fresh evaluation.',
  '',
  '11. mcp__markdownai__available_directives           <-- DIRECTIVE CATALOG',
  '    args:    { category?: string, format?: \'compact\'|\'full\' }',
  '    returns: { directives: Array<{name, syntax, parameters, examples, category, ...}>, count: number }',
  '    use:     to discover EVERY directive the engine knows about. Returns',
  '             the complete catalog with usage, parameters, examples, and',
  '             security notes. Call this when you need to know what is',
  '             available, what each directive does, or how to invoke it.',
  '             There is no need to guess at directive names or syntax — this',
  '             tool is the authoritative source.',
  '',
  'COMPLETE TOOL SET: there are EXACTLY 11 tools in the markdownai MCP server.',
  'They are the entire surface area for working with MarkdownAI documents.',
  'If a need is not covered by one of these 11 tools, do NOT reach for Read,',
  'Bash, or any local tool — pause and re-read this list. Always one of these',
  'is the right answer.',
  '',
  'TYPICAL WORKFLOW for opening a MarkdownAI document:',
  '',
  '  Step 1: phases = mcp__markdownai__list_phases({ filePath, cwd })',
  '          -> the list of @phase block names in the file',
  '  Step 2: pick the entry phase (often "0-<something>" or the first in',
  '          the list, depending on the document):',
  '          page = mcp__markdownai__resolve_phase({ filePath, phase, cwd })',
  '  Step 3: read page.content - it is fully rendered, zero @directive',
  '          syntax inside. Do the work the phase describes.',
  '  Step 4: when done with the current phase, follow the transition:',
  '          next = mcp__markdownai__next_phase({ filePath, currentPhase, cwd })',
  '  Step 5: if next.phase is non-null, resolve_phase that one. Repeat',
  '          Steps 3-5 until next.phase is null.',
  '',
  '`filePath` should match the path you just tried to Read. `cwd` should be',
  'the current project root.',
  '',
  'DO NOT retry the Read on this file - this hook will block it again.',
  'Always use the MCP tools above for any file that contains @markdownai.',
  '',
].join('\n')

export const HOOK_SCRIPT = `#!/usr/bin/env node
// MarkdownAI PreToolUse hook - installed by mai init
// Blocks direct Read of .md files in SYSTEM/INSTALLED locations that
// contain directive lines. System locations are paths under:
//   ~/.claude/mdd2/, ~/.claude/markdownai/, ~/.markdownai/,
//   ~/.claude/commands/, /usr/share/markdownai/
// These are the trees that ship rendered to Claude via the MCP — direct
// Read would expose raw directives that the engine should be running.
//
// Files OUTSIDE these system trees (the user's project source: macros,
// flows, feature docs being authored) ARE readable. The user is editing
// them; Claude needs to see the raw source to help. The engine still
// runs them via @import/@include when other docs reference them.
//
// A directive line is any line whose first non-whitespace character is
// '@' followed by an identifier (e.g. @phase, @if, @call, @markdownai,
// @define, @plugin-meta, etc.).
import { createInterface } from 'node:readline'
import { readFileSync } from 'node:fs'
import { homedir } from 'node:os'

const HOME = homedir()
const SYSTEM_ROOTS = [
  HOME + '/.claude/mdd2/',
  HOME + '/.claude/markdownai/',
  HOME + '/.markdownai/',
  HOME + '/.claude/commands/',
  '/usr/share/markdownai/',
]

function isSystemPath(filePath) {
  return SYSTEM_ROOTS.some(root => filePath.startsWith(root))
}

// Match a line whose first non-whitespace token starts with '@' followed
// by a directive-style identifier (letter/underscore start, then
// letters/digits/_/-).
const DIRECTIVE_LINE_RE = /^\\s*@[a-zA-Z_][a-zA-Z0-9_-]*/

function isMarkdownAIDocument(content) {
  const lines = content.split('\\n')
  for (const line of lines) {
    if (DIRECTIVE_LINE_RE.test(line)) return true
  }
  return false
}

const REDIRECT_MESSAGE = ${JSON.stringify(REDIRECT_MESSAGE)}

let raw = ''
if (process.stdin.isTTY) process.exit(0)
for await (const line of createInterface({ input: process.stdin })) raw += line
try {
  const data = JSON.parse(raw)
  const toolName = data.tool_name ?? ''
  if (toolName !== 'Read' && toolName !== 'read_file') process.exit(0)
  const filePath = data.tool_input?.file_path ?? data.tool_input?.path ?? ''
  if (!filePath.endsWith('.md')) process.exit(0)
  // Only enforce the no-direct-read rule for files in SYSTEM-installed
  // locations. Project source files (which the user is authoring) are
  // exempt — Claude needs raw source to help edit them.
  if (!isSystemPath(filePath)) process.exit(0)
  let content = ''
  try { content = readFileSync(filePath, 'utf8') } catch { process.exit(0) }
  if (!isMarkdownAIDocument(content)) process.exit(0)
  process.stderr.write(REDIRECT_MESSAGE)
  process.exit(2)
} catch { process.exit(0) }
`

function detectClient(): { type: ClientType; configPath: string } {
  // Claude Code
  const claudeSettings = join(homedir(), '.claude', 'settings.json')
  if (existsSync(claudeSettings)) return { type: 'claude-code', configPath: claudeSettings }
  // Cursor
  const cursorSettings = join(homedir(), '.cursor', 'settings.json')
  if (existsSync(cursorSettings)) return { type: 'cursor', configPath: cursorSettings }
  // Default to claude-code
  return { type: 'claude-code', configPath: claudeSettings }
}

export interface InitClaudeMdOptions {
  claudeMdPath?: string
  update?: boolean
}

export interface InitClaudeMdResult {
  updated: boolean
  alreadyPresent: boolean
  claudeMdPath: string
}

export function stripClaudeMdSection(content: string): string {
  const startIdx = content.indexOf(SECTION_START_MARKER)
  if (startIdx === -1) return content

  const endIdx = content.indexOf(SECTION_END_MARKER, startIdx)
  const blockEnd = endIdx === -1
    ? content.length
    : endIdx + SECTION_END_MARKER.length

  const before = content.slice(0, startIdx).replace(/\n+$/, '')
  const after = content.slice(blockEnd).replace(/^\n+/, '')

  if (before === '' && after === '') return ''
  if (before === '') return after
  if (after === '') return before
  return before + '\n\n' + after
}

export function runInitClaudeMd(options: InitClaudeMdOptions = {}): InitClaudeMdResult {
  const claudeMdPath = options.claudeMdPath ?? join(homedir(), '.claude', 'CLAUDE.md')

  if (checkAbsolutePath(claudeMdPath).level === 'blocked') {
    return { updated: false, alreadyPresent: false, claudeMdPath }
  }

  if (existsSync(claudeMdPath)) {
    const existing = readFileSync(claudeMdPath, 'utf8')
    if (existing.includes(SECTION_START_MARKER)) {
      if (!options.update) return { updated: false, alreadyPresent: true, claudeMdPath }
      const stripped = stripClaudeMdSection(existing)
      const separator = stripped.endsWith('\n') ? '\n' : '\n\n'
      writeFileSync(claudeMdPath, stripped + separator + CLAUDE_MD_SECTION + '\n', 'utf8')
      return { updated: true, alreadyPresent: true, claudeMdPath }
    }
    const separator = existing.endsWith('\n') ? '\n' : '\n\n'
    writeFileSync(claudeMdPath, existing + separator + CLAUDE_MD_SECTION + '\n', 'utf8')
  } else {
    mkdirSync(dirname(claudeMdPath), { recursive: true })
    writeFileSync(claudeMdPath, CLAUDE_MD_SECTION + '\n', 'utf8')
  }

  return { updated: true, alreadyPresent: false, claudeMdPath }
}

function ensureHookFile(hookDir: string, hookPath: string): void {
  mkdirSync(hookDir, { recursive: true })
  const hookAlreadyExists = existsSync(hookPath) &&
    readFileSync(hookPath, 'utf8').includes('MarkdownAI PreToolUse hook')
  if (!hookAlreadyExists) {
    writeFileSync(hookPath, HOOK_SCRIPT, 'utf8')
  }
}

/**
 * The SessionStart hook script. Installed to ~/.markdownai/hooks/sessionStart.mjs
 * by `mai init`. Runs at session start (source: `startup` | `resume` | `clear` |
 * `compact`) and injects the rendered content of `<cwd>/CLAUDE-MarkdownAI.md`
 * into Claude's session context via the `hookSpecificOutput.additionalContext`
 * JSON channel.
 *
 * Design intent:
 *   - The user's CLAUDE.md is NEVER touched. The hook makes zero filesystem
 *     writes - the rendered content lives only in conversation context for
 *     this session.
 *   - `CLAUDE-MarkdownAI.md` is a separate file the user creates and edits.
 *     It contains `@markdownai` directives that resolve at session start.
 *   - All directives in `CLAUDE-MarkdownAI.md` are rendered in one shot via
 *     `mai render`. Use flat directives (`@date`, `@count`, `@list`,
 *     `@read-frontmatter`, `@if`, `@foreach`, `@set`, `@env`, `@call`, etc.)
 *     - NOT `@phase`, which is for MCP-served lazy-load documents.
 *   - Direct Read of `CLAUDE-MarkdownAI.md` is intercepted by the PreToolUse
 *     hook (it's a MarkdownAI doc). Claude must use the MCP server if it
 *     ever needs to re-fetch the rendered content mid-session.
 *
 * No-op when:
 *   - `CLAUDE-MarkdownAI.md` doesn't exist (project hasn't adopted the feature)
 *   - `mai` is not on PATH (warn to stderr, exit 0)
 *   - `mai render` fails (warn to stderr, exit 0; Claude sees no extra context)
 *
 * Never blocks session start - always exits 0.
 */
export const SESSION_START_HOOK_SCRIPT = `#!/usr/bin/env node
// MarkdownAI SessionStart hook - installed by mai init
//
// Renders <cwd>/CLAUDE-MarkdownAI.md via the mai CLI and injects the result
// into Claude's session context via hookSpecificOutput.additionalContext.
//
// CLAUDE.md is never touched. CLAUDE-MarkdownAI.md is a separate file the
// user creates with @markdownai directives. The render output lives only
// in conversation context for this session - never written to disk.
//
// No-op when CLAUDE-MarkdownAI.md doesn't exist or mai render fails.
// Never blocks session start (always exits 0).
import { createInterface } from 'node:readline'
import { existsSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { join } from 'node:path'

let raw = ''
if (process.stdin.isTTY) process.exit(0)
for await (const line of createInterface({ input: process.stdin })) raw += line

try {
  const data = raw ? JSON.parse(raw) : {}
  const cwd = data.cwd || data.tool_input?.cwd || process.cwd()
  const filePath = join(cwd, 'CLAUDE-MarkdownAI.md')

  if (!existsSync(filePath)) process.exit(0)

  const result = spawnSync('mai', ['render', filePath], {
    encoding: 'utf8',
    cwd,
    timeout: 30_000,
  })

  if (result.error) {
    // mai CLI not on PATH (ENOENT) or another spawn-level failure.
    process.stderr.write('MarkdownAI SessionStart hook: cannot invoke "mai render" (' + String(result.error) + '). Session continues without CLAUDE-MarkdownAI.md context.\\n')
    process.exit(0)
  }

  if (result.status !== 0) {
    process.stderr.write('MarkdownAI SessionStart hook: mai render failed for CLAUDE-MarkdownAI.md. Session continues without injected context.\\n')
    if (result.stderr) process.stderr.write(result.stderr + '\\n')
    process.exit(0)
  }

  const rendered = result.stdout || ''
  if (rendered.trim() === '') process.exit(0)

  const payload = {
    hookSpecificOutput: {
      hookEventName: 'SessionStart',
      additionalContext: rendered,
    },
  }
  process.stdout.write(JSON.stringify(payload))
  process.exit(0)
} catch (err) {
  process.stderr.write('MarkdownAI SessionStart hook error: ' + String(err) + '\\n')
  process.exit(0)
}
`

function ensureSessionStartHookFile(hookDir: string, hookPath: string): void {
  mkdirSync(hookDir, { recursive: true })
  const hookAlreadyExists = existsSync(hookPath) &&
    readFileSync(hookPath, 'utf8').includes('MarkdownAI SessionStart hook')
  if (!hookAlreadyExists) {
    writeFileSync(hookPath, SESSION_START_HOOK_SCRIPT, 'utf8')
  }
}

interface HookUpdateResult {
  alreadyInstalled: boolean
  error?: string
}

interface McpUpdateResult {
  alreadyInstalled: boolean
  serverName: string
  command: string
  error?: string
}

/**
 * Register the @markdownai/mcp MCP server in Claude Code's main config
 * (~/.claude.json — distinct from the hook settings.json that
 * updateClientHooks writes to). Without this entry the MCP tools
 * (mcp__markdownai__list_phases, resolve_phase, next_phase, etc. — see the
 * REDIRECT_MESSAGE catalog above) are not exposed to Claude even though
 * the hooks render @markdownai documents transparently. Registering both
 * is the canonical mai init contract: hooks for transparent render +
 * MCP for explicit phase navigation.
 *
 * The MCP server ships as a bin (`mai-serve`) from @markdownai/mcp, which
 * is a regular dep of @markdownai/core — so `npm install -g
 * @markdownai/core` puts mai-serve on PATH. The registration uses the bin
 * name; if the user's PATH doesn't include the global npm prefix bin
 * directory, Claude Code's error message will be specific enough for the
 * user to either fix PATH or replace the command with a full node + path.
 */
function updateClientMcpServer(claudeConfigPath: string): McpUpdateResult {
  const serverName = 'markdownai'
  const desiredCommand = 'mai-serve'

  let config: Record<string, unknown> = {}
  if (existsSync(claudeConfigPath)) {
    try {
      config = JSON.parse(readFileSync(claudeConfigPath, 'utf8')) as Record<string, unknown>
    } catch (err) {
      return {
        alreadyInstalled: false,
        serverName,
        command: desiredCommand,
        error: `Cannot parse Claude config at ${claudeConfigPath}: ${String(err)}`,
      }
    }
  }

  const mcpServersRaw = config['mcpServers']
  const mcpServers: Record<string, unknown> =
    mcpServersRaw !== undefined && typeof mcpServersRaw === 'object' && mcpServersRaw !== null && !Array.isArray(mcpServersRaw)
      ? (mcpServersRaw as Record<string, unknown>)
      : {}

  const existing = mcpServers[serverName]
  const desired = { command: desiredCommand, args: [] as string[] }

  // Match by package-name substring OR by exact command match so we don't
  // duplicate when the user has manually registered with `npx -y
  // @markdownai/mcp` or a similar variant.
  const alreadyInstalled = matchesMarkdownAi(existing) || matchesMarkdownAi(desired)
    && existing !== undefined
    && JSON.stringify(existing) === JSON.stringify(desired)

  if (alreadyInstalled) {
    return { alreadyInstalled: true, serverName, command: desiredCommand }
  }

  mcpServers[serverName] = desired
  config['mcpServers'] = mcpServers

  try {
    mkdirSync(dirname(claudeConfigPath), { recursive: true })
    writeFileSync(claudeConfigPath, JSON.stringify(config, null, 2), 'utf8')
  } catch (err) {
    return {
      alreadyInstalled: false,
      serverName,
      command: desiredCommand,
      error: `Cannot write Claude config at ${claudeConfigPath}: ${String(err)}`,
    }
  }

  return { alreadyInstalled: false, serverName, command: desiredCommand }
}

function matchesMarkdownAi(server: unknown): boolean {
  if (server === null || typeof server !== 'object' || Array.isArray(server)) return false
  const view = server as { command?: unknown; args?: unknown }
  const command = typeof view.command === 'string' ? view.command : ''
  const args = Array.isArray(view.args) ? view.args.filter((a): a is string => typeof a === 'string') : []
  const joined = [command, ...args].join(' ')
  if (joined.includes('@markdownai/mcp')) return true
  if (command === 'mai-serve' || command.endsWith('/mai-serve')) return true
  if (command.endsWith('markdownai-mcp')) return true
  return false
}

function updateClientHooks(configPath: string, hookPath: string, sessionStartHookPath: string): HookUpdateResult {
  let config: Record<string, unknown> = {}
  if (existsSync(configPath)) {
    try {
      config = JSON.parse(readFileSync(configPath, 'utf8')) as Record<string, unknown>
    } catch (err) {
      return { alreadyInstalled: false, error: `Cannot parse settings file at ${configPath}: ${String(err)}` }
    }
  }
  const hooks = (config['hooks'] as Record<string, unknown> | undefined) ?? {}

  // PreToolUse: block direct Read of MarkdownAI documents and redirect
  // Claude to the MCP server tools.
  const preEntries = Array.isArray(hooks['PreToolUse']) ? hooks['PreToolUse'] as unknown[] : []
  const preAlreadyInstalled = preEntries.some((entry: unknown) => {
    const e = entry as Record<string, unknown>
    const subhooks = Array.isArray(e['hooks']) ? e['hooks'] as Array<Record<string, unknown>> : []
    return subhooks.some(h => typeof h['command'] === 'string' && h['command'].includes('preToolUse'))
  })
  if (!preAlreadyInstalled) {
    hooks['PreToolUse'] = [...preEntries, { matcher: 'Read', hooks: [{ type: 'command', command: `node ${hookPath}` }] }]
  }

  // SessionStart: render CLAUDE-MarkdownAI.md and inject as additionalContext
  const startEntries = Array.isArray(hooks['SessionStart']) ? hooks['SessionStart'] as unknown[] : []
  const startAlreadyInstalled = startEntries.some((entry: unknown) => {
    const e = entry as Record<string, unknown>
    const subhooks = Array.isArray(e['hooks']) ? e['hooks'] as Array<Record<string, unknown>> : []
    return subhooks.some(h => typeof h['command'] === 'string' && h['command'].includes('sessionStart'))
  })
  if (!startAlreadyInstalled) {
    hooks['SessionStart'] = [...startEntries, { hooks: [{ type: 'command', command: `node ${sessionStartHookPath}` }] }]
  }

  const alreadyInstalled = preAlreadyInstalled && startAlreadyInstalled
  if (!alreadyInstalled) {
    config['hooks'] = hooks
    mkdirSync(dirname(configPath), { recursive: true })
    writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8')
  }
  return { alreadyInstalled }
}

export function runInit(options: InitOptions = {}): InitResult {
  const home = options.homeDir ?? homedir()
  const detected = options.client === 'auto' || !options.client ? detectClient() : null
  const clientType = options.client && options.client !== 'auto' ? options.client : (detected?.type ?? 'claude-code')
  const configPath = clientType === 'cursor'
    ? join(home, '.cursor', 'settings.json')
    : join(home, '.claude', 'settings.json')

  if (checkAbsolutePath(configPath).level === 'blocked') {
    return { success: false, clientDetected: clientType, configPath, alreadyInstalled: false, message: `Config path blocked: ${configPath}` }
  }

  const hookDir = join(home, '.markdownai', 'hooks')
  const hookPath = join(hookDir, 'preToolUse.mjs')
  const sessionStartHookPath = join(hookDir, 'sessionStart.mjs')
  ensureHookFile(hookDir, hookPath)
  ensureSessionStartHookFile(hookDir, sessionStartHookPath)

  const result = updateClientHooks(configPath, hookPath, sessionStartHookPath)
  if (result.error) {
    return { success: false, clientDetected: clientType, configPath, alreadyInstalled: false, message: result.error }
  }

  // Register the @markdownai/mcp MCP server alongside the hooks. Hooks
  // and MCP are independent integration points; both are part of a full
  // mai init. The MCP entry lives in .claude.json (cursor uses
  // .cursor/mcp.json — punt on that for now and only register when
  // clientType === 'claude-code'; cursor users can register manually
  // via mcp.json).
  let mcpRegistration: InitResult['mcpRegistration']
  let mcpConfigPath: string | undefined
  if (clientType === 'claude-code') {
    mcpConfigPath = join(home, '.claude.json')
    if (checkAbsolutePath(mcpConfigPath).level === 'blocked') {
      mcpRegistration = {
        serverName: 'markdownai',
        command: 'mai-serve',
        alreadyInstalled: false,
        error: `Claude config path blocked: ${mcpConfigPath}`,
      }
    } else {
      const mcpResult = updateClientMcpServer(mcpConfigPath)
      mcpRegistration = {
        serverName: mcpResult.serverName,
        command: mcpResult.command,
        alreadyInstalled: mcpResult.alreadyInstalled,
        ...(mcpResult.error !== undefined ? { error: mcpResult.error } : {}),
      }
    }
  }

  const hookMessage = result.alreadyInstalled
    ? `MarkdownAI hooks already installed in ${configPath}`
    : `MarkdownAI hooks installed in ${configPath}`
  const mcpMessage = mcpRegistration === undefined
    ? ''
    : mcpRegistration.error !== undefined
      ? ` (MCP registration failed: ${mcpRegistration.error})`
      : mcpRegistration.alreadyInstalled
        ? ` and @markdownai/mcp already registered in ${mcpConfigPath ?? ''}`
        : ` and @markdownai/mcp registered in ${mcpConfigPath ?? ''}`

  return {
    success: true,
    clientDetected: clientType,
    configPath,
    alreadyInstalled: result.alreadyInstalled,
    message: hookMessage + mcpMessage,
    ...(mcpConfigPath !== undefined ? { mcpConfigPath } : {}),
    ...(mcpRegistration !== undefined ? { mcpRegistration } : {}),
  }
}
