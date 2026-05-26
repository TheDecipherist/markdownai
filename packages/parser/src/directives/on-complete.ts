import type { ParseModule, ParseContext, DirectiveInput, ASTNode, TransitionNode, TransitionAction } from '../types.js'
import { ParseError } from '../types.js'

// v2 syntax: `@on-complete <target> /`
//
//   - <target> is a bare phase name           → action: { type: 'phase', name }
//   - <target> is the literal `halt`          → action: { type: 'halt' }
//   - <target> is the literal `next`          → action: { type: 'next' }
//   - <target> is `@phase <name>`             → action: { type: 'phase', name }
//   - <target> is `@call <name>`              → action: { type: 'macro', name, args }
//   - <target> is `@<some-macro>` (sugar for @call) → action: { type: 'macro' }
//
// The parser already validates that @on-complete only appears inside a @phase
// or @define block context. The parser also strips the trailing ` /` from
// rawArgs before calling parse().
const onComplete: ParseModule = {
  name: 'on-complete',
  parse(input: DirectiveInput, ctx: ParseContext): ASTNode {
    const target = input.rawArgs.trim()
    if (!target) {
      throw new ParseError(
        '@on-complete requires a target (phase name, halt, next, or @call <macro>)',
        ctx.line, ctx.filePath,
      )
    }

    let action: TransitionAction
    if (target === 'halt') {
      action = { type: 'halt' }
    } else if (target === 'next') {
      action = { type: 'next' }
    } else if (target.startsWith('@phase ')) {
      const phaseName = target.slice('@phase '.length).trim()
      action = { type: 'phase', name: phaseName }
    } else if (target.startsWith('@call ')) {
      const rest = target.slice('@call '.length).trim()
      const parts = rest.split(/\s+/)
      action = { type: 'macro', name: parts[0] ?? '', args: {} }
    } else if (target.startsWith('@')) {
      // Bare `@some-macro` — treat as a @call shorthand.
      const rest = target.slice(1).trim()
      const parts = rest.split(/\s+/)
      action = { type: 'macro', name: parts[0] ?? '', args: {} }
    } else if (/^[A-Za-z_][\w.]*$/.test(target) || /^\d/.test(target)) {
      // Bare phase-name form: `@on-complete 0_5_repo_version_check /`. Identifier
      // shape (alphanumeric + underscore + dot, may start with a digit because
      // mdd2 uses names like `7c_complete`).
      action = { type: 'phase', name: target }
    } else {
      throw new ParseError(
        `Invalid @on-complete target: "${target}". Expected a phase name, halt, next, @phase NAME, or @call NAME.`,
        ctx.line, ctx.filePath,
      )
    }

    const node: TransitionNode = {
      type: 'transition',
      line: ctx.line,
      event: 'complete',
      action,
    }
    void input
    return node
  },
}

export default onComplete
