import type { ASTNode } from '@markdownai/parser'
import type { FilesystemSecurityConfig, ShellSecurityConfig, HttpSecurityConfig, DbSecurityConfig } from './security/config.js'

export interface Connection {
  type: string
  args: Record<string, string>
}

export interface SecurityConfig {
  allowShell: boolean
  allowHttp: boolean
  allowDb: boolean
  jailRoot: string | null
  filesystemConfig?: FilesystemSecurityConfig
  shellConfig?: ShellSecurityConfig
  httpConfig?: HttpSecurityConfig
  dbConfig?: DbSecurityConfig
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
  severity: 'critical' | 'high' | 'medium' | 'low'
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
    security: { allowShell: false, allowHttp: false, allowDb: false, jailRoot: null },
    mcp: null,
    warnings: [],
    resolutionStack: new Set<string>(),
    completedSet: new Set<string>(),
    consumer: undefined,
    glossary: new Map<string, string>(),
    constraints: [],
    skillContext: null,
  }
  if (!overrides) return base
  const { warnings, resolutionStack, completedSet, localConnectionNames, glossary, constraints, ...rest } = overrides
  return {
    ...base,
    ...rest,
    warnings: warnings ?? base.warnings,
    resolutionStack: resolutionStack ?? base.resolutionStack,
    completedSet: completedSet ?? base.completedSet,
    localConnectionNames: localConnectionNames ?? base.localConnectionNames,
    glossary: glossary ?? base.glossary,
    constraints: constraints ?? base.constraints,
  }
}

export function resolveEnv(key: string, directiveFallback: string | null, ctx: EngineContext): string {
  return ctx.env[key]
    ?? ctx.envFiles[key]
    ?? ctx.envFallbacks[key]
    ?? directiveFallback
    ?? ''
}
