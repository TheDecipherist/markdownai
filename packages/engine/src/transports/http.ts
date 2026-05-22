import * as nodeHttp from 'node:http'
import * as nodeHttps from 'node:https'
import type { EngineEvent } from '../context.js'

function extractHostname(rawUrl: string): string {
  try {
    return new URL(rawUrl).hostname
  } catch {
    throw new Error(`[event-http] invalid URL: ${rawUrl}`)
  }
}

export function fireHttp(
  event: EngineEvent,
  url: string,
  headers: Record<string, string>,
  allowedDomains: string[]
): void {
  const hostname = extractHostname(url)

  if (!allowedDomains.includes(hostname)) {
    throw new Error(`[event-http] domain not allowlisted: ${hostname}`)
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
