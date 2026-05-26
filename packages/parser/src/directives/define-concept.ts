import type { ParseModule, ParseContext, DirectiveInput, ASTNode, ConceptNode } from '../types.js'

const defineConcept: ParseModule = {
  name: 'define-concept',
  parse(input: DirectiveInput, ctx: ParseContext): ASTNode {
    // v1: `@define-concept name "definition text"` — two positionals.
    // v2 (self-close): `@define-concept name definition="text" /` — attr-based.
    // Support both shapes: positional[0] = name; definition = attrs.definition
    // or fall back to the rest of the line (everything after the first token).
    const name = input.positional
    let definition = input.attrs['definition'] ?? ''
    if (!definition && input.flags.length > 0) {
      definition = input.flags.join(' ')
    }
    const node: ConceptNode = { type: 'define-concept', line: ctx.line, name, definition }
    return node
  },
}

export default defineConcept
