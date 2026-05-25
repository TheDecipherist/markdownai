/**
 * Tracks which block we're parsing inside. Used by directives like @on which
 * are only valid inside @phase or @define blocks (or nested @if/@switch/etc.
 * inside those). An empty stack means we're at the top level of the document.
 */
export type BlockContext = 'phase' | 'define'

export interface State {
  lines: string[]
  pos: number
  filePath: string
  inImport: boolean
  shellInlinePassthrough: boolean
  blockStack: BlockContext[]
}

export function lineNum(state: State): number { return state.pos + 1 }
export function peek(state: State): string | undefined { return state.lines[state.pos] }
export function consume(state: State): string {
  const line = state.lines[state.pos] ?? ''
  state.pos++
  return line
}
