export interface ASTNodeBase {
  type: string
  line: number
}

export interface CacheConfig {
  mode: 'session' | 'persist' | 'mock'
  ttl?: number
  mockPath?: string
}

export interface InterpolationSpan {
  start: number
  end: number
  expression: string
  escaped: boolean
}

export interface ShellInlineSpan {
  start: number
  end: number
  command: string
}

export interface HeaderNode extends ASTNodeBase {
  type: 'header'
  version: string | null
}

export interface IncludeNode extends ASTNodeBase {
  type: 'include'
  path: string
  condition: string | null
  local: boolean
  cache: CacheConfig | null
}

export interface ImportNode extends ASTNodeBase {
  type: 'import'
  path: string
  condition: string | null
  local: boolean
  cache: CacheConfig | null
}

export interface EnvNode extends ASTNodeBase {
  type: 'env'
  name: string
  fallback: string | null
}

export interface DefineNode extends ASTNodeBase {
  type: 'define'
  name: string
  params: string[]
  local: boolean
  body: ASTNode[]
}

export interface CallNode extends ASTNodeBase {
  type: 'call'
  name: string
  args: Record<string, string>
  positionalArgs: string[]
}

export type TransitionAction =
  | { type: 'phase'; name: string }
  | { type: 'macro'; name: string; args: Record<string, string> }

export interface TransitionNode extends ASTNodeBase {
  type: 'transition'
  event: 'complete'
  action: TransitionAction
}

export interface PhaseNode extends ASTNodeBase {
  type: 'phase'
  name: string
  body: ASTNode[]
  transitions: TransitionNode[]
}

export interface ConnectNode extends ASTNodeBase {
  type: 'connect'
  name: string
  connectionType: string
  args: Record<string, string>
  local: boolean
}

export interface ListNode extends ASTNodeBase {
  type: 'list'
  path: string
  args: Record<string, string>
  cache: CacheConfig | null
}

export interface ReadNode extends ASTNodeBase {
  type: 'read'
  path: string
  args: Record<string, string>
  cache: CacheConfig | null
}

export interface QueryNode extends ASTNodeBase {
  type: 'query'
  command: string
  args: Record<string, string>
  cache: CacheConfig | null
}

export interface DbNode extends ASTNodeBase {
  type: 'db'
  args: Record<string, string>
  cache: CacheConfig | null
}

export interface HttpNode extends ASTNodeBase {
  type: 'http'
  args: Record<string, string>
  cache: CacheConfig | null
}

export interface TreeNode extends ASTNodeBase {
  type: 'tree'
  path: string
  args: Record<string, string>
  cache: CacheConfig | null
}

export interface DateNode extends ASTNodeBase {
  type: 'date'
  args: Record<string, string>
}

export interface CountNode extends ASTNodeBase {
  type: 'count'
  path: string
  args: Record<string, string>
}

export interface RenderNode extends ASTNodeBase {
  type: 'render'
  args: Record<string, string>
}

export interface ConditionalBranch {
  condition: string | null
  body: ASTNode[]
}

export interface ConditionalNode extends ASTNodeBase {
  type: 'conditional'
  branches: ConditionalBranch[]
}

export type PipeStage =
  | { type: 'source'; node: ASTNode }
  | { type: 'builtin'; command: string }
  | { type: 'shell'; command: string }
  | { type: 'sink'; node: RenderNode }
  | { type: 'scalar' }

export interface PipeNode extends ASTNodeBase {
  type: 'pipe'
  stages: PipeStage[]
}

export interface GraphNode extends ASTNodeBase {
  type: 'graph'
  raw: string
}

export interface MarkdownNode extends ASTNodeBase {
  type: 'markdown'
  text: string
  interpolations: InterpolationSpan[]
  shellInlines: ShellInlineSpan[]
}

export interface PassthroughNode extends ASTNodeBase {
  type: 'passthrough'
  raw: string
}

export interface InterpolationNode extends ASTNodeBase {
  type: 'interpolation'
  expression: string
  escaped: boolean
}

export interface PromptNode extends ASTNodeBase {
  type: 'prompt'
  role: string
  body: string
}

export interface SectionNode extends ASTNodeBase {
  type: 'section'
  id: string | null
  priority: 'critical' | 'high' | 'medium' | 'low'
  body: ASTNode[]
}

export interface ChunkBoundaryNode extends ASTNodeBase {
  type: 'chunk-boundary'
  id: string
  standalone: boolean
}

export interface ConceptNode extends ASTNodeBase {
  type: 'define-concept'
  name: string
  definition: string
}

export interface ConstraintNode extends ASTNodeBase {
  type: 'constraint'
  id: string
  severity: 'critical' | 'high' | 'medium' | 'low'
  body: string
}

export type ASTNode =
  | HeaderNode
  | IncludeNode
  | ImportNode
  | EnvNode
  | DefineNode
  | CallNode
  | TransitionNode
  | PhaseNode
  | ConnectNode
  | ListNode
  | ReadNode
  | QueryNode
  | DbNode
  | HttpNode
  | TreeNode
  | DateNode
  | CountNode
  | RenderNode
  | ConditionalNode
  | PipeNode
  | GraphNode
  | MarkdownNode
  | PassthroughNode
  | InterpolationNode
  | PromptNode
  | SectionNode
  | ChunkBoundaryNode
  | ConceptNode
  | ConstraintNode

export interface ParseResult {
  isMarkdownAI: boolean
  version: string | null
  nodes: ASTNode[]
}

export interface ParseOptions {
  filePath?: string
  inImport?: boolean
}

export interface ParseContext {
  line: number
  filePath: string
  inImport: boolean
}

export interface ParseModule {
  name: string
  block: boolean
  closeTag?: 'end' | 'endif'
  parse(rawLine: string, args: string, ctx: ParseContext): ASTNode
}

export class ParseError extends Error {
  constructor(
    message: string,
    public readonly sourceLine: number,
    public readonly filePath: string
  ) {
    super(`[${filePath}:${sourceLine}] ${message}`)
    this.name = 'ParseError'
  }
}
