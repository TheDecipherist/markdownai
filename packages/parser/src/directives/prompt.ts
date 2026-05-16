import type { ParseModule, ParseContext, ASTNode, PromptNode } from '../types.js'
import { parseArgs } from '../args.js'

const VALID_ROLES = new Set(['context', 'constraint', 'calibration', 'instruction'])

const prompt: ParseModule = {
  name: 'prompt',
  block: true,
  closeTag: 'end',
  parse(_rawLine: string, args: string, ctx: ParseContext): ASTNode {
    const parsed = parseArgs(args)
    const role = parsed.named['role'] ?? 'context'
    if (!VALID_ROLES.has(role)) {
      // Unknown role — accept with no error (forward compatibility)
    }
    const node: PromptNode = { type: 'prompt', line: ctx.line, role, body: '' }
    return node
  },
}

export default prompt
