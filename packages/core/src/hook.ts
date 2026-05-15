import { readFileSync, existsSync, openSync, readSync, closeSync } from 'node:fs'

const MAI_HEADER = '@markdownai'
const PEEK_BYTES = 20

export interface HookDecision {
  route: 'mcp' | 'passthrough'
  reason: string
}

export function shouldRoute(filePath: string): HookDecision {
  if (!filePath.endsWith('.md')) {
    return { route: 'passthrough', reason: 'Not a markdown file' }
  }
  if (!existsSync(filePath)) {
    return { route: 'passthrough', reason: 'File does not exist' }
  }
  try {
    const buf = Buffer.alloc(PEEK_BYTES)
    const fd = openSync(filePath, 'r')
    const bytesRead = readSync(fd, buf, 0, PEEK_BYTES, 0)
    closeSync(fd)
    const peek = buf.subarray(0, bytesRead).toString('utf8')
    if (peek.trimStart().startsWith(MAI_HEADER)) {
      return { route: 'mcp', reason: 'MarkdownAI document detected' }
    }
    return { route: 'passthrough', reason: 'Not a MarkdownAI document' }
  } catch {
    return { route: 'passthrough', reason: 'Cannot read file' }
  }
}

export function isMarkdownAIFile(filePath: string): boolean {
  if (!filePath.endsWith('.md')) return false
  try {
    const content = readFileSync(filePath, 'utf8')
    return content.trimStart().startsWith(MAI_HEADER)
  } catch { return false }
}
