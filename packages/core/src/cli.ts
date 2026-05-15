#!/usr/bin/env node
import { program } from 'commander'
import { writeFileSync } from 'node:fs'
import { runRender } from './commands/render.js'
import { runValidate } from './commands/validate.js'
import { runParse } from './commands/parse.js'
import { runEval } from './commands/eval.js'
import { runStrip } from './commands/strip.js'
import { runBuild } from './commands/build.js'
import { runInit } from './commands/init.js'
import { runCacheShow, runCacheClear } from './commands/cache.js'
import { runListPhases } from './commands/list-phases.js'
import { runListMacros } from './commands/list-macros.js'
import { runListImports } from './commands/list-imports.js'
import {
  securityShow, securityInit, securityDisable,
  securityShellEnable, securityShellAdd, securityShellRemove, securityShellList,
  securityHttpEnable, securityHttpAddDomain, securityHttpRemoveDomain,
} from './commands/security.js'

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
).action((file: string, opts: Record<string, string | boolean | undefined>) => {
  const result = runRender(file, opts)
  for (const warn of result.warnings) {
    if (!opts['silent']) process.stderr.write(`WARN: ${warn}\n`)
  }
  for (const err of result.errors) {
    if (!opts['silent']) process.stderr.write(`ERROR: ${err}\n`)
  }
  if (result.exitCode !== 0) process.exit(1)
  if (opts['output']) {
    writeFileSync(String(opts['output']), result.output)
  } else {
    process.stdout.write(result.output + '\n')
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

program
  .command('eval <expression>')
  .description('evaluate a single expression against current environment')
  .option('--env <file>', 'load .env file for evaluation')
  .action((expression: string, opts: Record<string, string | undefined>) => {
    const evalOpts: import('./commands/eval.js').EvalOptions = {}
    if (opts['env']) evalOpts.env = opts['env']
    const result = runEval(expression, evalOpts)
    process.stdout.write(result.output + '\n')
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
    writeFileSync(String(opts['output']), result.output)
  } else {
    process.stdout.write(result.output + '\n')
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

program
  .command('serve')
  .description('start the MarkdownAI MCP server')
  .option('--cwd <path>', 'set working directory for document resolution')
  .option('--port <n>', 'port number (informational only — server uses stdio)')
  .action(async (opts: Record<string, string | undefined>) => {
    const { startServer } = await import('@markdownai/mcp')
    startServer({ cwd: opts['cwd'] })
  })

program
  .command('init')
  .description('install the MarkdownAI hook in your AI client config')
  .option('--client <type>', 'client type: claude-code, cursor (auto-detects if omitted)')
  .action((opts: Record<string, string | undefined>) => {
    const clientOpt = opts['client'] as import('./commands/init.js').ClientType | undefined
    const result = runInit({ client: clientOpt })
    if (result.alreadyInstalled) {
      process.stdout.write(`ℹ ${result.message}\n`)
    } else {
      process.stdout.write(`✓ ${result.message}\n`)
    }
  })

const cache = program.command('cache').description('manage the MarkdownAI cache')

cache
  .command('show [file]')
  .description('list cache entries')
  .option('--session', 'show session cache only')
  .option('--persist', 'show persist cache only')
  .option('--expired', 'show only expired entries')
  .action((_file: string | undefined, opts: Record<string, boolean | undefined>) => {
    const mode = opts['session'] ? 'session' : opts['persist'] ? 'persist' : undefined
    const result = runCacheShow({ mode, expired: opts['expired'] })
    if (result.entries.length === 0) {
      process.stdout.write('No cache entries\n')
    } else {
      for (const e of result.entries) {
        const expired = e.expired ? ' [EXPIRED]' : ''
        process.stdout.write(`${e.mode}  ${e.key.slice(0, 16)}...${expired}\n`)
      }
    }
  })

cache
  .command('clear [file]')
  .description('clear cache entries')
  .option('--session', 'clear session cache only')
  .option('--persist', 'clear persist cache only')
  .option('--directive <type>', 'clear only entries for this directive type')
  .action((_file: string | undefined, opts: Record<string, string | boolean | undefined>) => {
    const result = runCacheClear({
      session: Boolean(opts['session']),
      persist: Boolean(opts['persist']),
      directive: opts['directive'] ? String(opts['directive']) : undefined,
    })
    const parts = []
    if (result.cleared.session) parts.push('session')
    if (result.cleared.persist) parts.push('persist')
    process.stdout.write(`✓ Cleared cache: ${parts.join(', ')}\n`)
  })

const security = program.command('security').description('manage security configuration')

security.command('show').description('show current security config').action(() => {
  const result = securityShow()
  process.stdout.write(JSON.stringify(result.data, null, 2) + '\n')
})
security.command('init').description('create default security config').action(() => {
  const result = securityInit()
  process.stdout.write(`✓ ${result.message}\n`)
})
security.command('disable').description('disable all dynamic directives').action(() => {
  const result = securityDisable()
  process.stdout.write(`✓ ${result.message}\n`)
})

const shell = security.command('shell').description('manage shell execution security')
shell.command('enable').action(() => { process.stdout.write(`✓ ${securityShellEnable(true).message}\n`) })
shell.command('disable').action(() => { process.stdout.write(`✓ ${securityShellEnable(false).message}\n`) })
shell.command('add <pattern>').action((pattern: string) => { process.stdout.write(`✓ ${securityShellAdd(pattern).message}\n`) })
shell.command('remove <pattern>').action((pattern: string) => { process.stdout.write(`✓ ${securityShellRemove(pattern).message}\n`) })
shell.command('list').action(() => {
  const result = securityShellList()
  const patterns = result.data as string[]
  if (patterns.length === 0) process.stdout.write('No allow patterns\n')
  else patterns.forEach((p: string) => process.stdout.write(`  ${p}\n`))
})

const http = security.command('http').description('manage HTTP security')
http.command('enable').action(() => { process.stdout.write(`✓ ${securityHttpEnable(true).message}\n`) })
http.command('disable').action(() => { process.stdout.write(`✓ ${securityHttpEnable(false).message}\n`) })
http.command('add-domain <domain>').action((domain: string) => { process.stdout.write(`✓ ${securityHttpAddDomain(domain).message}\n`) })
http.command('remove-domain <domain>').action((domain: string) => { process.stdout.write(`✓ ${securityHttpRemoveDomain(domain).message}\n`) })

program
  .command('list-phases <file>')
  .description('list all phases and their transitions')
  .option('--cwd <path>', 'working directory')
  .action((file: string, opts: Record<string, string | undefined>) => {
    const result = runListPhases(file, { cwd: opts['cwd'] })
    for (const err of result.errors) process.stderr.write(`ERROR: ${err}\n`)
    if (result.exitCode !== 0) process.exit(1)
    if (result.phases.length === 0) process.stdout.write('No phases found\n')
    for (const p of result.phases) {
      process.stdout.write(`@phase ${p.name} (line ${p.line})\n`)
      for (const t of p.transitions) {
        process.stdout.write(`  @on ${t.event} -> @${t.type} ${t.target}\n`)
      }
    }
  })

program
  .command('list-macros <file>')
  .description('list all macros defined in the document')
  .option('--cwd <path>', 'working directory')
  .action((file: string, opts: Record<string, string | undefined>) => {
    const result = runListMacros(file, { cwd: opts['cwd'] })
    for (const err of result.errors) process.stderr.write(`ERROR: ${err}\n`)
    if (result.exitCode !== 0) process.exit(1)
    for (const m of result.macros) {
      const params = m.params.length > 0 ? `(${m.params.join(', ')})` : ''
      const local = m.local ? ' [local]' : ''
      process.stdout.write(`@define ${m.name}${params}${local} (line ${m.line})\n`)
    }
  })

program
  .command('list-imports <file>')
  .description('list all @include and @import dependencies')
  .option('--cwd <path>', 'working directory')
  .action((file: string, opts: Record<string, string | undefined>) => {
    const result = runListImports(file, { cwd: opts['cwd'] })
    for (const err of result.errors) process.stderr.write(`ERROR: ${err}\n`)
    for (const i of result.imports) {
      process.stdout.write(`@${i.type} ${i.path} (line ${i.line})\n`)
    }
    if (result.exitCode !== 0) process.exit(1)
  })

program.name('mai').version('0.0.1').parse()
