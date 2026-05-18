export interface State {
  lines: string[]
  pos: number
  filePath: string
  inImport: boolean
  shellInlinePassthrough: boolean
}

export function lineNum(state: State): number { return state.pos + 1 }
export function peek(state: State): string | undefined { return state.lines[state.pos] }
export function consume(state: State): string {
  const line = state.lines[state.pos] ?? ''
  state.pos++
  return line
}
