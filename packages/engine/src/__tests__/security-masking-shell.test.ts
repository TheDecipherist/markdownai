import { describe, it, expect } from 'vitest'
import { defaultSecurityConfig } from '../security/config.js'
import { applyMasking } from '../security/masking.js'
import { checkShellCommand } from '../security/shell.js'
import { checkHttpUrl } from '../security/http.js'
import { checkDbOperation } from '../security/database.js'
import { SHELL_ALWAYS_BLOCK, SHELL_ALWAYS_ALERT } from '../security/rules.js'

describe('content masking', () => {
  it('masks api_key pattern', () => {
    const { masked, wasMasked } = applyMasking('api_key: sk-abc123def456ghi789')
    expect(wasMasked).toBe(true)
    expect(masked).toContain('***MASKED***')
    expect(masked).not.toContain('sk-abc123def456ghi789')
  })

  it('masks AWS access key', () => {
    const { masked, wasMasked } = applyMasking('key: AKIAIOSFODNN7EXAMPLE')
    expect(wasMasked).toBe(true)
    expect(masked).toContain('***MASKED***')
  })

  it('masks GitHub personal access token', () => {
    const { masked, wasMasked } = applyMasking('ghp_AbCdEfGhIjKlMnOpQrStUvWxYz1234567890')
    expect(wasMasked).toBe(true)
  })

  it('masks Stripe live key', () => {
    const { masked, wasMasked } = applyMasking('sk_live_abcdefghijklmnopqrstuvwxyz12')
    expect(wasMasked).toBe(true)
  })

  it('masks MongoDB connection string', () => {
    const { masked, wasMasked } = applyMasking('mongodb://user:secret@host:27017/db')
    expect(wasMasked).toBe(true)
  })

  it('masks PostgreSQL connection string', () => {
    const { masked, wasMasked } = applyMasking('postgresql://admin:pass@db.example.com:5432/mydb')
    expect(wasMasked).toBe(true)
  })

  it('masks JWT token', () => {
    const jwt = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c'
    const { masked, wasMasked } = applyMasking(jwt)
    expect(wasMasked).toBe(true)
  })

  it('does not mask regular content', () => {
    const { masked, wasMasked } = applyMasking('# Hello World\n\nThis is a regular document.')
    expect(wasMasked).toBe(false)
    expect(masked).toBe('# Hello World\n\nThis is a regular document.')
  })

  it('does not mask normal short variable values', () => {
    const { masked, wasMasked } = applyMasking('NODE_ENV=dev\nPORT=3000\nDEBUG=true')
    expect(wasMasked).toBe(false)
  })

  it('applies user masking patterns', () => {
    const config = { ...defaultSecurityConfig().filesystem, user_masking_patterns: ['my-custom-\\S+'] }
    const { masked, wasMasked } = applyMasking('value: my-custom-secret', config)
    expect(wasMasked).toBe(true)
  })

  it('skips masking for allow_unmasked_paths', () => {
    const config = { ...defaultSecurityConfig().filesystem, allow_unmasked_paths: ['safe/*.json'] }
    const { masked, wasMasked } = applyMasking('api_key: mysecret', config, 'safe/config.json')
    expect(wasMasked).toBe(false)
  })
})

describe('built-in immutable shell rules', () => {
  it('SHELL_ALWAYS_BLOCK contains rm -rf variants', () => {
    expect(SHELL_ALWAYS_BLOCK.some(p => p.startsWith('rm -rf'))).toBe(true)
  })

  it('SHELL_ALWAYS_BLOCK contains curl pipe to bash', () => {
    expect(SHELL_ALWAYS_BLOCK.some(p => p.includes('curl') && p.includes('bash'))).toBe(true)
  })

  it('SHELL_ALWAYS_BLOCK contains eval', () => {
    expect(SHELL_ALWAYS_BLOCK.some(p => p.startsWith('eval'))).toBe(true)
  })

  it('SHELL_ALWAYS_ALERT contains sudo', () => {
    expect(SHELL_ALWAYS_ALERT.some(p => p.startsWith('sudo'))).toBe(true)
  })

  it('SHELL_ALWAYS_ALERT contains ssh', () => {
    expect(SHELL_ALWAYS_ALERT.some(p => p.startsWith('ssh'))).toBe(true)
  })
})

