export interface GetEnvResult {
  value: string
  found: boolean
}

export function getEnv(key: string, fallback?: string): GetEnvResult {
  const value = process.env[key]
  if (value !== undefined) return { value, found: true }
  if (fallback !== undefined) return { value: fallback, found: false }
  return { value: '', found: false }
}
