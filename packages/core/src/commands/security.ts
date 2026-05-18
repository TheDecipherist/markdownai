import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { defaultSecurityConfig, loadSecurityConfig, checkShellCommand } from '@markdownai/engine'
import type { SecurityJsonConfig, ShellCheckResult } from '@markdownai/engine'

const SECURITY_CONFIG_PATH = join(homedir(), '.markdownai', 'security.json')

function readConfig(): SecurityJsonConfig {
  return loadSecurityConfig(SECURITY_CONFIG_PATH)
}

function writeConfig(config: SecurityJsonConfig): void {
  mkdirSync(join(homedir(), '.markdownai'), { recursive: true })
  writeFileSync(SECURITY_CONFIG_PATH, JSON.stringify(config, null, 2), 'utf8')
}

export interface SecurityResult {
  success: boolean
  message: string
  data?: unknown
}

export function securityShow(): SecurityResult {
  const config = readConfig()
  return { success: true, message: 'Current security configuration', data: config }
}

export function securityInit(): SecurityResult {
  if (existsSync(SECURITY_CONFIG_PATH)) {
    const existing = readConfig()
    return { success: true, message: 'Security config already exists', data: existing }
  }
  const config = defaultSecurityConfig()
  writeConfig(config)
  return { success: true, message: `Created ${SECURITY_CONFIG_PATH}`, data: config }
}

export function securityDisable(): SecurityResult {
  const config = readConfig()
  config.shell.enabled = false
  config.http.enabled = false
  writeConfig(config)
  return { success: true, message: 'All dynamic directives disabled' }
}

export function securityShellEnable(enable: boolean): SecurityResult {
  const config = readConfig()
  config.shell.enabled = enable
  writeConfig(config)
  return { success: true, message: `Shell execution ${enable ? 'enabled' : 'disabled'}` }
}

export function securityShellAdd(pattern: string): SecurityResult {
  if (!pattern || pattern.length > 200 || /[\x00-\x1f\x7f]/.test(pattern)) {
    return { success: false, message: `Invalid pattern: must be 1-200 printable chars` }
  }
  const config = readConfig()
  if (!config.shell.allow_patterns.includes(pattern)) {
    config.shell.allow_patterns.push(pattern)
    writeConfig(config)
  }
  return { success: true, message: `Added shell pattern: ${pattern}` }
}

export function securityShellRemove(pattern: string): SecurityResult {
  const config = readConfig()
  config.shell.allow_patterns = config.shell.allow_patterns.filter(p => p !== pattern)
  writeConfig(config)
  return { success: true, message: `Removed shell pattern: ${pattern}` }
}

export function securityShellList(): SecurityResult {
  const config = readConfig()
  return { success: true, message: 'Shell allow patterns', data: config.shell.allow_patterns }
}

export function securityShellTest(command: string): SecurityResult & { check: ShellCheckResult } {
  const config = readConfig()
  const shellConfig = {
    enabled: config.shell.enabled,
    allow_patterns: config.shell.allow_patterns,
    deny_patterns: config.shell.deny_patterns ?? [],
    allow_network: config.shell.allow_network ?? false,
    require_confirmation: config.shell.require_confirmation ?? false,
    audit_log: config.shell.audit_log ?? false,
  }
  const check = checkShellCommand(command, shellConfig)
  const verdict = check.allowed ? 'ALLOWED' : 'BLOCKED'
  return { success: check.allowed, message: `${verdict} [${check.tier}]: ${check.reason}`, check }
}

export function securityHttpEnable(enable: boolean): SecurityResult {
  const config = readConfig()
  config.http.enabled = enable
  writeConfig(config)
  return { success: true, message: `HTTP requests ${enable ? 'enabled' : 'disabled'}` }
}

export function securityHttpAddDomain(domain: string): SecurityResult {
  if (!domain || domain.length > 253 || !/^[\w.*-]+$/.test(domain)) {
    return { success: false, message: `Invalid domain: must be a valid hostname or glob pattern` }
  }
  const config = readConfig()
  if (!config.http.allowed_domains.includes(domain)) {
    config.http.allowed_domains.push(domain)
    writeConfig(config)
  }
  return { success: true, message: `Added domain: ${domain}` }
}

export function securityHttpRemoveDomain(domain: string): SecurityResult {
  const config = readConfig()
  config.http.allowed_domains = config.http.allowed_domains.filter(d => d !== domain)
  writeConfig(config)
  return { success: true, message: `Removed domain: ${domain}` }
}
