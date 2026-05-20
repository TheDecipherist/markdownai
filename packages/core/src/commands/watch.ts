import { watch, writeFileSync } from 'node:fs'
import { resolve, dirname, isAbsolute } from 'node:path'
import { checkFilePath, checkAbsolutePath } from '@markdownai/engine'
import { runRender } from './render.js'

export interface WatchOptions {
  env?: string
  cwd?: string
  verbose?: boolean
  strict?: boolean
  silent?: boolean
  output?: string
}

export interface WatchHandle {
  stop(): void
}

export function runWatch(filePath: string, options: WatchOptions = {}): WatchHandle {
  const cwd = options.cwd ?? process.cwd()
  const resolved = resolve(cwd, filePath)

  if (options.output) {
    const outCheck = isAbsolute(options.output) ? checkAbsolutePath(options.output) : checkFilePath(options.output, cwd)
    if (outCheck.level === 'blocked') {
      process.stderr.write(`ERROR: watch --output path blocked — ${outCheck.reason}: ${options.output}\n`)
      return { stop: () => {} }
    }
  }

  let debounceTimer: ReturnType<typeof setTimeout> | null = null

  function render() {
    const result = runRender(filePath, options)
    for (const warn of result.warnings) {
      if (!options.silent && options.verbose) process.stderr.write(`WARN: ${warn}\n`)
    }
    for (const err of result.errors) {
      if (!options.silent) process.stderr.write(`ERROR: ${err}\n`)
    }
    if (result.exitCode === 0) {
      if (options.output) {
        writeFileSync(resolve(cwd, options.output!), result.output)
        if (!options.silent) process.stderr.write(`[watch] rebuilt → ${options.output}\n`)
      } else if (!options.silent) {
        process.stdout.write(result.output + '\n')
      }
    }
  }

  render()

  // Watch the specific file, not the whole directory
  const watcher = watch(resolved, (_event) => {
    if (debounceTimer) clearTimeout(debounceTimer)
    debounceTimer = setTimeout(() => {
      debounceTimer = null
      render()
    }, 300)
  })

  // Fall back to directory watch if file watching fails (some filesystems)
  watcher.on('error', () => {
    watcher.close()
    const dir = dirname(resolved)
    const fallback = watch(dir, (_event, filename) => {
      if (filename && resolve(dir, filename) !== resolved) return
      if (debounceTimer) clearTimeout(debounceTimer)
      debounceTimer = setTimeout(() => { debounceTimer = null; render() }, 300)
    })
    Object.assign(watcher, { close: () => fallback.close() })
  })

  return { stop: () => watcher.close() }
}
