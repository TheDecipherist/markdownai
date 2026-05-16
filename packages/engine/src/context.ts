import type { ASTNode } from '@markdownai/parser'
import type { FilesystemSecurityConfig, ShellSecurityConfig } from './security/config.js'

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
}

export interface MCPContext {
  sessionId: string
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
