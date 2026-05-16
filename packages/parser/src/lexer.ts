export type LineKind =
  | 'blank'
  | 'directive'
  | 'fenced_open'
  | 'fenced_close'
  | 'text'

export interface LexToken {
  kind: LineKind
  raw: string
  lineNumber: number
  directiveName?: string
  directiveArgs?: string
  fenceLang?: string | undefined
}

function classifyLine(raw: string, lineNumber: number): LexToken {
  const trimmed = raw.trim()

  if (!trimmed) return { kind: 'blank', raw, lineNumber }

  if (trimmed.startsWith('```') || trimmed.startsWith('~~~')) {
    const fence = trimmed.startsWith('```') ? '```' : '~~~'
    const lang = trimmed.slice(fence.length).trim()
    const kind = lang === '' ? 'fenced_close' : 'fenced_open'
    const token: LexToken = { kind, raw, lineNumber }
    if (lang) token.fenceLang = lang
    return token
  }

  if (trimmed.startsWith('@')) {
    const spaceIdx = trimmed.indexOf(' ')
    const name = spaceIdx === -1 ? trimmed.slice(1) : trimmed.slice(1, spaceIdx)
    const args = spaceIdx === -1 ? '' : trimmed.slice(spaceIdx + 1)
    return { kind: 'directive', raw, lineNumber, directiveName: name, directiveArgs: args }
  }

  return { kind: 'text', raw, lineNumber }
}

export function lex(source: string): LexToken[] {
  return source.split('\n').map((raw, i) => classifyLine(raw, i + 1))
}
