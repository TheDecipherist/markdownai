import type { ParseModule, ParseContext, DirectiveInput, ASTNode, HeaderNode } from '../types.js'

const SHELL_INLINE_RE = /\bshell-inline\s*=\s*"([^"]*)"|\bshell-inline\s*=\s*'([^']*)'|\bshell-inline\s*=\s*(\S+)/

const header: ParseModule = {
  name: 'markdownai',
  parse(input: DirectiveInput, ctx: ParseContext): ASTNode {
    // Parse out the version (e.g. `v2.0`) from rawArgs.
    const m = input.rawArgs.match(/^v(\d+\.\d+)\b/)
    const version = m?.[1] ?? null
    const fromAttr = input.attrs['shell-inline']
    let shellInlineValue: string | undefined = typeof fromAttr === 'string' ? fromAttr : undefined
    if (shellInlineValue === undefined) {
      const sim = input.rawArgs.match(SHELL_INLINE_RE)
      if (sim) shellInlineValue = sim[1] ?? sim[2] ?? sim[3]
    }
    const shellInline = shellInlineValue === 'passthrough' ? 'passthrough' : null
    const node: HeaderNode = { type: 'header', line: ctx.line, version, shellInline }
    return node
  },
}

export default header
