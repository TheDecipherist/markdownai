import { readFileSync } from 'node:fs'

export function loadEnvFile(filePath: string): Record<string, string> {
  const result: Record<string, string> = {}
  let content: string
  try { content = readFileSync(filePath, 'utf8') } catch { return result }
  for (const line of content.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq < 0) continue
    const key = trimmed.slice(0, eq).trim()
    const raw = trimmed.slice(eq + 1).trim()
    result[key] = raw.replace(/^["']|["']$/g, '')
  }
  return result
}
