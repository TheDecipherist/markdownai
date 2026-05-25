import type { ASTNode } from '@markdownai/parser'
import type { FilesystemSecurityConfig, ShellSecurityConfig, HttpSecurityConfig, DbSecurityConfig, EventSecurityConfig } from './security/config.js'
import type { TraceConfig } from './trace/config.js'

export interface EventMeta {
  datetime: string
  line: number
  runId: string
  sessionId: string | null
  model: string | null
  tokenUsage: number | null
  git: { hash: string; short: string } | null
  callstack: string[]
}

export interface EngineEvent {
  name: string
  data: string
  transport: string
  document: string
  phase: string | null
  timestamp: number
  meta: EventMeta
}

export interface Connection {
  type: string
  args: Record<string, string>
}

export interface SecurityConfig {
  allowShell: boolean
  allowHttp: boolean
  allowDb: boolean
  // Legacy single jail (still consulted as fallback when sourceJail/dataJail unset).
  jailRoot: string | null
  // v2.0 split: source ops (@import/@include) and data ops (@list/@read/file.*)
  // jail to different roots. Engine.execute() resolves these from filesystem
  // config at start of render and stores absolute paths here.
  // Optional for back-compat — when unset, code falls back to jailRoot.
  sourceJail?: string | null           // dirname of entry document (default)
  dataJail?: string | null             // process cwd (default in v2.0)
  // Expanded allow-lists (post-${VAR} substitution). Optional for back-compat.
  allowedSourcePaths?: string[]
  allowedDataPaths?: string[]
  // Write directives (v2.0+): jail and allow-list resolved at execute() time.
  // writeJail set to the configured write_root (default: cwd) when write_enabled.
  // When undefined, write directives are blocked entirely.
  writeJail?: string | null
  allowedWritePaths?: string[]
  writeEnabled?: boolean
  filesystemConfig?: FilesystemSecurityConfig
  shellConfig?: ShellSecurityConfig
  httpConfig?: HttpSecurityConfig
  dbConfig?: DbSecurityConfig
  eventConfig?: EventSecurityConfig
}

export interface MCPContext {
  sessionId: string
}

export interface SkillContext {
  args: string                        // $ARGUMENTS — full raw argument string
  argsList: string[]                  // $ARGUMENTS[N] / $N — parsed positional args
  namedArgs: Record<string, string>   // named args declared in skill frontmatter arguments:
  sessionId: string                   // ${CLAUDE_SESSION_ID}
  effort: string                      // ${CLAUDE_EFFORT}
  skillDir: string                    // ${CLAUDE_SKILL_DIR}
}

export interface MacroDefinition {
  body: ASTNode[]
  params: string[]
}

export interface ConstraintEntry {
  id: string
  severity: string
  body: string
}

export interface EngineContext {
  env: Record<string, string>
  envFiles: Record<string, string>
  envFallbacks: Record<string, string>
  connections: Record<string, Connection>
  localConnectionNames: Set<string>
  macros: Record<string, MacroDefinition>
  phase: string | null
  cwd: string
  docDir: string
  security: SecurityConfig
  mcp: MCPContext | null
  warnings: string[]
  resolutionStack: Set<string>
  completedSet: Set<string>
  consumer: string | undefined
  glossary: Map<string, string>
  constraints: ConstraintEntry[]
  skillContext: SkillContext | null
  events: EngineEvent[]
  runId: string
  gitMeta: { hash: string; short: string } | null
  model: string | null
  tokenUsage: number | null
  callstack: string[]
  traceConfig: TraceConfig | null
}

export function makeContext(overrides?: Partial<EngineContext>): EngineContext {
  const env: Record<string, string> = {}
  for (const [k, v] of Object.entries(process.env)) {
    if (v !== undefined) env[k] = v
  }
  const cwd = process.cwd()
  const base: EngineContext = {
    env,
    envFiles: {},
    envFallbacks: {},
    connections: {},
    localConnectionNames: new Set<string>(),
    macros: {},
    phase: null,
    cwd,
    docDir: cwd,
    security: { allowShell: false, allowHttp: false, allowDb: false, jailRoot: cwd },
    mcp: null,
    warnings: [],
    resolutionStack: new Set<string>(),
    completedSet: new Set<string>(),
    consumer: undefined,
    glossary: new Map<string, string>(),
    constraints: [],
    skillContext: null,
    events: [],
    runId: '',
    gitMeta: null,
    model: null,
    tokenUsage: null,
    callstack: [],
    traceConfig: null,
  }
  if (!overrides) return base
  const { warnings, resolutionStack, completedSet, localConnectionNames, glossary, constraints, events, callstack, ...rest } = overrides
  return {
    ...base,
    ...rest,
    warnings: warnings ?? base.warnings,
    resolutionStack: resolutionStack ?? base.resolutionStack,
    completedSet: completedSet ?? base.completedSet,
    localConnectionNames: localConnectionNames ?? base.localConnectionNames,
    glossary: glossary ?? base.glossary,
    constraints: constraints ?? base.constraints,
    events: events ?? base.events,
    callstack: callstack ?? base.callstack,
  }
}

export function resolveEnv(key: string, directiveFallback: string | null, ctx: EngineContext): string {
  return ctx.env[key]
    ?? ctx.envFiles[key]
    ?? ctx.envFallbacks[key]
    ?? directiveFallback
    ?? ''
}
