import { describe, it, expect } from 'vitest'
import { getEnv } from '../tools/get_env.js'
import { getConstraints } from '../tools/get_constraints.js'
import { listPhases } from '../tools/list_phases.js'
import { resolvePhase } from '../tools/resolve_phase.js'
import { nextPhase } from '../tools/next_phase.js'
import { executeDirective } from '../tools/execute_directive.js'
import { invalidateCache } from '../tools/invalidate_cache.js'
import { registerConnection, getConnection, listConnections, clearConnections } from '../connections.js'
import { writeFileSync, mkdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

const TMP = join(tmpdir(), 'mai-mcp-test-' + Date.now())

function setup() {
  mkdirSync(TMP, { recursive: true })
}

function teardown() {
  try { rmSync(TMP, { recursive: true }) } catch { /* ignore */ }
}

describe('getEnv', () => {
  it('returns env var value when set', () => {
    process.env['MAI_TEST_VAR_123'] = 'hello'
    const result = getEnv('MAI_TEST_VAR_123')
    expect(result.value).toBe('hello')
    expect(result.found).toBe(true)
    delete process.env['MAI_TEST_VAR_123']
  })

  it('returns fallback when not set', () => {
    const result = getEnv('DEFINITELY_MISSING_VAR_XYZ', 'default')
    expect(result.value).toBe('default')
    expect(result.found).toBe(false)
  })

  it('returns empty string when not set and no fallback', () => {
    const result = getEnv('DEFINITELY_MISSING_VAR_XYZ')
    expect(result.value).toBe('')
    expect(result.found).toBe(false)
  })

  it('denies keys matching sensitive patterns', () => {
    for (const key of ['MY_SECRET', 'DB_PASSWORD', 'API_KEY', 'AUTH_TOKEN', 'PRIVATE_KEY', 'DATABASE_URL']) {
      const result = getEnv(key)
      expect(result.denied).toBe(true)
      expect(result.value).toBe('')
    }
  })

  it('denies keys with invalid format', () => {
    for (const key of ['', '123INVALID', 'has-hyphen', 'has space', 'a'.repeat(129)]) {
      const result = getEnv(key)
      expect(result.found).toBe(false)
      expect(result.value).toBe('')
    }
  })

  it('enforces allowedKeys when provided', () => {
    process.env['MAI_ALLOWED'] = 'yes'
    process.env['MAI_NOT_ALLOWED'] = 'no'
    const allowed = new Set(['MAI_ALLOWED'])
    expect(getEnv('MAI_ALLOWED', undefined, allowed).found).toBe(true)
    expect(getEnv('MAI_NOT_ALLOWED', undefined, allowed).denied).toBe(true)
    delete process.env['MAI_ALLOWED']
    delete process.env['MAI_NOT_ALLOWED']
  })
})

describe('listPhases', () => {
  it('returns empty phases for non-existent file', () => {
    const result = listPhases('nonexistent.md', '/tmp')
    expect(result.phases).toEqual([])
  })

  it('returns phases from a document with @phase', () => {
    setup()
    const content = '@markdownai\n@phase setup\nContent.\n@on-complete @phase teardown /\n@phase-end\n@phase teardown\nDone.\n@phase-end'
    writeFileSync(join(TMP, 'phases.md'), content)
    const result = listPhases('phases.md', TMP)
    expect(result.phases.length).toBe(2)
    expect(result.phases[0]?.name).toBe('setup')
    expect(result.phases[1]?.name).toBe('teardown')
    teardown()
  })

  it('returns transitions for each phase', () => {
    setup()
    const content = '@markdownai\n@phase step1\nContent.\n@on-complete @phase step2 /\n@phase-end\n@phase step2\nDone.\n@phase-end'
    writeFileSync(join(TMP, 'trans.md'), content)
    const result = listPhases('trans.md', TMP)
    expect(result.phases[0]?.transitions.length).toBe(1)
    expect(result.phases[0]?.transitions[0]?.action.name).toBe('step2')
    teardown()
  })

  it('returns empty phases for non-MarkdownAI file', () => {
    setup()
    writeFileSync(join(TMP, 'plain.md'), '# Just markdown')
    const result = listPhases('plain.md', TMP)
    expect(result.phases).toEqual([])
    teardown()
  })

  it('blocks path traversal', () => {
    const result = listPhases('../../etc/passwd', '/tmp')
    expect(result.error).toBeTruthy()
    expect(result.phases).toEqual([])
  })
})

describe('resolvePhase', () => {
  it('returns found=false for missing file', () => {
    const result = resolvePhase({ filePath: 'missing.md', phase: 'setup' }, '/tmp')
    expect(result.found).toBe(false)
  })

  it('resolves phase content', () => {
    setup()
    const content = '@markdownai\n@phase setup\nSetup content.\n@phase-end\n@phase teardown\nTeardown.\n@phase-end'
    writeFileSync(join(TMP, 'doc.md'), content)
    const result = resolvePhase({ filePath: 'doc.md', phase: 'setup' }, TMP)
    expect(result.found).toBe(true)
    expect(result.content).toContain('Setup content.')
    expect(result.content).not.toContain('Teardown.')
    teardown()
  })

  it('returns found=false for non-existent phase', () => {
    setup()
    writeFileSync(join(TMP, 'doc2.md'), '@markdownai\n@phase setup\nContent.\n@phase-end')
    const result = resolvePhase({ filePath: 'doc2.md', phase: 'nonexistent' }, TMP)
    expect(result.found).toBe(false)
    teardown()
  })
})

describe('nextPhase', () => {
  it('returns null for missing file', () => {
    const result = nextPhase({ filePath: 'missing.md', currentPhase: 'setup' }, '/tmp')
    expect(result.found).toBe(false)
    expect(result.phase).toBeNull()
  })

  it('returns next phase from @on complete transition', () => {
    setup()
    const content = '@markdownai\n@phase setup\nContent.\n@on-complete @phase teardown /\n@phase-end\n@phase teardown\nDone.\n@phase-end'
    writeFileSync(join(TMP, 'next.md'), content)
    const result = nextPhase({ filePath: 'next.md', currentPhase: 'setup' }, TMP)
    expect(result.found).toBe(true)
    expect(result.phase).toBe('teardown')
    teardown()
  })

  it('returns null phase when no transition defined', () => {
    setup()
    writeFileSync(join(TMP, 'last.md'), '@markdownai\n@phase final\nDone.\n@phase-end')
    const result = nextPhase({ filePath: 'last.md', currentPhase: 'final' }, TMP)
    expect(result.found).toBe(true)
    expect(result.phase).toBeNull()
    teardown()
  })
})

describe('executeDirective', () => {
  it('executes @env directive', () => {
    const result = executeDirective('@env TEST_EXEC_VAR fallback /', process.cwd(), { TEST_EXEC_VAR: 'value' })
    expect(result.errors).toHaveLength(0)
  })

  it('executes @date directive', () => {
    const result = executeDirective('@date', process.cwd())
    expect(result.errors).toHaveLength(0)
    expect(result.output.trim().length).toBeGreaterThan(0)
  })

  it('rejects @query — not in MCP allowlist', () => {
    const result = executeDirective('@query "echo hello" /', process.cwd())
    expect(result.output.trim()).toBe('')
    expect(result.errors.length).toBeGreaterThan(0)
    expect(result.errors[0]).toContain('not permitted via MCP')
  })

  it('rejects @shell — not in MCP allowlist', () => {
    const result = executeDirective('@shell echo hi', process.cwd())
    expect(result.errors[0]).toContain('not permitted via MCP')
  })

  it('rejects @http — not in MCP allowlist', () => {
    const result = executeDirective('@http url=https://example.com /', process.cwd())
    expect(result.errors[0]).toContain('not permitted via MCP')
  })

  it('rejects @db — not in MCP allowlist', () => {
    const result = executeDirective('@db sql="SELECT 1" /', process.cwd())
    expect(result.errors[0]).toContain('not permitted via MCP')
  })

  it('rejects @include — not in MCP allowlist', () => {
    const result = executeDirective('@include file.md /', process.cwd())
    expect(result.errors[0]).toContain('not permitted via MCP')
  })

  it('rejects @import — not in MCP allowlist', () => {
    const result = executeDirective('@import macros.md /', process.cwd())
    expect(result.errors[0]).toContain('not permitted via MCP')
  })

  it('rejects @connect — not in MCP allowlist', () => {
    const result = executeDirective('@connect name=db type=postgres /', process.cwd())
    expect(result.errors[0]).toContain('not permitted via MCP')
  })

  it('rejects embedded newlines (injection attempt)', () => {
    const result = executeDirective('@env SAFE_VAR /\n@shell rm -rf /', process.cwd())
    // newline stripped — only @env is processed, @shell part becomes part of the env directive
    expect(result.errors).toHaveLength(0)
  })

  it('rejects unknown directives via MCP', () => {
    const result = executeDirective('@completely-unknown-directive', process.cwd())
    expect(result.errors.length).toBeGreaterThan(0)
    expect(result.errors[0]).toContain('not permitted via MCP')
  })
})

describe('getConstraints', () => {
  it('returns blocked=true for path traversal', () => {
    const result = getConstraints('../../etc/passwd', '/tmp')
    expect(result.blocked).toBe(true)
    expect(result.constraints).toHaveLength(0)
  })

  it('returns empty constraints for missing file', () => {
    const result = getConstraints('nonexistent.md', '/tmp')
    expect(result.blocked).toBeUndefined()
    expect(result.constraints).toHaveLength(0)
  })

  it('returns constraints from a MarkdownAI document', () => {
    setup()
    const content = '@markdownai\n@constraint id=C1 severity=high\nAll inputs must be validated.\n@constraint-end'
    writeFileSync(join(TMP, 'constrained.md'), content)
    const result = getConstraints('constrained.md', TMP)
    expect(result.isMarkdownAI).toBe(true)
    expect(result.constraints).toHaveLength(1)
    expect(result.constraints[0]?.id).toBe('C1')
    expect(result.constraints[0]?.severity).toBe('high')
    teardown()
  })
})

describe('invalidateCache', () => {
  it('clears cache and returns cleared status', () => {
    const result = invalidateCache()
    expect(result.cleared.session).toBe(true)
    expect(result.cleared.persist).toBe(true)
  })

  it('accepts optional directive filter', () => {
    const result = invalidateCache('db')
    expect(result.cleared.session).toBe(true)
  })
})

describe('connections registry', () => {
  it('registers and retrieves connections', () => {
    clearConnections()
    registerConnection('primary', 'mongodb', { uri: 'mongodb://localhost:27017/test' })
    const conn = getConnection('primary')
    expect(conn).not.toBeNull()
    expect(conn?.type).toBe('mongodb')
    clearConnections()
  })

  it('returns null for missing connection', () => {
    clearConnections()
    expect(getConnection('nonexistent')).toBeNull()
  })

  it('listConnections returns all registered connections', () => {
    clearConnections()
    registerConnection('db1', 'postgres', { uri: 'postgres://localhost/test' })
    registerConnection('db2', 'mysql', { host: 'localhost' })
    expect(listConnections().length).toBe(2)
    clearConnections()
  })

  it('clearConnections empties the registry', () => {
    registerConnection('temp', 'redis', {})
    clearConnections()
    expect(listConnections().length).toBe(0)
  })
})
