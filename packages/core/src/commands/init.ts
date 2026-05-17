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

const HOOK_SCRIPT = `#!/usr/bin/env node
// MarkdownAI PreToolUse hook — installed by mai init
// Checks if .md file reads should be routed through the mai MCP server
import { createInterface } from 'node:readline'
import { readFileSync } from 'node:fs'

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
  if (!content.trimStart().startsWith('@markdownai')) process.exit(0)
  // File has @markdownai header — MCP server handles the read, block direct access
  process.stderr.write('Use the markdownai MCP tool to read this file.\\n')
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
  const existingEntries = Array.isArray(hooks['PreToolUse']) ? hooks['PreToolUse'] as unknown[] : []
  const alreadyInstalled = existingEntries.some((entry: unknown) => {
    const e = entry as Record<string, unknown>
    const subhooks = Array.isArray(e['hooks']) ? e['hooks'] as Array<Record<string, unknown>> : []
    return subhooks.some(h => typeof h['command'] === 'string' && h['command'].includes('markdownai'))
  })

  if (!alreadyInstalled) {
    const newEntry = {
      matcher: 'Read',
      hooks: [{ type: 'command', command: `node ${hookPath}` }],
    }
    hooks['PreToolUse'] = [...existingEntries, newEntry]
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
