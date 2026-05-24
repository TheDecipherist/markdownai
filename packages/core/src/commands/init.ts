import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { join, dirname } from 'node:path'
import { CLAUDE_MD_SECTION, SECTION_START_MARKER, SECTION_END_MARKER } from '../templates/claude-section.js'
import { checkAbsolutePath } from '@markdownai/engine'

export type ClientType = 'claude-code' | 'cursor' | 'auto'

export interface InitOptions {
  client?: ClientType
  cwd?: string
}

export interface InitResult {
  success: boolean
  clientDetected: string
  configPath: string
  alreadyInstalled: boolean
  message: string
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
  const lines = content.split('\n')
  let i = 0
  // Skip leading blank lines
  while (i < lines.length && (lines[i] ?? '').trim() === '') i++
  if (i >= lines.length) return false

  // Case 1: first non-blank line starts with `@markdownai`
  if ((lines[i] ?? '').trimStart().startsWith('@markdownai')) return true

  // Case 2: leading YAML frontmatter, then `@markdownai`
  if ((lines[i] ?? '').trim() === '---') {
    for (let j = i + 1; j < lines.length; j++) {
      if ((lines[j] ?? '').trim() === '---') {
        let k = j + 1
        while (k < lines.length && (lines[k] ?? '').trim() === '') k++
        return k < lines.length && (lines[k] ?? '').trimStart().startsWith('@markdownai')
      }
    }
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
  'This file is a MarkdownAI document. Reading it directly via Read/read_file',
  'would expose unrendered directive syntax (@if, @foreach, @test, @hash,',
  '@read-frontmatter, @date, @count, @list, @read, @include, @import, @call,',
  '@phase, @set, @env, @update-frontmatter, @render-template, @mkdir, @copy,',
  '@append-if-missing, @query, etc.) - the engine has NOT executed them yet.',
  'The MCP server\'s job is to run every directive in a phase and substitute',
  'the result back into the document text, then return rendered text to you.',
  'Direct file reads bypass the engine and leave you with raw source.',
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
  '4. mcp__markdownai__read_file',
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
  '5. mcp__markdownai__execute_directive',
  '   args:    { directive: string, cwd: string, env?: Record<string,string> }',
  '   returns: { output: string, warnings: string[], errors: string[], events: [] }',
  '   use:     to execute a single directive in isolation. Allowlisted:',
  '            @env, @date, @count, @list, @read, @read-frontmatter, @hash,',
  '            @if. NOT allowed: @query/@shell/@http/@db/@include/@import/',
  '            @connect/@call (those need document context).',
  '',
  '6. mcp__markdownai__call_macro',
  '   args:    { filePath: string, macroName: string, args: Record<string,string>, cwd: string, env?: Record<string,string> }',
  '   returns: { output: string, warnings: string[], found: boolean, error?: string }',
  '   use:     to invoke a @define-d macro from this file or its @import-ed',
  '            shared library.',
  '',
  '7. mcp__markdownai__get_constraints',
  '   args:    { filePath: string, cwd: string }',
  '   returns: { constraints: Array<{id, severity, body}>, isMarkdownAI: boolean, blocked?: boolean }',
  '   use:     to surface @constraint declarations (immutable rules) without',
  '            rendering the whole document.',
  '',
  '8. mcp__markdownai__get_env',
  '   args:    { key: string, fallback?: string, allowedKeys?: string[] }',
  '   returns: { value: string, found: boolean, denied?: boolean }',
  '   use:     to read a single env var through the security gate. Keys',
  '            containing SECRET/TOKEN/PASSWORD/KEY are denied.',
  '',
  '9. mcp__markdownai__invalidate_cache',
  '   args:    { directive?: string }',
  '   returns: { cleared: { session: boolean, persist: boolean }, error?: string }',
  '   use:     when cached directive output (e.g. @http with @cache persist)',
  '            is stale and you need a fresh evaluation.',
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
// Blocks direct Read of any .md file that is a MarkdownAI document (bare
// @markdownai header OR YAML frontmatter then @markdownai). Returns an
// ironclad message listing every MCP tool so Claude knows how to proceed.
import { createInterface } from 'node:readline'
import { readFileSync } from 'node:fs'

function isMarkdownAIDocument(content) {
  const lines = content.split('\\n')
  let i = 0
  while (i < lines.length && (lines[i] ?? '').trim() === '') i++
  if (i >= lines.length) return false
  if ((lines[i] ?? '').trimStart().startsWith('@markdownai')) return true
  if ((lines[i] ?? '').trim() === '---') {
    for (let j = i + 1; j < lines.length; j++) {
      if ((lines[j] ?? '').trim() === '---') {
        let k = j + 1
        while (k < lines.length && (lines[k] ?? '').trim() === '') k++
        return k < lines.length && (lines[k] ?? '').trimStart().startsWith('@markdownai')
      }
    }
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

function ensureSessionStartHookFile(hookDir: string, hookPath: string): void {
  mkdirSync(hookDir, { recursive: true })
  const hookAlreadyExists = existsSync(hookPath) &&
    readFileSync(hookPath, 'utf8').includes('MarkdownAI SessionStart hook')
  if (!hookAlreadyExists) {
    writeFileSync(hookPath, SESSION_START_HOOK_SCRIPT, 'utf8')
  }
}

/**
 * Directives that are SAFE to use in CLAUDE.md.
 *
 * CLAUDE.md is loaded into Claude's system prompt at session start (one shot,
 * synchronous). The directives allowed here must:
 *   - resolve INSTANTLY (no network, no shell, no test runners)
 *   - have NO SIDE EFFECTS on disk (no @mkdir/@copy/@update-frontmatter/...)
 *   - not depend on lazy/phase-based loading (@phase / @on are for MCP only)
 *
 * The render is one shot per session start - it must not hang, must not
 * mutate the project, and must not require Claude-mediated steps.
 */
export const CLAUDE_MD_ALLOWED_DIRECTIVES = [
  '@markdownai',        // header
  '@date',              // current date - instant
  '@count',             // file/dir count - fast fs op
  '@list',              // directory listing - fast fs op
  '@read',              // file read - fast
  '@read-frontmatter',  // file read + regex - fast
  '@hash',              // file read + crypto - fast
  '@tree',              // directory walk - fast
  '@if',                // condition eval - instant
  '@elseif', '@else', '@endif',
  '@foreach',           // iteration - depends on body but iteration itself is instant
  '@set',               // value binding - instant
  '@env',               // env var read - instant
  '@call',              // macro invocation (body must also follow these rules)
  '@import',            // load macros from another file - fast
  '@include',           // inline file content - fast
  '@define', '@define-concept', '@constraint', '@note', '@prompt', '@section',
  '@chunk-boundary',
  '@end',               // closing tag
] as const

/**
 * Directives that are REFUSED in CLAUDE.md. The hook checks the source for
 * any of these (at line start) and refuses to render if found, leaving the
 * existing CLAUDE.md intact and printing a clear explanation.
 *
 * Each refused directive has a category so the hook message can explain
 * exactly why each one is blocked.
 */
export const CLAUDE_MD_REFUSED_DIRECTIVES: Record<string, string> = {
  // Lazy / phase constructs - meaningless in a one-shot session-init render
  '@phase': 'phase (lazy-load construct; CLAUDE.md is one-shot, not phased)',
  '@on':    'on-complete transition (only meaningful inside @phase blocks)',
  // Slow / async - violate the "instant + synchronous" rule
  '@test':  'test (runs the project test suite - too slow for session init)',
  '@check': 'check (runs typecheck/lint - too slow for session init)',
  '@http':  'http (network call - async and can hang)',
  '@query': 'query (arbitrary shell - can be slow or block)',
  '@db':    'db (database query - async and can hang)',
  // Side-effecting writes - CLAUDE.md is for READING project state, not changing it
  '@mkdir':              'mkdir (filesystem write; CLAUDE.md must be read-only)',
  '@copy':               'copy (filesystem write)',
  '@append-if-missing':  'append-if-missing (filesystem write)',
  '@update-frontmatter': 'update-frontmatter (filesystem write)',
  '@render-template':    'render-template (filesystem write)',
}

/**
 * Scan CLAUDE.md source for any refused directives appearing at line-start
 * (the only position where the parser recognizes them as live directives).
 * Returns the list of refused tokens found, in the order they appear in the
 * source.
 *
 * Exported for unit tests.
 */
export function findRefusedClaudeMdDirectives(source: string): string[] {
  const found = new Set<string>()
  const lines = source.split('\n')
  for (const line of lines) {
    const trimmed = line.trimStart()
    for (const directive of Object.keys(CLAUDE_MD_REFUSED_DIRECTIVES)) {
      // Match `@foo ` or `@foo` at end of line - bare directive token, not
      // inline mention. The parser uses the same rule.
      if (trimmed === directive || trimmed.startsWith(`${directive} `)) {
        found.add(directive)
        break
      }
    }
  }
  return [...found]
}

/**
 * The full message printed when the SessionStart hook refuses to render
 * CLAUDE.md.mai because the source contains directives not allowed in
 * CLAUDE.md. Lists the offending tokens and the full allowed/refused rules.
 */
export function buildSessionStartRefusalMessage(refused: string[]): string {
  const lines = [
    'MarkdownAI SessionStart hook: refusing to render CLAUDE.md.mai.',
    '',
    'The source contains directives that are NOT allowed in CLAUDE.md:',
    ...refused.map(d => `  ${d}  -  ${CLAUDE_MD_REFUSED_DIRECTIVES[d]}`),
    '',
    'CLAUDE.md is loaded into Claude\'s system prompt at session start.',
    'The render must be instant, synchronous, and side-effect-free, because:',
    '  - Session init blocks on the hook; slow directives delay every session.',
    '  - CLAUDE.md is loaded into the prompt directly; writes to disk are not',
    '    its job and could surprise the user every time they open Claude Code.',
    '  - @phase / @on are MCP lazy-load constructs; CLAUDE.md is one-shot.',
    '',
    'Allowed directives in CLAUDE.md:',
    '  @date, @count, @list, @read, @read-frontmatter, @hash, @tree,',
    '  @if / @elseif / @else / @endif, @foreach, @set, @env,',
    '  @call (macro body must also follow these rules),',
    '  @import / @include, @define / @define-concept / @constraint,',
    '  @note / @prompt / @section.',
    '',
    'For test runs, settings reads, network calls, shell commands, or file',
    'writes, use a mode file served via the MCP server instead. CLAUDE.md is',
    'for getting Claude its bearings; everything else lives in mode files.',
    '',
    'Existing CLAUDE.md left untouched. Session will start normally.',
    '',
  ]
  return lines.join('\n')
}

/**
 * The SessionStart hook script. Installed to ~/.markdownai/hooks/sessionStart.mjs
 * by `mai init`. Runs before Claude Code's session init loads the system
 * prompt - this is the place to render CLAUDE.md.mai into CLAUDE.md.
 *
 * Convention: source lives at <cwd>/CLAUDE.md.mai. Output goes to
 * <cwd>/CLAUDE.md. If the source contains any refused directive, the hook
 * leaves the existing CLAUDE.md alone and prints a clear refusal message.
 * The hook never blocks session start (always exits 0); render failures are
 * surfaced to stderr.
 */
export const SESSION_START_HOOK_SCRIPT = `#!/usr/bin/env node
// MarkdownAI SessionStart hook - installed by mai init
// Renders <cwd>/CLAUDE.md.mai into <cwd>/CLAUDE.md before Claude Code's
// session init loads the system prompt. Refuses to render if the source
// uses any directive that isn't instantly resolvable, synchronous, and
// read-only (the rules CLAUDE.md must follow).
import { createInterface } from 'node:readline'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { join } from 'node:path'

const REFUSED = ${JSON.stringify(CLAUDE_MD_REFUSED_DIRECTIVES)}

function findRefused(source) {
  const found = new Set()
  for (const line of source.split('\\n')) {
    const trimmed = line.trimStart()
    for (const directive of Object.keys(REFUSED)) {
      if (trimmed === directive || trimmed.startsWith(directive + ' ')) {
        found.add(directive)
        break
      }
    }
  }
  return [...found]
}

const REFUSAL_HEADER = ${JSON.stringify(buildSessionStartRefusalMessage([]).split('\n').slice(0, 3).join('\n') + '\n')}
const REFUSAL_FOOTER = ${JSON.stringify(buildSessionStartRefusalMessage([]).split('\n').slice(3).join('\n'))}

function buildRefusalMessage(refused) {
  const bullets = refused.map(d => '  ' + d + '  -  ' + REFUSED[d]).join('\\n')
  return REFUSAL_HEADER + bullets + '\\n' + REFUSAL_FOOTER
}

let raw = ''
if (process.stdin.isTTY) process.exit(0)
for await (const line of createInterface({ input: process.stdin })) raw += line

try {
  const data = raw ? JSON.parse(raw) : {}
  const cwd = data.cwd || data.tool_input?.cwd || process.cwd()
  const sourcePath = join(cwd, 'CLAUDE.md.mai')
  if (!existsSync(sourcePath)) process.exit(0)

  let source = ''
  try { source = readFileSync(sourcePath, 'utf8') } catch { process.exit(0) }

  // Validation: refuse any directive that isn't instant + synchronous + read-only.
  const refused = findRefused(source)
  if (refused.length > 0) {
    process.stderr.write(buildRefusalMessage(refused))
    process.exit(0)  // never block session start
  }

  // Render via the mai CLI. Timeout caps any directive that takes too long.
  const result = spawnSync('mai', ['render', sourcePath], {
    encoding: 'utf8',
    cwd,
    timeout: 30_000,
  })
  if (result.status !== 0) {
    process.stderr.write('MarkdownAI SessionStart hook: mai render failed for CLAUDE.md.mai.\\n')
    if (result.stderr) process.stderr.write(result.stderr + '\\n')
    process.exit(0)
  }

  // Write rendered output to <cwd>/CLAUDE.md so Claude Code's session init
  // loads the fresh version into the system prompt.
  const outputPath = join(cwd, 'CLAUDE.md')
  writeFileSync(outputPath, result.stdout, 'utf8')
  process.exit(0)
} catch (err) {
  process.stderr.write('MarkdownAI SessionStart hook error: ' + String(err) + '\\n')
  process.exit(0)
}
`

interface HookUpdateResult {
  alreadyInstalled: boolean
  error?: string
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

  // PreToolUse: block direct Read of MarkdownAI documents
  const preEntries = Array.isArray(hooks['PreToolUse']) ? hooks['PreToolUse'] as unknown[] : []
  const preAlreadyInstalled = preEntries.some((entry: unknown) => {
    const e = entry as Record<string, unknown>
    const subhooks = Array.isArray(e['hooks']) ? e['hooks'] as Array<Record<string, unknown>> : []
    return subhooks.some(h => typeof h['command'] === 'string' && h['command'].includes('preToolUse'))
  })
  if (!preAlreadyInstalled) {
    hooks['PreToolUse'] = [...preEntries, { matcher: 'Read', hooks: [{ type: 'command', command: `node ${hookPath}` }] }]
  }

  // SessionStart: render CLAUDE.md.mai -> CLAUDE.md before session init
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
  const detected = options.client === 'auto' || !options.client ? detectClient() : null
  const clientType = options.client && options.client !== 'auto' ? options.client : (detected?.type ?? 'claude-code')
  const configPath = clientType === 'cursor'
    ? join(homedir(), '.cursor', 'settings.json')
    : join(homedir(), '.claude', 'settings.json')

  if (checkAbsolutePath(configPath).level === 'blocked') {
    return { success: false, clientDetected: clientType, configPath, alreadyInstalled: false, message: `Config path blocked: ${configPath}` }
  }

  const hookDir = join(homedir(), '.markdownai', 'hooks')
  const hookPath = join(hookDir, 'preToolUse.mjs')
  const sessionStartHookPath = join(hookDir, 'sessionStart.mjs')
  ensureHookFile(hookDir, hookPath)
  ensureSessionStartHookFile(hookDir, sessionStartHookPath)

  const result = updateClientHooks(configPath, hookPath, sessionStartHookPath)
  if (result.error) {
    return { success: false, clientDetected: clientType, configPath, alreadyInstalled: false, message: result.error }
  }
  return {
    success: true,
    clientDetected: clientType,
    configPath,
    alreadyInstalled: result.alreadyInstalled,
    message: result.alreadyInstalled
      ? `MarkdownAI hook already installed in ${configPath}`
      : `MarkdownAI hook installed in ${configPath}`,
  }
}
