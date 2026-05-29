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
  /**
   * Per-document opt-out from MarkdownAI's shell-inline interception.
   * When `"passthrough"` is set on the header line, `` !`...` `` syntax is left
   * unevaluated in the rendered output (and no shell-security warnings are
   * emitted) so Claude Code can evaluate it natively. Anything else is
   * treated as the default "intercept" behavior.
   */
  shellInline: 'passthrough' | null
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
  transitions: TransitionNode[]
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
  | { type: 'halt' }
  | { type: 'next' }

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

// v2.0 write directives
export interface MkdirNode extends ASTNodeBase {
  type: 'mkdir'
  path: string
  args: Record<string, string>  // optional: recursive=false (default true)
}

export interface TouchNode extends ASTNodeBase {
  type: 'touch'
  path: string
  args: Record<string, string>
}

export interface CopyNode extends ASTNodeBase {
  type: 'copy'
  from: string
  to: string
  args: Record<string, string>  // optional: if-missing (boolean flag)
}

export interface AppendIfMissingNode extends ASTNodeBase {
  type: 'append-if-missing'
  path: string
  text: string
  args: Record<string, string>
}

export interface UpdateFrontmatterNode extends ASTNodeBase {
  type: 'update-frontmatter'
  path: string
  field: string
  value: string
  args: Record<string, string>
}

export interface ReadFrontmatterNode extends ASTNodeBase {
  type: 'read-frontmatter'
  path: string
  field: string
  args: Record<string, string>  // optional: label=
}

export interface RenderTemplateNode extends ASTNodeBase {
  type: 'render-template'
  from: string
  to: string
  params: Record<string, string>
  args: Record<string, string>  // optional: force (bare flag) / if-missing
}

export interface TestNode extends ASTNodeBase {
  type: 'test'
  command: string | null
  args: Record<string, string>  // optional: command=, label=, budget=
}

export interface CheckNode extends ASTNodeBase {
  type: 'check'
  command: string | null
  args: Record<string, string>  // optional: command=, label=, budget=
}

export interface HashNode extends ASTNodeBase {
  type: 'hash'
  path: string
  args: Record<string, string>  // optional: algo=, length=, exclude-line=, label=
}

export interface ForeachNode extends ASTNodeBase {
  type: 'foreach'
  varName: string           // identifier bound to each item inside the body
  source: ASTNode | null    // a directive node whose output is the list (list / read / read-frontmatter / query)
  literalSource: string | null  // raw "{{ label }}" or comma list when no directive node was parseable
  body: ASTNode[]
  args: Record<string, string>
}

export interface SetNode extends ASTNodeBase {
  type: 'set'
  varName: string           // identifier to bind
  source: ASTNode | null    // a directive node whose output becomes the value
  literalExpr: string | null  // raw expression for arithmetic / interpolation
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

export interface SwitchCase {
  caseExpression: string
  body: ASTNode[]
}

export interface SwitchNode extends ASTNodeBase {
  type: 'switch'
  expression: string
  cases: SwitchCase[]
  defaultBody: ASTNode[] | null
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
  // Known literal severities: critical | high | medium | low | warning | cosmetic.
  // String fallback covers templated values like "{{ this.severity }}" which
  // resolve at engine evaluation time rather than at parse time.
  severity: 'critical' | 'high' | 'medium' | 'low' | 'warning' | 'cosmetic' | string
  body: string
}

export interface NoteNode extends ASTNodeBase {
  type: 'note'
  visible: boolean
  consumer?: string
  body: string
}

export interface EventNode extends ASTNodeBase {
  type: 'event'
  name: string
  data: string
  transports: string[]
  visible: boolean
}

export interface PluginMetaNode extends ASTNodeBase {
  type: 'plugin-meta'
  body: string
}

export interface PluginDetectNode extends ASTNodeBase {
  type: 'plugin-detect'
  body: string
}

export interface PluginLayoutNode extends ASTNodeBase {
  type: 'plugin-layout'
  body: string
}

export interface PluginConventionsNode extends ASTNodeBase {
  type: 'plugin-conventions'
  body: string
}

export interface MarkdownaiDetectNode extends ASTNodeBase {
  type: 'markdownai-detect'
  format: 'text' | 'info'
  include: string[]
  label: string | null
  projectOverride: string | null
}

export interface PluginDataNode extends ASTNodeBase {
  type: 'plugin-data'
  name: string
  include: string[]
  label: string | null
  projectOverride: string | null
}

export interface TemplateNode extends ASTNodeBase {
  type: 'template'
  path: string
  dataExpr: string | null
  asName: string
  condition: string | null
  cache: CacheConfig | null
}

export interface DataAssignEntry {
  kind: 'assign'
  key: string[]
  rhs: string
  line: number
}

export interface DataSpreadEntry {
  kind: 'spread'
  rhs: string
  line: number
}

export type DataEntry = DataAssignEntry | DataSpreadEntry

export interface DataNode extends ASTNodeBase {
  type: 'data'
  name: string
  entries: DataEntry[]
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
  | MkdirNode
  | TouchNode
  | CopyNode
  | AppendIfMissingNode
  | UpdateFrontmatterNode
  | ReadFrontmatterNode
  | RenderTemplateNode
  | TestNode
  | CheckNode
  | HashNode
  | ForeachNode
  | SetNode
  | RenderNode
  | ConditionalNode
  | SwitchNode
  | PipeNode
  | GraphNode
  | MarkdownNode
  | PassthroughNode
  | PromptNode
  | SectionNode
  | ChunkBoundaryNode
  | ConceptNode
  | ConstraintNode
  | NoteNode
  | EventNode
  | PluginMetaNode
  | PluginDetectNode
  | PluginLayoutNode
  | PluginConventionsNode
  | MarkdownaiDetectNode
  | PluginDataNode
  | TemplateNode
  | DataNode

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

/**
 * v2.0 DirectiveInput — what each directive's parse() now receives.
 *
 * The parser pre-tokenizes the opener line + continuation lines into:
 *   - positional: the first whitespace-separated argument on the opener line
 *     after the directive name (everything up to the first key=value attr or
 *     the trailing `/` self-close marker). Empty string if absent.
 *   - attrs: key=value attributes from the opener line AND from continuation
 *     attr-lines (Form 2/3). Keys are lowercased verbatim from source.
 *   - flags: bare-name tokens (no `=`) — collected from both opener and
 *     continuation lines.
 *   - body: raw body lines (no leading indent stripped — directives that need
 *     them do their own stripping). Empty array for Form 1 / Form 2.
 *   - isSelfClosed: true when the opener line ended with ` /` (Form 1).
 *   - line: 1-based line number of the opener.
 *
 * `rawArgs` is the verbatim text after the directive name on the opener line,
 * stripped of the trailing self-close ` /`. Directives that need to parse
 * non-trivial positional/expression syntax (e.g. @if condition, @foreach
 * "x in source", @set "v = expr") read it directly instead of using the
 * pre-split positional/attrs.
 */
export interface DirectiveInput {
  positional: string
  attrs: Record<string, string>
  flags: string[]
  body: string[]
  isSelfClosed: boolean
  line: number
  rawArgs: string
}

export interface ParseModule {
  name: string
  parse(input: DirectiveInput, ctx: ParseContext): ASTNode
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
