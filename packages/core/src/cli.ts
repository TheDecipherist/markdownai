#!/usr/bin/env node
import { program } from 'commander'
import { writeFileSync } from 'node:fs'
import { runRender } from './commands/render.js'
import { runValidate } from './commands/validate.js'
import { runParse } from './commands/parse.js'
import { runEval } from './commands/eval.js'

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
  for (const err of result.errors) {
    if (!opts['silent']) process.stderr.write(`WARN: ${err}\n`)
  }
  if (result.exitCode !== 0 && result.errors.length > 0) process.exit(1)
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

program.name('mai').version('0.0.1').parse()
