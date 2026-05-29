import type {
  ParseModule, ParseContext, DirectiveInput, ASTNode,
  DataNode, DataEntry,
} from '../types.js'
import { ParseError } from '../types.js'

const IDENT_RE = /^[A-Za-z_][A-Za-z0-9_]*$/
const KEY_PATH_RE = /^[A-Za-z_][A-Za-z0-9_]*(?:\.[A-Za-z_][A-Za-z0-9_]*)*$/

const data: ParseModule = {
  name: 'data',
  parse(input: DirectiveInput, ctx: ParseContext): ASTNode {
    // @data is registered as a verbatim-body directive (see parser.ts), so
    // every line after the opener arrives in input.body unaltered — no
    // attr extraction, no quote stripping, no flag side-channel.
    const name = input.positional || input.attrs['name'] || ''
    if (name === '') {
      throw new ParseError('@data requires a variable name', ctx.line, ctx.filePath)
    }
    if (!IDENT_RE.test(name)) {
      throw new ParseError('@data name must match [A-Za-z_][A-Za-z0-9_]*', ctx.line, ctx.filePath)
    }

    const entries: DataEntry[] = []
    for (let i = 0; i < input.body.length; i++) {
      const raw = input.body[i]!
      const trimmed = raw.trim()
      if (trimmed === '' || trimmed.startsWith('#')) continue
      const sourceLine = ctx.line + 1 + i

      if (trimmed.startsWith('...')) {
        const rhs = trimmed.slice(3).trim()
        if (rhs === '') {
          throw new ParseError(
            '@data body lines must be <key> = <expression> or ...<expression>',
            sourceLine, ctx.filePath,
          )
        }
        entries.push({ kind: 'spread', rhs, line: sourceLine })
        continue
      }

      const eq = trimmed.indexOf('=')
      if (eq <= 0) {
        throw new ParseError(
          '@data body lines must be <key> = <expression> or ...<expression>',
          sourceLine, ctx.filePath,
        )
      }
      const keyRaw = trimmed.slice(0, eq).trim()
      const rhs = trimmed.slice(eq + 1).trim()
      if (!KEY_PATH_RE.test(keyRaw)) {
        throw new ParseError(
          '@data body lines must be <key> = <expression> or ...<expression>',
          sourceLine, ctx.filePath,
        )
      }
      const key = keyRaw.split('.')
      entries.push({ kind: 'assign', key, rhs, line: sourceLine })
    }

    const node: DataNode = {
      type: 'data',
      line: ctx.line,
      name,
      entries,
    }
    return node
  },
}

export default data
