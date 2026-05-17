import type { ParseModule, ParseContext, ASTNode, QueryNode } from '../types.js'
import { parseArgs } from '../args.js'

const query: ParseModule = {
  name: 'query',
  block: false,
  parse(_rawLine: string, args: string, ctx: ParseContext): ASTNode {
    const parsed = parseArgs(args)
    // Single positional: use as-is (e.g. @query "SELECT * FROM users")
    // Multiple positionals: rejoin, re-quoting any that contain spaces (e.g. bash -c "echo hi")
    const command = parsed.positional.length === 1
      ? (parsed.positional[0] ?? '')
      : parsed.positional.length > 1
        ? parsed.positional.map(p => p.includes(' ') ? `"${p}"` : p).join(' ')
        : parsed.named['command'] ?? ''
    const node: QueryNode = {
      type: 'query',
      line: ctx.line,
      command,
      args: parsed.named,
      cache: parsed.cache,
    }
    return node
  },
}

export default query
