#!/usr/bin/env node
import { program } from 'commander'
import { writeFileSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { runRender } from './commands/render.js'
import { runValidate } from './commands/validate.js'
import { runParse } from './commands/parse.js'
import { runEval } from './commands/eval.js'
import { runStrip } from './commands/strip.js'
import { runBuild } from './commands/build.js'
import { runInit, runInitClaudeMd } from './commands/init.js'
import { runCacheShow, runCacheClear } from './commands/cache.js'
import { runListPhases } from './commands/list-phases.js'
import { runListMacros } from './commands/list-macros.js'
import { runListImports } from './commands/list-imports.js'
import { runWatch } from './commands/watch.js'
import { registerSecurity } from './cli-register-security.js'

const universalOptions = (cmd: ReturnType<typeof program.command>) =>
  cmd
    .option('--env <file>', 'load .env file into environment')
    .option('--cwd <path>', 'override working directory')
    .option('--verbose', 'print warnings to stderr')
    .option('--strict', 'treat warnings as errors')
    .option('--silent', 'suppress all output except FATAL')

universalOptions(
  program
    .command('render <file>')
    .description('render a MarkdownAI document to markdown')
    .option('-o, --output <path>', 'write output to file instead of stdout')
    .option('--consumer <type>', 'target consumer: ai, human, or any custom value')
    .option('--format <mode>', 'output format: standard (default) or ai (token-efficient)')
    .option('--budget <n>', 'token budget — drop low-priority @section blocks to fit', parseInt)
    .option('--passthrough', 'pass plain markdown files through unchanged instead of erroring')
    .option('--skill-args <args>', 'skill ARGUMENTS string (for testing Claude Code skill files locally)')
    .option('--skill-dir <path>', 'skill directory ($CLAUDE_SKILL_DIR)')
    .option('--skill-session-id <id>', 'Claude Code session id ($CLAUDE_SESSION_ID)')
    .option('--skill-effort <level>', 'Claude effort level ($CLAUDE_EFFORT): low|medium|high|xhigh|max')
).action((file: string, opts: Record<string, string | boolean | undefined>) => {
  const renderOpts: Parameters<typeof runRender>[1] = {
    ...opts,
    passthrough: Boolean(opts['passthrough']),
  }
  // Commander stores flags with kebab-case names as camelCase, but our options
  // come through as a string-keyed record. Map them explicitly.
  if (typeof opts['skillArgs'] === 'string') renderOpts.skillArgs = opts['skillArgs']
  if (typeof opts['skillDir'] === 'string') renderOpts.skillDir = opts['skillDir']
  if (typeof opts['skillSessionId'] === 'string') renderOpts.skillSessionId = opts['skillSessionId']
  if (typeof opts['skillEffort'] === 'string') renderOpts.skillEffort = opts['skillEffort']
  const result = runRender(file, renderOpts)
  for (const warn of result.warnings) {
    if (!opts['silent']) process.stderr.write(`WARN: ${warn}\n`)
  }
  for (const err of result.errors) {
    if (!opts['silent']) process.stderr.write(`ERROR: ${err}\n`)
  }
  if (result.exitCode !== 0) process.exit(1)
  if (opts['output']) {
    const content = result.output.endsWith('\n') ? result.output : result.output + '\n'
    writeFileSync(String(opts['output']), content)
  } else {
    process.stdout.write(result.output.endsWith('\n') ? result.output : result.output + '\n')
  }
})

universalOptions(
  program
    .command('validate <file>')
    .description('parse and validate a MarkdownAI document')
).action((file: string, opts: Record<string, string | boolean | undefined>) => {
  const result = runValidate(file, opts)
  for (const err of result.errors) process.stderr.write(`ERROR: ${err}\n`)
  for (const warn of result.warnings) {
    if (!opts['silent']) process.stderr.write(`WARN: ${warn}\n`)
  }
  if (result.exitCode === 0) {
    if (!opts['silent']) process.stdout.write(`✓ ${file}: no errors\n`)
  }
  process.exit(result.exitCode)
})

universalOptions(
  program
    .command('parse <file>')
    .description('output the raw AST as JSON')
    .option('--node <type>', 'filter to specific node type')
    .option('--pretty', 'pretty-print JSON output')
).action((file: string, opts: Record<string, string | boolean | undefined>) => {
  const parseOpts: import('./commands/parse.js').ParseCmdOptions = { pretty: Boolean(opts['pretty']) }
  if (opts['cwd']) parseOpts.cwd = String(opts['cwd'])
  if (opts['node']) parseOpts.node = String(opts['node'])
  const result = runParse(file, parseOpts)
  for (const err of result.errors) process.stderr.write(`ERROR: ${err}\n`)
  if (result.exitCode !== 0) process.exit(1)
  process.stdout.write(result.output + '\n')
})

universalOptions(
  program
    .command('eval <expression>')
    .description('evaluate a single expression against current environment')
).action((expression: string, opts: Record<string, string | undefined>) => {
    const evalOpts: import('./commands/eval.js').EvalOptions = {}
    if (opts['env']) evalOpts.env = opts['env']
    const result = runEval(expression, evalOpts)
    if (!opts['silent']) process.stdout.write(result.output + '\n')
  })

universalOptions(
  program
    .command('strip <file>')
    .description('strip MarkdownAI syntax, output clean markdown')
    .option('-o, --output <path>', 'write output to file')
).action((file: string, opts: Record<string, string | boolean | undefined>) => {
  const result = runStrip(file, opts)
  for (const warn of result.warnings) {
    if (!opts['silent']) process.stderr.write(`WARN: ${warn}\n`)
  }
  for (const err of result.errors) process.stderr.write(`ERROR: ${err}\n`)
  if (result.exitCode !== 0) process.exit(1)
  if (opts['output']) {
    const content = result.output.endsWith('\n') ? result.output : result.output + '\n'
    writeFileSync(String(opts['output']), content)
  } else {
    process.stdout.write(result.output.endsWith('\n') ? result.output : result.output + '\n')
  }
})

universalOptions(
  program
    .command('build <file>')
    .description('render and write output to file')
    .option('-o, --output <path>', 'output file path (required)')
).action((file: string, opts: Record<string, string | boolean | undefined>) => {
  const result = runBuild(file, opts)
  for (const warn of result.warnings) {
    if (!opts['silent']) process.stderr.write(`WARN: ${warn}\n`)
  }
  for (const err of result.errors) process.stderr.write(`ERROR: ${err}\n`)
  if (result.exitCode !== 0) process.exit(1)
  if (!opts['output'] && !opts['silent']) {
    process.stdout.write(result.output + '\n')
  }
})

universalOptions(
  program
    .command('watch <file>')
    .description('watch a file and re-render on change')
    .option('-o, --output <path>', 'write output to file on each change')
).action((file: string, opts: Record<string, string | boolean | undefined>) => {
  const watchOpts: import('./commands/watch.js').WatchOptions = {}
  if (opts['env']) watchOpts.env = String(opts['env'])
  if (opts['cwd']) watchOpts.cwd = String(opts['cwd'])
  if (opts['verbose']) watchOpts.verbose = true
  if (opts['strict']) watchOpts.strict = true
  if (opts['silent']) watchOpts.silent = true
  if (opts['output']) watchOpts.output = String(opts['output'])
  runWatch(file, watchOpts)
})

universalOptions(
  program
    .command('serve')
    .description('start the MarkdownAI MCP server')
    .option('--port <n>', 'port number (informational only — server uses stdio)')
    .option('--passthrough', 'pass plain markdown files through the engine unchanged instead of erroring')
).action(async (opts: Record<string, string | boolean | undefined>) => {
    const { startServer } = await import('@markdownai/mcp')
    const serverOpts: Record<string, unknown> = {}
    if (opts['cwd']) serverOpts['cwd'] = String(opts['cwd'])
    if (opts['passthrough']) serverOpts['passthrough'] = true
    startServer(serverOpts)
  })

universalOptions(
  program
    .command('init')
    .description('install the MarkdownAI hook in your AI client config')
    .option('--client <type>', 'client type: claude-code, cursor (auto-detects if omitted)')
    .option('--global-claude-md', 'add MarkdownAI instructions to ~/.claude/CLAUDE.md')
    .option('--update', 'replace an existing MarkdownAI section with the current version')
).action((opts: Record<string, string | undefined>) => {
    const clientOpt = opts['client'] as import('./commands/init.js').ClientType | undefined
    const result = runInit(clientOpt ? { client: clientOpt } : {})
    if (result.alreadyInstalled) {
      process.stdout.write(`ℹ ${result.message}\n`)
    } else {
      process.stdout.write(`✓ ${result.message}\n`)
    }
    if (opts['globalClaudeMd'] || opts['update']) {
      const claudeMdResult = runInitClaudeMd({ update: !!opts['update'] })
      if (claudeMdResult.updated && claudeMdResult.alreadyPresent) {
        process.stdout.write('✓ MarkdownAI instructions updated in ' + claudeMdResult.claudeMdPath + '\n')
      } else if (claudeMdResult.alreadyPresent) {
        process.stdout.write('ℹ MarkdownAI instructions already in ' + claudeMdResult.claudeMdPath + ' (use --update to refresh)\n')
      } else if (claudeMdResult.updated) {
        process.stdout.write('✓ MarkdownAI instructions added to ' + claudeMdResult.claudeMdPath + '\n')
      }
    }
  })

const cache = program.command('cache').description('manage the MarkdownAI cache')

universalOptions(cache
  .command('show [file]')
  .description('list cache entries')
  .option('--session', 'show session cache only')
  .option('--persist', 'show persist cache only')
  .option('--expired', 'show only expired entries'))
  .action((_file: string | undefined, opts: Record<string, boolean | undefined>) => {
    const mode = opts['session'] ? 'session' as const : opts['persist'] ? 'persist' as const : undefined
    const showOpts: Parameters<typeof runCacheShow>[0] = {}
    if (mode !== undefined) showOpts.mode = mode
    if (opts['expired']) showOpts.expired = true
    const result = runCacheShow(showOpts)
    if (result.entries.length === 0) {
      process.stdout.write('No cache entries\n')
    } else {
      for (const e of result.entries) {
        const expired = e.expired ? ' [EXPIRED]' : ''
        process.stdout.write(`${e.mode}  ${e.key.slice(0, 16)}...${expired}\n`)
      }
    }
  })

universalOptions(cache
  .command('clear [file]')
  .description('clear cache entries')
  .option('--session', 'clear session cache only')
  .option('--persist', 'clear persist cache only')
  .option('--directive <type>', 'clear only entries for this directive type'))
  .action((_file: string | undefined, opts: Record<string, string | boolean | undefined>) => {
    const clearOpts: Parameters<typeof runCacheClear>[0] = {
      session: Boolean(opts['session']),
      persist: Boolean(opts['persist']),
    }
    if (opts['directive']) clearOpts.directive = String(opts['directive'])
    const result = runCacheClear(clearOpts)
    const parts = []
    if (result.cleared.session) parts.push('session')
    if (result.cleared.persist) parts.push('persist')
    process.stdout.write(`✓ Cleared cache: ${parts.join(', ')}\n`)
  })

registerSecurity(program)

universalOptions(
  program
    .command('list-phases <file>')
    .description('list all phases and their transitions')
).action((file: string, opts: Record<string, string | undefined>) => {
    const result = runListPhases(file, opts['cwd'] ? { cwd: opts['cwd'] } : {})
    for (const err of result.errors) process.stderr.write(`ERROR: ${err}\n`)
    if (result.exitCode !== 0) process.exit(1)
    if (result.phases.length === 0 && !opts['silent']) process.stdout.write('No phases found\n')
    if (!opts['silent']) {
      for (const p of result.phases) {
        process.stdout.write(`@phase ${p.name} (line ${p.line})\n`)
        for (const t of p.transitions) {
          process.stdout.write(`  @on ${t.event} -> @${t.type} ${t.target}\n`)
        }
      }
    }
  })

universalOptions(
  program
    .command('list-macros <file>')
    .description('list all macros defined in the document')
).action((file: string, opts: Record<string, string | undefined>) => {
    const result = runListMacros(file, opts['cwd'] ? { cwd: opts['cwd'] } : {})
    for (const err of result.errors) process.stderr.write(`ERROR: ${err}\n`)
    if (result.exitCode !== 0) process.exit(1)
    if (!opts['silent']) {
      for (const m of result.macros) {
        const params = m.params.length > 0 ? `(${m.params.join(', ')})` : ''
        const local = m.local ? ' [local]' : ''
        process.stdout.write(`@define ${m.name}${params}${local} (line ${m.line})\n`)
      }
    }
  })

universalOptions(
  program
    .command('list-imports <file>')
    .description('list all @include and @import dependencies')
).action((file: string, opts: Record<string, string | undefined>) => {
    const result = runListImports(file, opts['cwd'] ? { cwd: opts['cwd'] } : {})
    for (const err of result.errors) process.stderr.write(`ERROR: ${err}\n`)
    if (!opts['silent']) {
      for (const i of result.imports) {
        process.stdout.write(`@${i.type} ${i.path} (line ${i.line})\n`)
      }
    }
    if (result.exitCode !== 0) process.exit(1)
  })

const __dirname = dirname(fileURLToPath(import.meta.url))
const { version } = JSON.parse(readFileSync(join(__dirname, '../package.json'), 'utf-8')) as { version: string }
program.name('mai').version(version).parse()
