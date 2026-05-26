// Execution directive executors:
//   @test             — run the project's test suite, surface a clean summary
//   @check            — run a typecheck/lint/build script (analogue of @test)
//   @render-template  — render a template doc with params and write to dest
//
// @test and @check share the same shell allowlist gating as @query and write
// their summary + exit code + raw output into ctx.envFiles when a label= is
// provided. @render-template uses the data-jail (source) and write-jail
// (destination).

import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, isAbsolute, resolve } from 'node:path'
import type { TestNode, CheckNode, RenderTemplateNode, ASTNode } from '@markdownai/parser'
import type { EngineContext } from './context.js'
import { checkDataPath, checkWritePath } from './security/filesystem.js'
import { checkShellCommand } from './security/shell.js'
import { expandPattern } from './security/path-expand.js'
import { interpolatePathSoft } from './engine-include.js'

function buildExpandContext(ctx: EngineContext) {
  const env: Record<string, string> = { ...ctx.env, ...ctx.envFiles }
  const expandCtx: import('./security/path-expand.js').PatternExpandContext = { env }
  const skillDir = ctx.skillContext?.skillDir
  const sessionId = ctx.skillContext?.sessionId
  if (skillDir) expandCtx.skillDir = skillDir
  if (sessionId) expandCtx.sessionId = sessionId
  return expandCtx
}

function resolveReadPath(rawPath: string, ctx: EngineContext, directive: string): string | null {
  const expanded = expandPattern(rawPath, buildExpandContext(ctx))
  const dataJail = ctx.security.dataJail ?? ctx.security.jailRoot ?? ctx.docDir ?? null
  if (!dataJail) {
    ctx.warnings.push(`${directive}: no data jail for path: ${rawPath}`)
    return null
  }
  const abs = isAbsolute(expanded) ? expanded : resolve(dataJail, expanded)
  const check = checkDataPath(abs, dataJail, ctx.security.allowedDataPaths, ctx.security.filesystemConfig)
  if (check.level === 'blocked') {
    ctx.warnings.push(`SECURITY_ALERT: ${directive} blocked — ${check.reason}: ${rawPath}`)
    return null
  }
  if (check.level === 'alert') {
    ctx.warnings.push(`SECURITY_ALERT: ${directive} sensitive path accessed — ${check.reason}: ${rawPath}`)
  }
  return abs
}

function resolveWritePath(rawPath: string, ctx: EngineContext, directive: string): string | null {
  const expanded = expandPattern(rawPath, buildExpandContext(ctx))
  const writeJail = ctx.security.writeJail
  if (!writeJail) {
    ctx.warnings.push(`${directive}: no write jail resolved — check security.json filesystem.write_root`)
    return null
  }
  const abs = isAbsolute(expanded) ? expanded : resolve(writeJail, expanded)
  const check = checkWritePath(abs, writeJail, ctx.security.allowedWritePaths, ctx.security.filesystemConfig)
  if (check.level === 'blocked') {
    ctx.warnings.push(`SECURITY_ALERT: ${directive} write blocked — ${check.reason}: ${rawPath}`)
    return null
  }
  if (check.level === 'alert') {
    ctx.warnings.push(`SECURITY_ALERT: ${directive} sensitive write — ${check.reason}: ${rawPath}`)
  }
  return abs
}

// --- @test / @check --------------------------------------------------------

interface RunSummary {
  output: string   // raw command output (stdout + stderr) - returned IN FULL, never truncated
  summary: string  // optional one-line summary when a runner format is recognized;
                   // surfaced as {{label}}_summary ONLY. Never replaces output.
  exit: number     // exit code
}

function detectCommand(ctx: EngineContext, keys: string[]): string | null {
  // Read package.json from the cwd. We deliberately do NOT go through the
  // data-jail check here: detection is local-only and the path is fixed.
  const pkgPath = resolve(ctx.cwd, 'package.json')
  if (!existsSync(pkgPath)) return null
  let pkg: { scripts?: Record<string, string> }
  try {
    pkg = JSON.parse(readFileSync(pkgPath, 'utf8'))
  } catch {
    return null
  }
  const scripts = pkg.scripts ?? {}
  for (const key of keys) {
    if (scripts[key]) {
      // Default to the user's preferred runner if scripts are written as `vitest`/`tsc`.
      // We invoke via `npm run <key>` so we don't have to guess.
      return `npm run ${key} --silent`
    }
  }
  return null
}

