import type { ParseModule, ParseContext, DirectiveInput, ASTNode, TemplateNode } from '../types.js'
import { ParseError } from '../types.js'

const IDENT_RE = /^[A-Za-z_][A-Za-z0-9_]*$/

const template: ParseModule = {
  name: 'template',
  parse(input: DirectiveInput, ctx: ParseContext): ASTNode {
    const path = input.positional || input.attrs['path'] || ''
    if (path === '') {
      throw new ParseError('@template requires a path', ctx.line, ctx.filePath)
    }
    if (path.startsWith('/')) {
      throw new ParseError('@template does not allow absolute paths (filesystem confinement)', ctx.line, ctx.filePath)
    }
    if (path.split(/[/\\]/).some(seg => seg === '..')) {
      throw new ParseError('@template does not allow path traversal (..)', ctx.line, ctx.filePath)
    }

    const dataExpr = input.attrs['data'] ?? null

    const rawAs = input.attrs['as']
    let asName = 'data'
    if (typeof rawAs === 'string' && rawAs !== '') {
      if (!IDENT_RE.test(rawAs)) {
        throw new ParseError('@template as= must match [A-Za-z_][A-Za-z0-9_]*', ctx.line, ctx.filePath)
      }
      asName = rawAs
    }

    let condition: string | null = input.attrs['if'] ?? null
    if (!condition) {
      const m = input.rawArgs.match(/(?:^|\s)if\s+(.+?)\s*$/)
      if (m && m[1]) condition = m[1].trim()
    }

    const node: TemplateNode = {
      type: 'template',
      line: ctx.line,
      path,
      dataExpr,
      asName,
      condition,
      cache: null,
    }
    return node
  },
}

export default template
