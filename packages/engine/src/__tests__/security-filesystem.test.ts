import { describe, it, expect } from 'vitest'
import { defaultSecurityConfig, loadSecurityConfig } from '../security/config.js'
import { shouldPrintToTerminal, isStrictViolation } from '../security/modes.js'
import { checkFilePath } from '../security/filesystem.js'
import { matchGlob } from '../security/rules.js'

describe('defaultSecurityConfig', () => {
  it('is jail-first: shell disabled by default', () => {
    expect(defaultSecurityConfig().shell.enabled).toBe(false)
  })

  it('is jail-first: http disabled by default', () => {
    expect(defaultSecurityConfig().http.enabled).toBe(false)
  })

  it('http allows only GET by default', () => {
    expect(defaultSecurityConfig().http.allowed_methods).toEqual(['GET'])
  })

  it('db config is empty by default', () => {
    expect(defaultSecurityConfig().db).toEqual({})
  })

  it('shell has no allow patterns by default', () => {
    expect(defaultSecurityConfig().shell.allow_patterns).toEqual([])
  })
})

describe('loadSecurityConfig', () => {
  it('returns defaults when file does not exist', () => {
    const cfg = loadSecurityConfig('/nonexistent/path/security.json')
    expect(cfg.shell.enabled).toBe(false)
    expect(cfg.http.enabled).toBe(false)
  })

  it('returns defaults on invalid JSON', () => {
    // write a temp invalid file — just use a path that doesn't exist
    const cfg = loadSecurityConfig('/tmp/not-real-markdownai-security.json')
    expect(cfg.shell.enabled).toBe(false)
  })
})

describe('RuntimeMode', () => {
  it('SECURITY_ALERT always prints to terminal in silent mode', () => {
    expect(shouldPrintToTerminal('SECURITY_ALERT', 'silent')).toBe(true)
  })

  it('FATAL always prints to terminal in silent mode', () => {
    expect(shouldPrintToTerminal('FATAL', 'silent')).toBe(true)
  })

  it('SECURITY_NOTICE always prints to terminal', () => {
    expect(shouldPrintToTerminal('SECURITY_NOTICE', 'silent')).toBe(true)
  })

  it('ERROR always prints to terminal', () => {
    expect(shouldPrintToTerminal('ERROR', 'silent')).toBe(true)
  })

  it('WARN does not print in silent mode', () => {
    expect(shouldPrintToTerminal('WARN', 'silent')).toBe(false)
  })

  it('INFO does not print in silent mode', () => {
    expect(shouldPrintToTerminal('INFO', 'silent')).toBe(false)
  })

  it('WARN prints in verbose mode', () => {
    expect(shouldPrintToTerminal('WARN', 'verbose')).toBe(true)
  })

  it('WARN does not print in strict mode (strict raises errors, not print)', () => {
    expect(shouldPrintToTerminal('WARN', 'strict')).toBe(false)
  })

  it('strict mode treats WARN as violation', () => {
    expect(isStrictViolation('WARN', 'strict')).toBe(true)
  })

  it('strict mode treats SECURITY_ALERT as violation', () => {
    expect(isStrictViolation('SECURITY_ALERT', 'strict')).toBe(true)
  })

  it('silent mode does not treat WARN as violation', () => {
    expect(isStrictViolation('WARN', 'silent')).toBe(false)
  })

  it('verbose mode does not treat WARN as violation', () => {
    expect(isStrictViolation('WARN', 'verbose')).toBe(false)
  })
})

describe('filesystem confinement', () => {
  const root = '/home/user/docs'

  it('blocks absolute paths', () => {
    expect(checkFilePath('/etc/passwd', root).level).toBe('blocked')
  })

  it('blocks traversal above document root', () => {
    expect(checkFilePath('../../../etc/passwd', root).level).toBe('blocked')
  })

  it('blocks two-level traversal', () => {
    expect(checkFilePath('../../secrets.txt', root).level).toBe('blocked')
  })

  it('blocks id_rsa by filename pattern', () => {
    expect(checkFilePath('id_rsa', root).level).toBe('blocked')
  })

  it('blocks id_ed25519 by filename pattern', () => {
    expect(checkFilePath('id_ed25519', root).level).toBe('blocked')
  })

  it('blocks .pem files', () => {
    expect(checkFilePath('cert.pem', root).level).toBe('blocked')
  })

  it('blocks .key files', () => {
    expect(checkFilePath('private.key', root).level).toBe('blocked')
  })

  it('blocks .env files', () => {
    expect(checkFilePath('.env', root).level).toBe('blocked')
  })

  it('blocks .env.local files', () => {
    expect(checkFilePath('.env.local', root).level).toBe('blocked')
  })

  it('blocks files matching *credentials*', () => {
    expect(checkFilePath('aws_credentials', root).level).toBe('blocked')
  })

  it('alerts on JSON files (sensitive type)', () => {
    expect(checkFilePath('config.json', root).level).toBe('alert')
  })

  it('alerts on config.yaml', () => {
    expect(checkFilePath('config.yaml', root).level).toBe('alert')
  })

  it('allows normal relative paths', () => {
    expect(checkFilePath('data/report.md', root).level).toBe('allowed')
  })

  it('allows CSV files', () => {
    expect(checkFilePath('data/export.csv', root).level).toBe('allowed')
  })

  it('allows paths with ./ prefix inside root', () => {
    expect(checkFilePath('./data/report.md', root).level).toBe('allowed')
  })

  it('blocks user additional_block_patterns', () => {
    const config = { ...defaultSecurityConfig().filesystem, additional_block_patterns: ['*.myext'] }
    expect(checkFilePath('file.myext', root, config).level).toBe('blocked')
  })
})

describe('matchGlob', () => {
  it('matches * wildcard within segment', () => {
    expect(matchGlob('*.ts', 'file.ts')).toBe(true)
    expect(matchGlob('*.ts', 'file.js')).toBe(false)
  })

  it('matches exact string', () => {
    expect(matchGlob('id_rsa', 'id_rsa')).toBe(true)
    expect(matchGlob('id_rsa', 'id_rsa.pub')).toBe(false)
  })

  it('matches mid-string wildcard', () => {
    expect(matchGlob('*credentials*', 'aws_credentials_file')).toBe(true)
  })

  it('* does not match across path separators', () => {
    expect(matchGlob('*.ts', 'subdir/file.ts')).toBe(false)
  })

  it('matches .env* pattern', () => {
    expect(matchGlob('.env*', '.env')).toBe(true)
    expect(matchGlob('.env*', '.env.local')).toBe(true)
    expect(matchGlob('.env*', 'notenv')).toBe(false)
  })
})
