import type { EventNode } from '@markdownai/parser'
import type { EngineContext, EngineEvent, EventMeta } from './context.js'
import { applyMasking } from './security/masking.js'
import { writeAuditEntry } from './security/audit.js'
import { fireMcp } from './transports/mcp.js'
import { dispatchExternal, resolveTransportType } from './transports/index.js'
import { evalExpr } from './engine-interpolate.js'

const EXTERNAL_AUDIT_TRANSPORTS = new Set(['http', 'db', 'websocket', 'file'])

export function executeEvent(node: EventNode, ctx: EngineContext, filePath: string): string {
  const eventCfg = ctx.security.eventConfig
  if (!eventCfg) return renderVisible(node, node.data)

  // Resolve interpolation only when explicitly opted in
  let rawData = node.data
  if (eventCfg.allow_env_interpolation) {
    rawData = resolveEventInterpolation(node.data, ctx)
  }

  // Masking is unconditional — runs regardless of interpolation setting
  const { masked, wasMasked } = applyMasking(rawData, ctx.security.filesystemConfig)
  if (wasMasked) {
    const alert = `SECURITY_ALERT: @event data masked — name=${node.name}`
    ctx.warnings.push(alert)
    process.stderr.write(`${alert} document=${filePath}\n`)
    writeAuditEntry({
      level: 'SECURITY_ALERT', directive: 'event', file: filePath,
      line: node.line, message: `event data masked: name=${node.name}`,
      action: 'MASKED',
    })
  }

  // Length cap — not configurable above 500
  const maxLen = Math.min(eventCfg.max_value_length ?? 500, 500)
  const data = masked.length > maxLen
    ? (ctx.warnings.push(`@event data truncated to ${maxLen} chars: name=${node.name}`), masked.slice(0, maxLen))
    : masked

  const timestamp = Date.now()
  const meta: EventMeta = {
    datetime: new Date(timestamp).toISOString(),
    line: node.line,
    runId: ctx.runId,
    sessionId: ctx.mcp?.sessionId ?? null,
    model: ctx.model,
    tokenUsage: ctx.tokenUsage,
    git: ctx.gitMeta,
    callstack: [...ctx.callstack],
  }

  for (const transport of node.transports) {
    // Allowlist check — synchronous, can throw for onError: 'fail'
    if (!eventCfg.allowed_transports.includes(transport)) {
      handleNotAllowlisted(transport, node.name, eventCfg.onError, ctx)
      continue
    }

    const event: EngineEvent = {
      name: node.name, data, transport,
      document: filePath, phase: ctx.phase, timestamp, meta,
    }

    const kind = resolveTransportType(transport, eventCfg)

    if (kind === 'mcp') {
      fireMcp(event, ctx.events)
      continue
    }

    // External and custom transports: write audit log then fire-and-forget via worker
    if (EXTERNAL_AUDIT_TRANSPORTS.has(transport)) {
      writeAuditEntry({
        level: 'INFO', directive: 'event', file: filePath,
        line: node.line, message: `event-dispatch transport=${transport} name=${node.name} data=${data}`,
        action: 'ALLOWED',
      })
    }

    dispatchExternal(event, eventCfg)
  }

  return renderVisible(node, data)
}

function handleNotAllowlisted(transport: string, name: string, onError: string, ctx: EngineContext): void {
  if (onError === 'fail') {
    throw new Error(`@event transport not in allowed_transports: "${transport}" (name=${name})`)
  }
  if (onError === 'warn') {
    ctx.warnings.push(`@event transport not allowlisted: "${transport}" (name=${name})`)
  }
}

function renderVisible(node: EventNode, data: string): string {
  if (!node.visible) return ''
  let parsed: unknown
  try { parsed = JSON.parse(data) } catch { parsed = null }
  if (parsed !== null && typeof parsed === 'object') {
    return `> **event** \`${node.name}\`\n> \`\`\`json\n> ${JSON.stringify(parsed, null, 2).replace(/\n/g, '\n> ')}\n> \`\`\``
  }
  return `> **event** \`${node.name}\` - ${data}`
}

function resolveEventInterpolation(data: string, ctx: EngineContext): string {
  return data.replace(/\{\{\s*([\s\S]+?)\s*\}\}/g, (_match, expr: string) => {
    try {
      return evalExpr(expr.trim(), ctx)
    } catch {
      return _match
    }
  })
}
