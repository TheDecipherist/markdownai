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
    case 'mkdir':
      return { ...node, path: subStr(node.path, args), args: subArgs(node.args, args) }
    case 'copy':
      return {
        ...node,
        from: subStr(node.from, args),
        to: subStr(node.to, args),
        args: subArgs(node.args, args),
      }
    case 'append-if-missing':
      return {
        ...node,
        path: subStr(node.path, args),
        text: subStr(node.text, args),
        args: subArgs(node.args, args),
      }
    case 'update-frontmatter':
      return {
        ...node,
        path: subStr(node.path, args),
        field: subStr(node.field, args),
        value: subStr(node.value, args),
        args: subArgs(node.args, args),
      }
    case 'read-frontmatter':
      return {
        ...node,
        path: subStr(node.path, args),
        field: subStr(node.field, args),
        args: subArgs(node.args, args),
      }
    case 'render-template': {
      const subbedParams: Record<string, string> = {}
      for (const [k, v] of Object.entries(node.params)) subbedParams[k] = subStr(v, args)
      return {
        ...node,
        from: subStr(node.from, args),
        to: subStr(node.to, args),
        params: subbedParams,
        args: subArgs(node.args, args),
      }
    }
    case 'test':
    case 'check':
      return {
        ...node,
        command: node.command === null ? null : subStr(node.command, args),
        args: subArgs(node.args, args),
      }
    case 'hash':
      return {
        ...node,
        path: subStr(node.path, args),
        args: subArgs(node.args, args),
      }
    case 'foreach':
      return {
        ...node,
        literalSource: node.literalSource === null ? null : subStr(node.literalSource, args),
        body: node.body.map(n => substituteNode(n, args)),
        args: subArgs(node.args, args),
      }
    case 'set':
      return {
        ...node,
        literalExpr: node.literalExpr === null ? null : subStr(node.literalExpr, args),
        args: subArgs(node.args, args),
      }
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
    // header, transition, env, graph, passthrough, chunk-boundary — no user-visible string params to substitute
    case 'header':
    case 'transition':
    case 'env':
    case 'graph':
    case 'passthrough':
    case 'chunk-boundary':
      return node
    default:
      throw new Error(`substituteNode: unhandled AST node type "${(node as { type: string }).type}"`)

  }
}
