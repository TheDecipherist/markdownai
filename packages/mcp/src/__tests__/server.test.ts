import { describe, it, expect } from 'vitest'
import { getEnv } from '../tools/get_env.js'
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
})

describe('listPhases', () => {
  it('returns empty array for non-existent file', () => {
    const result = listPhases('nonexistent.md', '/tmp')
    expect(result).toEqual([])
  })

  it('returns phases from a document with @phase', () => {
    setup()
    const content = '@markdownai\n@phase setup\nContent.\n@on complete -> @phase teardown\n@end\n@phase teardown\nDone.\n@end'
    writeFileSync(join(TMP, 'phases.md'), content)
    const result = listPhases('phases.md', TMP)
    expect(result.length).toBe(2)
    expect(result[0]?.name).toBe('setup')
    expect(result[1]?.name).toBe('teardown')
    teardown()
  })

  it('returns transitions for each phase', () => {
    setup()
    const content = '@markdownai\n@phase step1\nContent.\n@on complete -> @phase step2\n@end\n@phase step2\nDone.\n@end'
    writeFileSync(join(TMP, 'trans.md'), content)
    const result = listPhases('trans.md', TMP)
    expect(result[0]?.transitions.length).toBe(1)
    expect(result[0]?.transitions[0]?.action.name).toBe('step2')
    teardown()
  })

  it('returns empty for non-MarkdownAI file', () => {
    setup()
    writeFileSync(join(TMP, 'plain.md'), '# Just markdown')
    const result = listPhases('plain.md', TMP)
    expect(result).toEqual([])
    teardown()
  })
})

describe('resolvePhase', () => {
  it('returns found=false for missing file', () => {
    const result = resolvePhase('missing.md', 'setup', '/tmp')
    expect(result.found).toBe(false)
  })

  it('resolves phase content', () => {
    setup()
    const content = '@markdownai\n@phase setup\nSetup content.\n@end\n@phase teardown\nTeardown.\n@end'
    writeFileSync(join(TMP, 'doc.md'), content)
    const result = resolvePhase('doc.md', 'setup', TMP)
    expect(result.found).toBe(true)
    expect(result.content).toContain('Setup content.')
    expect(result.content).not.toContain('Teardown.')
    teardown()
  })

  it('returns found=false for non-existent phase', () => {
    setup()
    writeFileSync(join(TMP, 'doc2.md'), '@markdownai\n@phase setup\nContent.\n@end')
    const result = resolvePhase('doc2.md', 'nonexistent', TMP)
    expect(result.found).toBe(false)
    teardown()
  })
})

describe('nextPhase', () => {
  it('returns null for missing file', () => {
    const result = nextPhase('missing.md', 'setup', '/tmp')
    expect(result.found).toBe(false)
    expect(result.phase).toBeNull()
  })

  it('returns next phase from @on complete transition', () => {
    setup()
    const content = '@markdownai\n@phase setup\nContent.\n@on complete -> @phase teardown\n@end\n@phase teardown\nDone.\n@end'
    writeFileSync(join(TMP, 'next.md'), content)
    const result = nextPhase('next.md', 'setup', TMP)
    expect(result.found).toBe(true)
    expect(result.phase).toBe('teardown')
    teardown()
  })

  it('returns null phase when no transition defined', () => {
    setup()
    writeFileSync(join(TMP, 'last.md'), '@markdownai\n@phase final\nDone.\n@end')
    const result = nextPhase('last.md', 'final', TMP)
    expect(result.found).toBe(true)
    expect(result.phase).toBeNull()
    teardown()
  })
})

describe('executeDirective', () => {
  it('executes @env directive', () => {
    const result = executeDirective('@env TEST_EXEC_VAR fallback', process.cwd(), { TEST_EXEC_VAR: 'value' })
    // env sets fallback, actual value comes from env
    expect(result.errors).toHaveLength(0)
  })

  it('returns empty for jailed @query when shell disabled', () => {
    const result = executeDirective('@query "echo hello"', process.cwd())
    expect(result.output.trim()).toBe('')
    expect(result.errors).toHaveLength(0)  // jailed = silent strip
  })

  it('does not execute malformed directives without crashing', () => {
    const result = executeDirective('@completely-unknown-directive', process.cwd())
    expect(result.errors).toHaveLength(0)  // unknown = passthrough
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
