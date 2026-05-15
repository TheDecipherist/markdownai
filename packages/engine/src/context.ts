import type { ASTNode } from '@markdownai/parser'

export interface Connection {
  type: string
  args: Record<string, string>
}

export interface SecurityConfig {
  allowShell: boolean
  allowHttp: boolean
  allowDb: boolean
  jailRoot: string | null
}

export interface MCPContext {
  sessionId: string
}

export interface MacroDefinition {
  body: ASTNode[]
}

export interface EngineContext {
  env: Record<string, string>
  envFiles: Record<string, string>
  envFallbacks: Record<string, string>
  connections: Record<string, Connection>
  macros: Record<string, MacroDefinition>
  phase: string | null
  cwd: string
  docDir: string
  security: SecurityConfig
  mcp: MCPContext | null
}

export function makeContext(overrides?: Partial<EngineContext>): EngineContext {
  const env: Record<string, string> = {}
  for (const [k, v] of Object.entries(process.env)) {
    if (v !== undefined) env[k] = v
  }
  const cwd = process.cwd()
  return {
    env,
    envFiles: {},
    envFallbacks: {},
    connections: {},
    macros: {},
    phase: null,
    cwd,
    docDir: cwd,
    security: { allowShell: false, allowHttp: false, allowDb: false, jailRoot: null },
    mcp: null,
    ...overrides,
  }
}

export function resolveEnv(key: string, directiveFallback: string | null, ctx: EngineContext): string {
  return ctx.env[key]
    ?? ctx.envFiles[key]
    ?? ctx.envFallbacks[key]
    ?? directiveFallback
    ?? ''
}
