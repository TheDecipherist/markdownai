import { readFileSync, readdirSync, statSync } from 'node:fs'
import { resolve, join, dirname } from 'node:path'
import { runInNewContext } from 'node:vm'
import type {
  ASTNode, ParseResult, IncludeNode, ImportNode, ListNode,
  ReadNode, TreeNode, CountNode, DateNode, ConnectNode,
  DefineNode, CallNode, PhaseNode, ConditionalNode, PipeNode,
  InterpolationSpan, RenderNode,
} from '@markdownai/parser'
import { parse } from '@markdownai/parser'
import { render } from '@markdownai/renderer'
import type { RenderType, RendererInput } from '@markdownai/renderer'
import { makeContext, resolveEnv, type EngineContext } from './context.js'
import { substituteParams } from './macros.js'
import { evalCondition } from './conditions.js'
import { runBuiltin, isBuiltin } from './pipe.js'
import { runShell } from './shell.js'

export interface EngineOptions {
  ctx?: Partial<EngineContext>
  filePath?: string
}

export interface EngineResult {
  output: string
  errors: string[]
}

export function execute(ast: ParseResult, options?: EngineOptions): EngineResult {
  if (!ast.isMarkdownAI) {
    return { output: '', errors: ['Not a MarkdownAI document (missing @markdownai header)'] }
  }
  const base = makeContext(options?.ctx)
  if (options?.filePath) base.docDir = dirname(resolve(options.filePath))
  const errors: string[] = []
  const parts: string[] = []
  for (const node of ast.nodes) {
    try {
      const out = walkNode(node, base)
      if (out !== '') parts.push(out)
    } catch (err) {
      errors.push(String(err))
    }
  }
  return { output: parts.join('\n'), errors }
}

function walkNodes(nodes: ASTNode[], ctx: EngineContext): string[] {
  const parts: string[] = []
  for (const node of nodes) {
    try {
      const out = walkNode(node, ctx)
      if (out !== '') parts.push(out)
    } catch { /* caller handles */ }
  }
  return parts
}

function walkNode(node: ASTNode, ctx: EngineContext): string {
  switch (node.type) {
    case 'header': return ''
    case 'transition': return ''
    case 'passthrough': return node.raw
    case 'graph': return node.raw
    case 'markdown': return resolveInterpolations(node.text, node.interpolations, ctx)
    case 'env': return resolveEnv(node.name, node.fallback, ctx)
    case 'connect': return handleConnect(node, ctx)
    case 'define': return handleDefine(node, ctx)
    case 'call': return handleCall(node, ctx)
    case 'phase': return handlePhase(node, ctx)
    case 'conditional': return handleConditional(node, ctx)
    case 'pipe': return executePipe(node, ctx)
    case 'include': return executeInclude(node, ctx)
    case 'import': { executeImport(node, ctx); return '' }
    case 'list':
    case 'read':
    case 'tree':
    case 'count':
    case 'date': return executeSource(node, ctx).join('\n')
    default: return ''
  }
}

function handleConnect(node: ConnectNode, ctx: EngineContext): string {
  ctx.connections[node.name] = { type: node.connectionType, args: node.args }
  return ''
}

function handleDefine(node: DefineNode, ctx: EngineContext): string {
  ctx.macros[node.name] = { body: node.body }
  return ''
}

function handleCall(node: CallNode, ctx: EngineContext): string {
  const macro = ctx.macros[node.name]
  if (!macro) return ''
  return walkNodes(substituteParams(macro.body, node.args), ctx).join('\n')
}

function handlePhase(node: PhaseNode, ctx: EngineContext): string {
  if (ctx.phase !== null && ctx.phase !== node.name) return ''
  return walkNodes(node.body, ctx).join('\n')
}

function handleConditional(node: ConditionalNode, ctx: EngineContext): string {
  for (const branch of node.branches) {
    if (branch.condition === null || evalCondition(branch.condition, ctx)) {
      return walkNodes(branch.body, ctx).join('\n')
    }
  }
  return ''
}

function executePipe(node: PipeNode, ctx: EngineContext): string {
  let lines: string[] = []
  for (const stage of node.stages) {
    switch (stage.type) {
      case 'source': lines = executeSource(stage.node, ctx); break
      case 'builtin': lines = runBuiltin(stage.command, lines); break
      case 'shell': lines = runShell(stage.command, lines, ctx); break
      case 'sink': return renderSink(stage.node, lines)
      case 'scalar': return lines.join(' ')
    }
  }
  return render({ type: 'list', data: lines })
}

