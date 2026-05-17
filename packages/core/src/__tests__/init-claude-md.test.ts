import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { writeFileSync, readFileSync, mkdirSync, rmSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { runInitClaudeMd, stripClaudeMdSection } from '../commands/init.js'
import { CLAUDE_MD_SECTION, SECTION_START_MARKER, SECTION_END_MARKER } from '../templates/claude-section.js'

const TMP = join(tmpdir(), 'markdownai-claude-md-test')
const FAKE_CLAUDE_DIR = join(TMP, '.claude')
const FAKE_CLAUDE_MD = join(FAKE_CLAUDE_DIR, 'CLAUDE.md')

beforeEach(() => { mkdirSync(TMP, { recursive: true }) })
afterEach(() => { rmSync(TMP, { recursive: true, force: true }) })

// --- runInitClaudeMd ---

describe('runInitClaudeMd', () => {
  it('appends the section when CLAUDE.md exists but has no marker', () => {
    mkdirSync(FAKE_CLAUDE_DIR, { recursive: true })
    writeFileSync(FAKE_CLAUDE_MD, '# Existing content\n\nSome rules here.\n')

    const result = runInitClaudeMd({ claudeMdPath: FAKE_CLAUDE_MD })

    expect(result.updated).toBe(true)
    expect(result.alreadyPresent).toBe(false)
    const content = readFileSync(FAKE_CLAUDE_MD, 'utf8')
    expect(content).toContain('# Existing content')
    expect(content).toContain(SECTION_START_MARKER)
    expect(content).toContain(SECTION_END_MARKER)
  })

  it('returns alreadyPresent: true and does not write when marker already exists', () => {
    mkdirSync(FAKE_CLAUDE_DIR, { recursive: true })
    writeFileSync(FAKE_CLAUDE_MD, `# Existing\n\n${CLAUDE_MD_SECTION}\n`)
    const before = readFileSync(FAKE_CLAUDE_MD, 'utf8')

    const result = runInitClaudeMd({ claudeMdPath: FAKE_CLAUDE_MD })

    expect(result.alreadyPresent).toBe(true)
    expect(result.updated).toBe(false)
    expect(readFileSync(FAKE_CLAUDE_MD, 'utf8')).toBe(before)
  })

  it('creates CLAUDE.md when the file does not exist', () => {
    mkdirSync(FAKE_CLAUDE_DIR, { recursive: true })

    const result = runInitClaudeMd({ claudeMdPath: FAKE_CLAUDE_MD })

    expect(result.updated).toBe(true)
    expect(existsSync(FAKE_CLAUDE_MD)).toBe(true)
    const content = readFileSync(FAKE_CLAUDE_MD, 'utf8')
    expect(content).toContain(SECTION_START_MARKER)
    expect(content).toContain(SECTION_END_MARKER)
  })

  it('creates the .claude directory when it does not exist', () => {
    const result = runInitClaudeMd({ claudeMdPath: FAKE_CLAUDE_MD })

    expect(result.updated).toBe(true)
    expect(existsSync(FAKE_CLAUDE_DIR)).toBe(true)
    expect(existsSync(FAKE_CLAUDE_MD)).toBe(true)
  })

  it('returns the correct claudeMdPath in the result', () => {
    const result = runInitClaudeMd({ claudeMdPath: FAKE_CLAUDE_MD })

    expect(result.claudeMdPath).toBe(FAKE_CLAUDE_MD)
  })

  it('does not duplicate the section on repeated calls', () => {
    runInitClaudeMd({ claudeMdPath: FAKE_CLAUDE_MD })
    runInitClaudeMd({ claudeMdPath: FAKE_CLAUDE_MD })

    const content = readFileSync(FAKE_CLAUDE_MD, 'utf8')
    const count = (content.match(new RegExp(SECTION_START_MARKER, 'g')) ?? []).length
    expect(count).toBe(1)
  })
})

// --- stripClaudeMdSection ---

describe('stripClaudeMdSection', () => {
  it('removes the marked block and leaves surrounding content intact', () => {
    const input = `# Before\n\n${CLAUDE_MD_SECTION}\n\n# After\n`

    const result = stripClaudeMdSection(input)

    expect(result).toContain('# Before')
    expect(result).toContain('# After')
    expect(result).not.toContain(SECTION_START_MARKER)
    expect(result).not.toContain(SECTION_END_MARKER)
  })

  it('returns the original string unchanged when markers are not found', () => {
    const input = '# Just a plain CLAUDE.md\n\nNo MarkdownAI section here.\n'

    const result = stripClaudeMdSection(input)

    expect(result).toBe(input)
  })

  it('returns empty string when the file contained only the section block', () => {
    const result = stripClaudeMdSection(CLAUDE_MD_SECTION)

    expect(result.trim()).toBe('')
  })

  it('does not remove content between unrelated HTML comments', () => {
    const input = `<!-- some-other-tool -->\nOther content\n<!-- /some-other-tool -->\n\n${CLAUDE_MD_SECTION}\n`

    const result = stripClaudeMdSection(input)

    expect(result).toContain('<!-- some-other-tool -->')
    expect(result).toContain('Other content')
    expect(result).not.toContain(SECTION_START_MARKER)
  })

  it('handles missing end marker without corrupting the file', () => {
    const input = `# Before\n\n${SECTION_START_MARKER}\nOrphaned section\n# After\n`

    const result = stripClaudeMdSection(input)

    expect(result).not.toContain(SECTION_START_MARKER)
    expect(result).toContain('# Before')
  })
})

// --- CLAUDE_MD_SECTION template ---

describe('CLAUDE_MD_SECTION', () => {
  it('contains the start marker', () => {
    expect(CLAUDE_MD_SECTION).toContain(SECTION_START_MARKER)
  })

  it('contains the end marker', () => {
    expect(CLAUDE_MD_SECTION).toContain(SECTION_END_MARKER)
  })

  it('contains the MCP fallback read guidance', () => {
    expect(CLAUDE_MD_SECTION).toContain('mai render')
    expect(CLAUDE_MD_SECTION).toContain('@markdownai/mcp')
  })

  it('does not contain em dashes', () => {
    expect(CLAUDE_MD_SECTION).not.toContain('—')
  })

  it('start marker comes before end marker', () => {
    const startIdx = CLAUDE_MD_SECTION.indexOf(SECTION_START_MARKER)
    const endIdx = CLAUDE_MD_SECTION.indexOf(SECTION_END_MARKER)
    expect(startIdx).toBeLessThan(endIdx)
  })
})
