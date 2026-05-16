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
  denied_keywords: string[]
  allowed_collections: string[]
  readonly: boolean
  max_results: number
}

export type DbSecurityConfig = Record<string, DbConnectionSecurityConfig>

export interface FilesystemSecurityConfig {
  additional_block_paths: string[]
  additional_block_patterns: string[]
  allow_unmasked_paths: string[]
  allow_unmasked_patterns: string[]
  user_masking_patterns: string[]
}

export interface SecurityJsonConfig {
  shell: ShellSecurityConfig
  http: HttpSecurityConfig
  db: DbSecurityConfig
  filesystem: FilesystemSecurityConfig
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
      additional_block_paths: [],
      additional_block_patterns: [],
      allow_unmasked_paths: [],
      allow_unmasked_patterns: [],
      user_masking_patterns: [],
    },
  }
}

export function loadSecurityConfig(filePath?: string): SecurityJsonConfig {
  const path = filePath ?? join(homedir(), '.markdownai', 'security.json')
  let raw: string
  try { raw = readFileSync(path, 'utf8') } catch { return defaultSecurityConfig() }
  try {
    const loaded = JSON.parse(raw) as Partial<SecurityJsonConfig>
    const defaults = defaultSecurityConfig()
    return {
      shell: { ...defaults.shell, ...(loaded.shell ?? {}) },
      http: { ...defaults.http, ...(loaded.http ?? {}) },
      db: { ...(loaded.db ?? {}) },
      filesystem: { ...defaults.filesystem, ...(loaded.filesystem ?? {}) },
    }
  } catch (err) {
    process.stderr.write(`[markdownai] security config parse error (${path}): ${String(err)}\n`)
    return defaultSecurityConfig()
  }
}