function renderSink(node: RenderNode, lines: string[]): string {
  const { type: t, columns: cols, ...rest } = node.args
  const input: RendererInput = { type: (t ?? 'list') as RenderType, data: lines }
  if (cols) input.columns = cols.split(',').map((c: string) => c.trim())
  if (Object.keys(rest).length > 0) input.options = rest
  return render(input)
}

function executeSource(node: ASTNode, ctx: EngineContext): string[] {
  switch (node.type) {
    case 'env': {
      const val = resolveEnv(node.name, node.fallback, ctx)
      return val === '' ? [] : val.split('\n')
    }
    case 'list': return executeList(node, ctx)
    case 'read': return executeRead(node, ctx)
    case 'tree': return buildTree(resolve(ctx.docDir, node.path), '')
    case 'count': return executeCount(node, ctx)
    case 'date': return executeDate(node)
    default: throw new Error(`"@${node.type}" cannot be used as a pipe source`)
  }
}

function executeList(node: ListNode, ctx: EngineContext): string[] {
  const full = resolve(ctx.docDir, node.path)
  try {
    return readdirSync(full).map(e => join(node.path.replace(/\/$/, ''), e))
  } catch { return [] }
}

function executeRead(node: ReadNode, ctx: EngineContext): string[] {
  try {
    return readFileSync(resolve(ctx.docDir, node.path), 'utf8').split('\n').filter(l => l !== '')
  } catch { return [] }
}

function executeCount(node: CountNode, ctx: EngineContext): string[] {
  try {
    const full = resolve(ctx.docDir, node.path)
    const st = statSync(full)
    if (st.isDirectory()) return [String(readdirSync(full).length)]
    return [String(readFileSync(full, 'utf8').split('\n').length)]
  } catch { return ['0'] }
}

function executeDate(node: DateNode): string[] {
  const fmt = node.args['format'] ?? 'ISO'
  const now = new Date()
  if (fmt === 'date') return [now.toISOString().split('T')[0] ?? '']
  return [now.toISOString()]
}

function buildTree(dir: string, prefix: string): string[] {
  let entries: import('node:fs').Dirent[]
  try { entries = readdirSync(dir, { withFileTypes: true }) } catch { return [] }
  const lines: string[] = []
  entries.forEach((entry, i) => {
    const isLast = i === entries.length - 1
    lines.push(prefix + (isLast ? '└── ' : '├── ') + entry.name)
    if (entry.isDirectory()) {
      lines.push(...buildTree(join(dir, entry.name), prefix + (isLast ? '    ' : '│   ')))
    }
  })
  return lines
}

function executeInclude(node: IncludeNode, ctx: EngineContext): string {
  const full = resolve(ctx.docDir, node.path)
  let source: string
  try { source = readFileSync(full, 'utf8') } catch { return '' }
  const ast = parse(source, { filePath: full })
  if (!ast.isMarkdownAI) return ''
  return walkNodes(ast.nodes, { ...ctx, docDir: dirname(full) }).join('\n')
}

function executeImport(node: ImportNode, ctx: EngineContext): void {
  const full = resolve(ctx.docDir, node.path)
  let source: string
  try { source = readFileSync(full, 'utf8') } catch { return }
  const ast = parse(source, { filePath: full, inImport: true })
  if (!ast.isMarkdownAI) return
  for (const n of ast.nodes) {
    if (n.type === 'env' && n.fallback !== null) ctx.envFallbacks[n.name] = n.fallback
    else if (n.type === 'define') ctx.macros[n.name] = { body: n.body }
  }
}

function resolveInterpolations(text: string, spans: InterpolationSpan[], ctx: EngineContext): string {
  if (spans.length === 0) return text
  let result = ''
  let pos = 0
  for (const span of spans) {
    result += text.slice(pos, span.start)
    result += span.escaped ? `{{${span.expression}}}` : evalExpr(span.expression, ctx)
    pos = span.end
  }
  return result + text.slice(pos)
}

function evalExpr(expr: string, ctx: EngineContext): string {
  const trimmed = expr.trim()
  if (/^[A-Z_][A-Z0-9_]*$/.test(trimmed)) return resolveEnv(trimmed, null, ctx)
  try {
    const result = runInNewContext(trimmed, { ...ctx.env, ...ctx.envFiles }, { timeout: 500 })
    return String(result ?? '')
  } catch { return '' }
}
