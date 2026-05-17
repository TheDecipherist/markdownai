import { readFileSync, existsSync, openSync, readSync, closeSync } from 'node:fs'

const MAI_HEADER = '@markdownai'
const PEEK_BYTES = 20
const FRONTMATTER_PEEK_BYTES = 2048

export interface HookDecision {
  route: 'mcp' | 'passthrough'
  reason: string
}

// Returns true if content begins with @markdownai, optionally preceded by YAML frontmatter (--- ... ---)
function startsWithMarkdownAI(content: string): boolean {
  const trimmed = content.trimStart()
  if (trimmed.startsWith(MAI_HEADER)) return true
  if (!trimmed.startsWith('---')) return false
  const rest = trimmed.slice(3)
  const closeIdx = rest.indexOf('\n---')
  if (closeIdx === -1) return false
  // Skip blank lines between closing --- and @markdownai
  return rest.slice(closeIdx + 4).trimStart().startsWith(MAI_HEADER)
}

export function shouldRoute(filePath: string): HookDecision {
  if (!filePath.endsWith('.md')) {
    return { route: 'passthrough', reason: 'Not a markdown file' }
  }
  if (!existsSync(filePath)) {
    return { route: 'passthrough', reason: 'File does not exist' }
  }
  try {
    const fd = openSync(filePath, 'r')
    try {
      const buf = Buffer.alloc(PEEK_BYTES)
      const bytesRead = readSync(fd, buf, 0, PEEK_BYTES, 0)
      const peek = buf.subarray(0, bytesRead).toString('utf8')

      if (peek.trimStart().startsWith(MAI_HEADER)) {
        return { route: 'mcp', reason: 'MarkdownAI document detected' }
      }

      // Slow path: file may begin with YAML frontmatter before @markdownai
      if (peek.trimStart().startsWith('---')) {
        const fmBuf = Buffer.alloc(FRONTMATTER_PEEK_BYTES)
        const fmBytes = readSync(fd, fmBuf, 0, FRONTMATTER_PEEK_BYTES, 0)
        const content = fmBuf.subarray(0, fmBytes).toString('utf8')
        if (startsWithMarkdownAI(content)) {
          return { route: 'mcp', reason: 'MarkdownAI document detected (after YAML frontmatter)' }
        }
      }

      return { route: 'passthrough', reason: 'Not a MarkdownAI document' }
    } finally {
      closeSync(fd)
    }
  } catch {
    return { route: 'passthrough', reason: 'Cannot read file' }
  }
}

export function isMarkdownAIFile(filePath: string): boolean {
  if (!filePath.endsWith('.md')) return false
  try {
    const content = readFileSync(filePath, 'utf8')
    return startsWithMarkdownAI(content)
  } catch { return false }
}