describe('shell jail', () => {
  const disabledConfig = defaultSecurityConfig().shell

  it('blocks when shell is disabled', () => {
    const result = checkShellCommand('ls -la', disabledConfig)
    expect(result.allowed).toBe(false)
  })

  it('blocks command not in allowlist even when enabled', () => {
    const cfg = { ...disabledConfig, enabled: true, allow_patterns: ['git log *'] }
    expect(checkShellCommand('ls -la', cfg).allowed).toBe(false)
    expect(checkShellCommand('ls -la', cfg).tier).toBe('not_allowed')
  })

  it('allows command matching allowlist pattern', () => {
    const cfg = { ...disabledConfig, enabled: true, allow_patterns: ['git log *'] }
    expect(checkShellCommand('git log --oneline -5', cfg).allowed).toBe(true)
  })

  it('deny_patterns wins over allowlist', () => {
    const cfg = { ...disabledConfig, enabled: true, allow_patterns: ['rm *'], deny_patterns: ['rm *'] }
    const result = checkShellCommand('rm oldfile.txt', cfg)
    expect(result.allowed).toBe(false)
    expect(result.tier).toBe('deny_pattern')
  })

  it('always_block cannot be overridden by allowlist', () => {
    const cfg = { ...disabledConfig, enabled: true, allow_patterns: ['rm -rf *'] }
    const result = checkShellCommand('rm -rf /', cfg)
    expect(result.allowed).toBe(false)
    expect(result.tier).toBe('always_block')
  })

  it('blocks rm -rf ~', () => {
    const cfg = { ...disabledConfig, enabled: true, allow_patterns: ['*'] }
    const result = checkShellCommand('rm -rf ~', cfg)
    expect(result.allowed).toBe(false)
    expect(result.tier).toBe('always_block')
  })

  it('blocks eval commands', () => {
    const cfg = { ...disabledConfig, enabled: true, allow_patterns: ['eval *'] }
    const result = checkShellCommand('eval "rm -rf /"', cfg)
    expect(result.allowed).toBe(false)
    expect(result.tier).toBe('always_block')
  })
})

describe('HTTP jail', () => {
  const disabledConfig = defaultSecurityConfig().http

  it('always blocks cloud metadata endpoint 169.254.169.254', () => {
    const result = checkHttpUrl('http://169.254.169.254/latest/meta-data', { ...disabledConfig, enabled: true })
    expect(result.allowed).toBe(false)
    expect(result.tier).toBe('always_block')
  })

  it('always blocks metadata.google.internal', () => {
    const result = checkHttpUrl('http://metadata.google.internal/computeMetadata/v1/', { ...disabledConfig, enabled: true })
    expect(result.allowed).toBe(false)
    expect(result.tier).toBe('always_block')
  })

  it('always blocks AWS ECS task metadata endpoint 169.254.170.2', () => {
    const result = checkHttpUrl('http://169.254.170.2/v2/metadata', { ...disabledConfig, enabled: true })
    expect(result.allowed).toBe(false)
    expect(result.tier).toBe('always_block')
  })

  it('always blocks IPv6 EC2 metadata endpoint fd00:ec2::254', () => {
    const result = checkHttpUrl('http://[fd00:ec2::254]/latest/meta-data', { ...disabledConfig, enabled: true })
    expect(result.allowed).toBe(false)
    expect(result.tier).toBe('always_block')
  })

  it('always blocks cloud metadata even when enabled with full allowlist', () => {
    const cfg = { ...disabledConfig, enabled: true, allowed_domains: ['169.254.169.254'] }
    const result = checkHttpUrl('http://169.254.169.254/', cfg)
    expect(result.allowed).toBe(false)
    expect(result.tier).toBe('always_block')
  })

  it('blocks when HTTP disabled', () => {
    const result = checkHttpUrl('https://api.github.com', disabledConfig)
    expect(result.allowed).toBe(false)
    expect(result.tier).toBe('not_enabled')
  })

  it('blocks domains not in allowlist', () => {
    const cfg = { ...disabledConfig, enabled: true, allowed_domains: ['api.github.com'] }
    expect(checkHttpUrl('https://evil.com/data', cfg).allowed).toBe(false)
    expect(checkHttpUrl('https://evil.com/data', cfg).tier).toBe('not_allowed')
  })

  it('allows domains in allowlist', () => {
    const cfg = { ...disabledConfig, enabled: true, allowed_domains: ['api.github.com'] }
    expect(checkHttpUrl('https://api.github.com/repos', cfg).allowed).toBe(true)
  })

  it('allows subdomains of allowed domains', () => {
    const cfg = { ...disabledConfig, enabled: true, allowed_domains: ['github.com'] }
    expect(checkHttpUrl('https://api.github.com/repos', cfg).allowed).toBe(true)
  })

  it('allows all when allowlist is empty and enabled', () => {
    const cfg = { ...disabledConfig, enabled: true, allowed_domains: [] }
    expect(checkHttpUrl('https://example.com', cfg).allowed).toBe(true)
  })

  it('blocks domains in denied_domains', () => {
    const cfg = { ...disabledConfig, enabled: true, denied_domains: ['evil.com'] }
    const result = checkHttpUrl('https://evil.com', cfg)
    expect(result.allowed).toBe(false)
    expect(result.tier).toBe('denied_domain')
  })
})