function summarizeOutput(output: string, exit: number, runner: 'test' | 'check'): string {
  const text = output ?? ''
  // vitest / jest pattern: "Test Files  5 passed (5)" + "Tests  17 passed (17)"
  const vitestMatch = text.match(/Test Files[ \t]+([\d \w()|passed|failed|skipped,]+)/i)
  const testsMatch = text.match(/Tests?[ \t]+([\d \w()|passed|failed|skipped,]+)/i)
  if (vitestMatch && testsMatch) {
    return `${runner === 'test' ? 'tests' : 'checks'}: ${testsMatch[1]?.trim()} (files ${vitestMatch[1]?.trim()}) — exit ${exit}`
  }
  // playwright: "5 passed (12s)"
  const pwMatch = text.match(/(\d+ passed[^\n]*)/i)
  if (pwMatch && runner === 'test') {
    return `${pwMatch[1]?.trim()} — exit ${exit}`
  }
  // tsc: line counts. "Found 0 errors" or "error TS1234:"
  const tscMatch = text.match(/Found (\d+) errors?/i)
  if (tscMatch) {
    return `typecheck: ${tscMatch[1]} errors — exit ${exit}`
  }
  // eslint: "✖ 3 problems (2 errors, 1 warning)"
  const eslintMatch = text.match(/✖\s+(\d+ problems?[^\n]*)/i)
  if (eslintMatch) {
    return `lint: ${eslintMatch[1]?.trim()} — exit ${exit}`
  }
  // node --test summary: "# pass 17 / # fail 0"
  const nodeTestMatch = text.match(/# pass (\d+).*\n#.*\n# fail (\d+)/s)
  if (nodeTestMatch) {
    return `tests: ${nodeTestMatch[1]} passed, ${nodeTestMatch[2]} failed — exit ${exit}`
  }
  // Fallback: just report exit status
  return exit === 0 ? `${runner} passed — exit 0` : `${runner} failed — exit ${exit}`
}

function runCommand(
  command: string,
  ctx: EngineContext,
  directive: string,
  runner: 'test' | 'check',
): RunSummary | null {
  if (!ctx.security.allowShell) {
    ctx.warnings.push(`${directive}: shell execution disabled — set security.shell.enabled=true`)
    return null
  }
  if (ctx.security.shellConfig) {
    const check = checkShellCommand(command, ctx.security.shellConfig)
    if (!check.allowed) {
      const prefix = check.tier === 'always_block' ? 'SECURITY_ALERT' : 'WARN'
      ctx.warnings.push(`${prefix}: ${directive} command blocked [${check.tier}] — ${check.reason}`)
      return null
    }
  }
  const result = spawnSync(command, {
    cwd: ctx.cwd,
    encoding: 'utf8',
    shell: true,
    timeout: 300_000,  // 5 minutes — test suites can be slow
  })
  const stdout = result.stdout ?? ''
  const stderr = result.stderr ?? ''
  const combined = stdout + (stderr ? '\n' + stderr : '')
  const exit = result.status ?? -1
  // Core invariant: engine runs the grunt, returns ALL output to the caller.
  // Never truncate. Never substitute a summary for the real thing. Especially
  // on failure - Claude needs the full runner output to diagnose. The summary
  // line is best-effort and ONLY surfaces as {{label}}_summary; the full
  // output is always in the directive's primary return value and {{label}}.
  const summary = summarizeOutput(combined, exit, runner)
  return { output: combined, summary, exit }
}

export function executeTest(node: TestNode, ctx: EngineContext): string {
  const rawCommand = node.command ?? detectCommand(ctx, ['test'])
  if (!rawCommand) {
    ctx.warnings.push('@test: no command= provided and no scripts.test in package.json')
    return ''
  }
  // Interpolate {{ }} in the command so e.g. `npx vitest run tests/unit/
  // {{ feature_slug }}.test.ts` resolves before the shell runs it. Without
  // this, vitest sees `{{` and `}}` as separate filter terms and matches
  // nothing.
  const command = interpolatePathSoft(rawCommand, ctx)
  const r = runCommand(command, ctx, '@test', 'test')
  if (!r) return ''
  const label = node.args['label']
  if (label) {
    // {{ label }} = full output (stdout + stderr, never truncated).
    // {{ label_exit }} = exit code as string.
    // {{ label_summary }} = best-effort one-line recognizer output, additive only.
    ctx.envFiles[label] = r.output
    ctx.envFiles[`${label}_exit`] = String(r.exit)
    ctx.envFiles[`${label}_summary`] = r.summary
  }
  // Inline substitution: emit the full combined output where the directive sat.
  // Claude reads exactly what the test runner produced.
  return r.output
}

export function executeCheck(node: CheckNode, ctx: EngineContext): string {
  const rawCommand = node.command ?? detectCommand(ctx, ['typecheck', 'check', 'lint', 'build'])
  if (!rawCommand) {
    ctx.warnings.push('@check: no command= provided and no scripts.typecheck/check/lint/build in package.json')
    return ''
  }
  const command = interpolatePathSoft(rawCommand, ctx)
  const r = runCommand(command, ctx, '@check', 'check')
  if (!r) return ''
  const label = node.args['label']
  if (label) {
    ctx.envFiles[label] = r.output
    ctx.envFiles[`${label}_exit`] = String(r.exit)
    ctx.envFiles[`${label}_summary`] = r.summary
  }
  return r.output
}

// --- @render-template ------------------------------------------------------

// Engine.execute() injects itself here at module load to avoid the circular
// import that would otherwise occur (exec-ops <-> engine).
export type EngineExecuteFn = (
  parsed: { isMarkdownAI: boolean; version: string | null; nodes: ASTNode[] },
  opts: { ctx?: Partial<EngineContext>; filePath?: string },
) => { output: string; warnings: string[]; errors: string[] }

export type EngineParseFn = (source: string, options?: { filePath?: string; inImport?: boolean }) => {
  isMarkdownAI: boolean
  version: string | null
  nodes: ASTNode[]
}

let _execute: EngineExecuteFn | null = null
let _parse: EngineParseFn | null = null
export function setEngineExecute(fn: EngineExecuteFn, parseFn: EngineParseFn): void {
  _execute = fn
  _parse = parseFn
}

export function executeRenderTemplate(node: RenderTemplateNode, ctx: EngineContext): string {
  if (!ctx.security.writeEnabled) {
    ctx.warnings.push('@render-template: filesystem write is disabled — enable with filesystem.write_enabled in security.json')
    return ''
  }
  if (!node.from || !node.to) {
    ctx.warnings.push('@render-template: both from= and to= are required')
    return ''
  }
  // Interpolate {{ }} in from= and to= so dynamic state set by upstream
  // phases (next_id, feature_slug, CWD) substitutes before the path checks
  // hit existsSync / write jail. Without this, `{{ next_id }}` reaches
  // existsSync as a literal segment, the write either fails the path check
  // or creates a file literally named "{{ next_id }}-…".
  const interpolatedFrom = interpolatePathSoft(node.from, ctx)
  const interpolatedTo = interpolatePathSoft(node.to, ctx)
  const dst = resolveWritePath(interpolatedTo, ctx, '@render-template')
  if (!dst) return ''
  const force = node.args['force'] === 'true'
  if (existsSync(dst) && !force) {
    return ''
  }
  const src = resolveReadPath(interpolatedFrom, ctx, '@render-template')
  if (!src) return ''
  if (!existsSync(src)) {
    ctx.warnings.push(`@render-template: source does not exist: ${interpolatedFrom}`)
    return ''
  }
  let templateContent: string
  try { templateContent = readFileSync(src, 'utf8') } catch (err) {
    ctx.warnings.push(`@render-template: cannot read template ${interpolatedFrom}: ${String(err)}`)
    return ''
  }

  if (!_execute || !_parse) {
    ctx.warnings.push('@render-template: engine not initialized for sub-render')
    return ''
  }

  // Param values may contain {{ }} interpolations referencing the parent
  // ctx's bindings (e.g. `id = {{ next_id }}-{{ feature_slug }}`). Resolve
  // those against the PARENT ctx before passing to the child, otherwise
  // the template sees literal `{{ next_id }}` for the value of `id`.
  const resolvedParams: Record<string, string> = {}
  for (const [k, raw] of Object.entries(node.params)) {
    resolvedParams[k] = interpolatePathSoft(raw, ctx)
  }

  const ast = _parse(templateContent, { filePath: src })
  if (!ast.isMarkdownAI) {
    // Plain-text template — just substitute `{{ key }}` placeholders.
    let out = templateContent
    for (const [k, v] of Object.entries(resolvedParams)) {
      out = out.replace(new RegExp(`{{\\s*${k.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')}\\s*}}`, 'g'), v)
    }
    return writeTemplateOutput(dst, out, ctx, node.to)
  }

  // Inject params as envFiles so `{{ key }}` interpolations and
  // `@if {{ key }} == "..."` work without macro wrappers.
  const childEnvFiles: Record<string, string> = { ...ctx.envFiles, ...resolvedParams }
  const childCtx: Partial<EngineContext> = {
    cwd: ctx.cwd,
    docDir: ctx.docDir,
    envFiles: childEnvFiles,
    env: ctx.env,
    security: ctx.security,
    skillContext: ctx.skillContext,
    consumer: ctx.consumer,
  }
  const result = _execute(ast, { filePath: src, ctx: childCtx })
  for (const w of result.warnings) ctx.warnings.push(`@render-template[${node.from}]: ${w}`)
  return writeTemplateOutput(dst, result.output, ctx, node.to)
}

function writeTemplateOutput(dst: string, content: string, ctx: EngineContext, originalPath: string): string {
  try {
    const parent = dirname(dst)
    if (!existsSync(parent)) mkdirSync(parent, { recursive: true })
    writeFileSync(dst, content, 'utf8')
  } catch (err) {
    ctx.warnings.push(`@render-template: cannot write ${originalPath}: ${String(err)}`)
  }
  return ''
}
