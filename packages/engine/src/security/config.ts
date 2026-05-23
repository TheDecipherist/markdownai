import { readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

export interface ShellSecurityConfig {
  enabled: boolean
  allow_patterns: string[]
  deny_patterns: string[]
  allow_network: boolean
  require_confirmation: boolean
  audit_log: boolean
}

export interface HttpSecurityConfig {
  enabled: boolean
  allowed_domains: string[]
  denied_domains: string[]
  allowed_methods: string[]
  max_response_size: number
  timeout: number
}

export interface DbConnectionSecurityConfig {
  allowed_operations: string[]
  denied_operations: string[]
  denied_keywords: string[]
  allowed_collections: string[]
  denied_collections: string[]
  allow_raw: boolean
  readonly: boolean
  max_results: number
}

export type DbSecurityConfig = Record<string, DbConnectionSecurityConfig>

export interface FilesystemSecurityConfig {
  // Path-jail roots (v2.0+):
  //   source_root: where @import / @include resolve from
  //     "auto"          → dirname of the entry document (recommended default)
  //     "cwd"           → process working directory
  //     <absolute path> → pin to a specific directory
  //   data_root: where @list / @read / @tree / @count / @date file= / file.*
  //              and other data operations resolve from
  //     "cwd"           → process working directory (recommended for skill mode)
  //     "auto"          → dirname of entry document (recommended for plain CLI)
  //     <absolute path> → pin to a specific directory
  // Both default to "auto" when unset. The CLI's `mai render` keeps "auto" for
  // backward-compatible behavior. MCP read_file / skill mode passes "cwd" so a
  // skill can see the user's project.
  source_root?: string
  data_root?: string
  // Additional whitelisted paths beyond the corresponding root. Glob patterns
  // accepted. Variable expansion supported: ${HOME}, ${CLAUDE_SKILL_DIR}, and
  // any process env var, evaluated at check time.
  allowed_source_paths: string[]
  allowed_data_paths: string[]
  // Write directives (@mkdir, @copy, @append-if-missing) — disabled by default.
  // When enabled, writes may happen inside write_root and any allowed_write_paths.
  // Built-in always-block list (.env, credentials, .ssh, .git, etc.) is immutable.
  write_enabled?: boolean
  write_root?: string                // "cwd" | "auto" | absolute path; default "cwd"
  allowed_write_paths?: string[]
  // Pre-existing fields (apply to all filesystem ops):
  additional_block_paths: string[]
  additional_block_patterns: string[]
  allow_unmasked_paths: string[]
  allow_unmasked_patterns: string[]
  user_masking_patterns: string[]
}

export interface EventTransportConfig {
  type: 'http' | 'file' | 'db'
  url?: string
  headers?: Record<string, string>
  path?: string
  connection?: string
  collection?: string
}

export interface EventSecurityConfig {
  allowed_transports: string[]
  allow_env_interpolation: boolean
  max_value_length: number
  onError: 'silence' | 'warn' | 'fail'
  transports?: Record<string, EventTransportConfig>
}

export interface SecurityJsonConfig {
  shell: ShellSecurityConfig
  http: HttpSecurityConfig
  db: DbSecurityConfig
  filesystem: FilesystemSecurityConfig
  event: EventSecurityConfig
}

export function defaultSecurityConfig(): SecurityJsonConfig {
  return {
    shell: {
      enabled: false,
      allow_patterns: [],
      deny_patterns: [],
      allow_network: false,
      require_confirmation: false,
      audit_log: true,
    },
    http: {
      enabled: false,
      allowed_domains: [],
      denied_domains: [],
      allowed_methods: ['GET'],
      max_response_size: 1_048_576,
      timeout: 10_000,
    },
    db: {},
    filesystem: {
      allowed_source_paths: [],
      allowed_data_paths: [],
      additional_block_paths: [],
      additional_block_patterns: [],
      allow_unmasked_paths: [],
      allow_unmasked_patterns: [],
      user_masking_patterns: [],
      // source_root and data_root deliberately left unset — callers (CLI vs MCP)
      // pick the right default per mode.
    },
    event: {
      allowed_transports: [],
      allow_env_interpolation: false,
      max_value_length: 500,
      onError: 'silence',
    },
  }
}

export function loadSecurityConfig(filePath?: string): SecurityJsonConfig {
  const path = filePath ?? join(homedir(), '.markdownai', 'security.json')
  let raw: string
  try { raw = readFileSync(path, 'utf8') } catch { return defaultSecurityConfig() }
  try {
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      process.stderr.write(`[markdownai] security config invalid (${path}): expected object\n`)
      return defaultSecurityConfig()
    }
    const loaded = parsed as Record<string, unknown>
    const defaults = defaultSecurityConfig()
    return {
      shell: { ...defaults.shell, ...(typeof loaded['shell'] === 'object' && loaded['shell'] !== null && !Array.isArray(loaded['shell']) ? loaded['shell'] as Partial<ShellSecurityConfig> : {}) },
      http: { ...defaults.http, ...(typeof loaded['http'] === 'object' && loaded['http'] !== null && !Array.isArray(loaded['http']) ? loaded['http'] as Partial<HttpSecurityConfig> : {}) },
      db: (typeof loaded['db'] === 'object' && loaded['db'] !== null && !Array.isArray(loaded['db']) ? loaded['db'] as DbSecurityConfig : {}),
      filesystem: { ...defaults.filesystem, ...(typeof loaded['filesystem'] === 'object' && loaded['filesystem'] !== null && !Array.isArray(loaded['filesystem']) ? loaded['filesystem'] as Partial<FilesystemSecurityConfig> : {}) },
      event: { ...defaults.event, ...(typeof loaded['event'] === 'object' && loaded['event'] !== null && !Array.isArray(loaded['event']) ? loaded['event'] as Partial<EventSecurityConfig> : {}) },
    }
  } catch (err) {
    process.stderr.write(`[markdownai] security config parse error (${path}): ${String(err)}\n`)
    return defaultSecurityConfig()
  }
}
