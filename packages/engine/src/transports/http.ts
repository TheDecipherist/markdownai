import * as nodeHttp from 'node:http'
import * as nodeHttps from 'node:https'
import type { EngineEvent } from '../context.js'
import { checkHttpUrl } from '../security/http.js'
import type { HttpSecurityConfig } from '../security/config.js'

export function fireHttp(
  event: EngineEvent,
  url: string,
  headers: Record<string, string>,
  allowedDomains: string[]
): void {
  const httpConfig: HttpSecurityConfig = {
    enabled: true,
    allowed_domains: allowedDomains ?? [],
    denied_domains: [],
    allowed_methods: ['POST'],
    max_response_size: 0,
    timeout: 0,
  }
  const check = checkHttpUrl(url, httpConfig, 'POST')
  if (!check.allowed) {
    throw new Error(`[event-http] ${check.reason}`)
  }

  const body = JSON.stringify(event)
  const parsed = new URL(url)
  const isHttps = parsed.protocol === 'https:'
  const transport = isHttps ? nodeHttps : nodeHttp

  const options: nodeHttp.RequestOptions = {
    method: 'POST',
    hostname: parsed.hostname,
    port: parsed.port || (isHttps ? 443 : 80),
    path: parsed.pathname + parsed.search,
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(body),
      ...headers,
    },
  }

  const req = transport.request(options, (res) => {
    res.resume()
  })

  req.on('error', (err) => {
    process.stderr.write(`[event-http] request error url=${url} err=${err.message}\n`)
  })

  req.write(body)
  req.end()
}
