import { watch, writeFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { runRender } from './render.js'

export interface WatchOptions {
  env?: string
  cwd?: string
  verbose?: boolean
  strict?: boolean
  output?: string
}

export interface WatchHandle {
  stop(): void
}

export function runWatch(filePath: string, options: WatchOptions = {}): WatchHandle {
  const cwd = options.cwd ?? process.cwd()
  const resolved = resolve(cwd, filePath)
  const dir = dirname(resolved)
  let debounceTimer: ReturnType<typeof setTimeout> | null = null

  function render() {
    const result = runRender(filePath, options)
    for (const warn of result.warnings) {
      if (options.verbose) process.stderr.write(`WARN: ${warn}\n`)
    }
    for (const err of result.errors) {
      process.stderr.write(`ERROR: ${err}\n`)
    }
    if (result.exitCode === 0) {
      if (options.output) {
        writeFileSync(resolve(cwd, options.output), result.output)
        process.stderr.write(`[watch] rebuilt → ${options.output}\n`)
      } else {
        process.stdout.write(result.output + '\n')
      }
    }
  }

  render()

  const watcher = watch(dir, (_event, _filename) => {
    if (debounceTimer) clearTimeout(debounceTimer)
    debounceTimer = setTimeout(() => {
      debounceTimer = null
      render()
    }, 300)
  })

  return { stop: () => watcher.close() }
}