describe('database jail', () => {
  const config: Record<string, import('../security/config.js').DbConnectionSecurityConfig> = {
    primary: {
      allowed_operations: ['find', 'aggregate'],
      denied_operations: [],
      denied_keywords: ['DELETE', 'UPDATE'],
      allowed_collections: ['products'],
      denied_collections: [],
      allow_raw: false,
      readonly: true,
      max_results: 1000,
    },
  }

  it('always blocks DROP DATABASE', () => {
    const result = checkDbOperation('DROP DATABASE users', 'primary', config)
    expect(result.allowed).toBe(false)
    expect(result.tier).toBe('always_block')
  })

  it('always blocks DROP TABLE', () => {
    const result = checkDbOperation('DROP TABLE users', 'primary', config)
    expect(result.allowed).toBe(false)
    expect(result.tier).toBe('always_block')
  })

  it('always blocks TRUNCATE', () => {
    const result = checkDbOperation('TRUNCATE users', 'primary', config)
    expect(result.allowed).toBe(false)
    expect(result.tier).toBe('always_block')
  })

  it('always blocks DELETE FROM', () => {
    const result = checkDbOperation('DELETE FROM users WHERE id=1', 'primary', config)
    expect(result.allowed).toBe(false)
    expect(result.tier).toBe('always_block')
  })

  it('always blocks MongoDB dropDatabase', () => {
    const result = checkDbOperation('db.dropDatabase()', 'primary', config)
    expect(result.allowed).toBe(false)
    expect(result.tier).toBe('always_block')
  })

  it('always blocks MongoDB deleteMany', () => {
    const result = checkDbOperation('db.users.deleteMany({})', 'primary', config)
    expect(result.allowed).toBe(false)
    expect(result.tier).toBe('always_block')
  })

  it('always blocks UPDATE statements', () => {
    const result = checkDbOperation('UPDATE users SET name="x"', 'primary', config)
    expect(result.allowed).toBe(false)
    expect(result.tier).toBe('always_block')
  })

  it('blocks user-denied keyword DELETE (per-connection)', () => {
    const cfgWithoutDelete: typeof config = {
      primary: { ...config.primary!, denied_keywords: ['CUSTOM_BLOCK'] },
    }
    const result = checkDbOperation('DELETE FROM orders', 'primary', cfgWithoutDelete)
    // DELETE FROM is in always_block, so it's blocked at that tier
    expect(result.allowed).toBe(false)
  })

  it('allows find operation', () => {
    const result = checkDbOperation('db.products.find()', 'primary', config)
    expect(result.allowed).toBe(true)
  })

  it('allows SELECT query', () => {
    const result = checkDbOperation('SELECT * FROM products', 'primary', config)
    expect(result.allowed).toBe(true)
  })

  it('allows operation when connection has no config', () => {
    const result = checkDbOperation('db.users.find()', 'unknown', config)
    expect(result.allowed).toBe(true)
  })

  it('blocks with user-defined denied keyword', () => {
    const cfg: typeof config = {
      primary: { ...config.primary!, denied_keywords: ['CUSTOM_BLOCK'] },
    }
    const result = checkDbOperation('CUSTOM_BLOCK something', 'primary', cfg)
    expect(result.allowed).toBe(false)
    expect(result.tier).toBe('denied_keyword')
  })
})
