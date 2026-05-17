import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { join, dirname } from 'node:path'
import { CLAUDE_MD_SECTION, SECTION_START_MARKER, SECTION_END_MARKER } from '../templates/claude-section.js'

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

const HOOK_SCRIPT = `// MarkdownAI PreToolUse hook — installed by mai init
// Routes .md file reads through mai MCP server when @markdownai header detected
export default async function(tool, input) {
  if (tool !== 'Read' && tool !== 'read_file') return input
  const path = input.file_path ?? input.path ?? ''
  if (!path.endsWith('.md')) return input
  const { shouldRoute } = await import('@markdownai/core/hook')
  const decision = shouldRoute(path)
  if (decision.route === 'mcp') {
    return { ...input, _routed_by_mai: true }
  }
  return input
}`

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

  if (existsSync(claudeMdPath)) {
    const existing = readFileSync(claudeMdPath, 'utf8')
    if (existing.includes(SECTION_START_MARKER)) {
      return { updated: false, alreadyPresent: true, claudeMdPath }
    }
    const separator = existing.endsWith('\n') ? '\n' : '\n\n'
    writeFileSync(claudeMdPath, existing + separator + CLAUDE_MD_SECTION + '\n', 'utf8')
  } else {
    mkdirSync(dirname(claudeMdPath), { recursive: true })
    writeFileSync(claudeMdPath, CLAUDE_MD_SECTION + '\n', 'utf8')
  }

  return { updated: true, alreadyPresent: false, claudeMdPath }
}

export function runInit(options: InitOptions = {}): InitResult {
  const detected = options.client === 'auto' || !options.client ? detectClient() : null
  const clientType = options.client && options.client !== 'auto' ? options.client : (detected?.type ?? 'claude-code')

  let configPath: string
  if (clientType === 'claude-code') {
    configPath = join(homedir(), '.claude', 'settings.json')
  } else if (clientType === 'cursor') {
    configPath = join(homedir(), '.cursor', 'settings.json')
  } else {
    configPath = join(homedir(), '.claude', 'settings.json')
  }

  // Write the hook file
  const hookDir = join(homedir(), '.markdownai', 'hooks')
  const hookPath = join(hookDir, 'preToolUse.mjs')
  mkdirSync(hookDir, { recursive: true })

  const hookAlreadyExists = existsSync(hookPath) &&
    readFileSync(hookPath, 'utf8').includes('MarkdownAI PreToolUse hook')

  if (!hookAlreadyExists) {
    writeFileSync(hookPath, HOOK_SCRIPT, 'utf8')
  }

  // Update AI client config to register the hook
  let config: Record<string, unknown> = {}
  if (existsSync(configPath)) {
    try { config = JSON.parse(readFileSync(configPath, 'utf8')) as Record<string, unknown> } catch { /* start fresh */ }
  }

  const hooks = (config['hooks'] as Record<string, unknown> | undefined) ?? {}
  const existingHook = hooks['preToolUse']
  const alreadyInstalled = Array.isArray(existingHook)
    ? existingHook.some((h: unknown) => typeof h === 'string' && h.includes('markdownai'))
    : existingHook === hookPath

  if (!alreadyInstalled) {
    const existing = Array.isArray(existingHook) ? existingHook as string[] : []
    hooks['preToolUse'] = [...existing, hookPath]
    config['hooks'] = hooks
    mkdirSync(dirname(configPath), { recursive: true })
    writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8')
  }

  return {
    success: true,
    clientDetected: clientType,
    configPath,
    alreadyInstalled,
    message: alreadyInstalled
      ? `MarkdownAI hook already installed in ${configPath}`
      : `MarkdownAI hook installed in ${configPath}`,
  }
}
