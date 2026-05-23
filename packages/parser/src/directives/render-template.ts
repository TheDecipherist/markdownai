import type { ParseModule, ParseContext, ASTNode, RenderTemplateNode } from '../types.js'
import { parseArgs } from '../args.js'

// @render-template from="<template>" to="<dest>" [force]
//   key1=value1
//   key2=value2
// @end
//
// Block directive. Renders a MarkdownAI template document (loaded via the
// data jail) with the provided key=value parameters as the macro substitution
// context, then writes the rendered output (sans the `@markdownai` header
// line) to the destination via the write jail.
//
// Idempotent by default: if `to` already exists, the directive is a no-op
// with a warning. Pass the bare flag `force` to overwrite.
const renderTemplate: ParseModule = {
  name: 'render-template',
  block: true,
  closeTag: 'end',
  parse(_rawLine: string, args: string, ctx: ParseContext): ASTNode {
    const parsed = parseArgs(args)
    const from = parsed.named['from'] ?? ''
    const to = parsed.named['to'] ?? ''
    const named: Record<string, string> = { ...parsed.named }
    for (const pos of parsed.positional) {
      if (pos === 'force' || pos === 'if-missing') named[pos] = 'true'
    }
    const node: RenderTemplateNode = {
      type: 'render-template',
      line: ctx.line,
      from,
      to,
      params: {},
      args: named,
    }
    return node
  },
}

export default renderTemplate
