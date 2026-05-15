import type { ASTNode, ConditionalBranch } from '@markdownai/parser'
import { scanInterpolations } from '@markdownai/parser'

export function substituteParams(body: ASTNode[], args: Record<string, string>): ASTNode[] {
  return body.map(node => substituteNode(node, args))
}

function substituteNode(node: ASTNode, args: Record<string, string>): ASTNode {
  if (node.type === 'markdown') {
    let text = node.text
    for (const [key, val] of Object.entries(args)) {
      text = text.replaceAll(`{{${key}}}`, val)
    }
    // Re-scan interpolations since positions change after param substitution
    return { ...node, text, interpolations: scanInterpolations(text) }
  }
  if (node.type === 'define') {
    return { ...node, body: substituteParams(node.body, args) }
  }
  if (node.type === 'phase') {
    return { ...node, body: substituteParams(node.body, args) }
  }
  if (node.type === 'conditional') {
    const branches: ConditionalBranch[] = node.branches.map(b => ({
      ...b,
      body: substituteParams(b.body, args),
    }))
    return { ...node, branches }
  }
  return node
}
