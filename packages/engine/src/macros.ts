import type {
  ASTNode, ConditionalBranch, PipeStage,
  IncludeNode, ImportNode, ListNode, ReadNode, TreeNode, CountNode,
  QueryNode, DbNode, HttpNode, DateNode, RenderNode, ConnectNode, CallNode,
  SectionNode, PromptNode, NoteNode, ConceptNode, ConstraintNode,
} from '@markdownai/parser'
import { scanInterpolations } from '@markdownai/parser'

export function substituteParams(body: ASTNode[], args: Record<string, string>): ASTNode[] {
  return body.map(node => substituteNode(node, args))
}

function subStr(s: string, args: Record<string, string>): string {
  let r = s
  for (const [k, v] of Object.entries(args)) {
    // Escape regex metacharacters in the key before building the pattern
    const escapedKey = k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    // Escape $ in the value so String.replace doesn't interpret $1, $&, etc.
    const safeValue = v.replace(/\$/g, '$$$$')
    r = r.replace(new RegExp(`\\{\\{\\s*${escapedKey}\\s*\\}\\}`, 'g'), safeValue)
  }
  return r
}

function subArgs(a: Record<string, string>, args: Record<string, string>): Record<string, string> {
  return Object.fromEntries(Object.entries(a).map(([k, v]) => [k, subStr(v, args)]))
}

function substituteNode(node: ASTNode, args: Record<string, string>): ASTNode {
  switch (node.type) {
    case 'markdown': {
      const text = subStr(node.text, args)
      return { ...node, text, interpolations: scanInterpolations(text) }
    }
    case 'define':
      return { ...node, body: substituteParams(node.body, args) }
    case 'phase':
      return { ...node, body: substituteParams(node.body, args) }
    case 'conditional': {
      const branches: ConditionalBranch[] = node.branches.map(b => ({
        ...b,
        body: substituteParams(b.body, args),
      }))
      return { ...node, branches }
    }
    case 'include':
      return { ...node as IncludeNode, path: subStr(node.path, args) }
    case 'import':
      return { ...node as ImportNode, path: subStr(node.path, args) }
    case 'list':
      return { ...node as ListNode, path: subStr(node.path, args), args: subArgs(node.args, args) }
    case 'read':
      return { ...node as ReadNode, path: subStr(node.path, args), args: subArgs(node.args, args) }
    case 'tree':
      return { ...node as TreeNode, path: subStr(node.path, args), args: subArgs(node.args, args) }
    case 'count':
      return { ...node as CountNode, path: subStr(node.path, args), args: subArgs(node.args, args) }
    case 'query':
      return { ...node as QueryNode, command: subStr(node.command, args), args: subArgs(node.args, args) }
    case 'db':
      return { ...node as DbNode, args: subArgs(node.args, args) }
    case 'http':
      return { ...node as HttpNode, args: subArgs(node.args, args) }
    case 'date':
      return { ...node as DateNode, args: subArgs(node.args, args) }
    case 'render':
      return { ...node as RenderNode, args: subArgs(node.args, args) }
    case 'connect':
      return { ...node as ConnectNode, args: subArgs(node.args, args) }
    case 'call': {
      const n = node as CallNode
      return {
        ...n,
        args: subArgs(n.args, args),
        positionalArgs: n.positionalArgs.map(v => subStr(v, args)),
      }
    }
    case 'pipe': {
      const stages: PipeStage[] = node.stages.map(s => {
        if (s.type === 'source') return { ...s, node: substituteNode(s.node, args) }
        if (s.type === 'builtin') return { ...s, command: subStr(s.command, args) }
        if (s.type === 'shell') return { ...s, command: subStr(s.command, args) }
        if (s.type === 'sink') return { ...s, node: { ...s.node, args: subArgs(s.node.args, args) } }
        return s
      })
      return { ...node, stages }
    }
    case 'section':
      return { ...node as SectionNode, body: substituteParams(node.body, args) }
    case 'prompt':
      return { ...node as PromptNode, body: subStr(node.body, args) }
    case 'note':
      return { ...node as NoteNode, body: subStr(node.body, args) }
    case 'define-concept':
      return { ...node as ConceptNode, definition: subStr(node.definition, args) }
    case 'constraint':
      return { ...node as ConstraintNode, body: subStr(node.body, args) }
    // header, transition, env, graph, passthrough — no user-visible string params to substitute
    default:
      return node
  }
}
