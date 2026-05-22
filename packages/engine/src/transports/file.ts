import { appendFileSync } from 'node:fs'
import { isAbsolute, dirname } from 'node:path'
import type { EngineEvent } from '../context.js'

export function fireFile(event: EngineEvent, filePath: string, docRoot: string): void {
  if (!isAbsolute(filePath)) {
    throw new Error(`[event-file] filePath must be absolute, got: ${filePath}`)
  }

  const resolvedDocRoot = docRoot.endsWith('/') ? docRoot : docRoot + '/'
  if (filePath.startsWith(resolvedDocRoot)) {
    throw new Error(
      `[event-file] filePath must not be inside document root. ` +
      `path=${filePath} docRoot=${docRoot}`
    )
  }

  appendFileSync(filePath, JSON.stringify(event) + '\n', 'utf8')
}

export function resolveDocRoot(event: EngineEvent): string {
  return dirname(event.document)
}
