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

interface HookUpdateResult {
  alreadyInstalled: boolean
  error?: string
}

function updateClientHooks(configPath: string, hookPath: string): HookUpdateResult {
  let config: Record<string, unknown> = {}
  if (existsSync(configPath)) {
    try {
      config = JSON.parse(readFileSync(configPath, 'utf8')) as Record<string, unknown>
    } catch (err) {
      return { alreadyInstalled: false, error: `Cannot parse settings file at ${configPath}: ${String(err)}` }
    }
  }
  const hooks = (config['hooks'] as Record<string, unknown> | undefined) ?? {}
  const existingEntries = Array.isArray(hooks['PreToolUse']) ? hooks['PreToolUse'] as unknown[] : []
  const alreadyInstalled = existingEntries.some((entry: unknown) => {
    const e = entry as Record<string, unknown>
    const subhooks = Array.isArray(e['hooks']) ? e['hooks'] as Array<Record<string, unknown>> : []
    return subhooks.some(h => typeof h['command'] === 'string' && h['command'].includes('markdownai'))
  })
  if (!alreadyInstalled) {
    hooks['PreToolUse'] = [...existingEntries, { matcher: 'Read', hooks: [{ type: 'command', command: `node ${hookPath}` }] }]
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
  ensureHookFile(hookDir, hookPath)

  const result = updateClientHooks(configPath, hookPath)
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
