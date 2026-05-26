#!/usr/bin/env node
// Rewrites MarkdownAI v1 directive syntax to v2 syntax.
// Usage: node migrate-v1-to-v2.mjs <file>... [--dry-run] [--in-place]
//
// Idempotent — re-running on v2 content is a no-op.

import { readFileSync, writeFileSync } from 'node:fs'

// Block-body directives (open with @<name>, close with bare @end / alias).
const BLOCK_OPENERS = new Set([
  'phase',
  'if',
  'foreach',
  'define',
  'prompt',
  'note',
  'section',
  'render-template',
  'constraint',
  'switch',
  'chunk-boundary',
])

// Directives that were inline (block: false) in v1.
const INLINE_DIRECTIVES = new Set([
  'db',
  'event',
  'update-frontmatter',
  'call',
  'check',
  'http',
  'query',
  'list',
  'read',
  'tree',
  'count',
  'touch',
  'mkdir',
  'copy',
  'append-if-missing',
  'connect',
  'import',
  'include',
  'set',
  'markdownai-detect',
  'plugin-data',
  'hash',
  'test',
  'date',
  'read-frontmatter',
])

// Mid-block directives — do NOT push or pop the block stack.
const MID_BLOCK = new Set(['elseif', 'else', 'case', 'default'])

// Match a v1 directive opener: @<name> optionally followed by args.
// Captures: leading-indent, name, rest-of-line (after the name).
const DIRECTIVE_LINE_RE = /^(\s*)@([a-zA-Z][a-zA-Z0-9_-]*)(.*)$/

// Detect a code fence opener/closer.
const FENCE_RE = /^(\s*)(```|~~~)/

function isV2SelfClose(line) {
  // Trailing ` /` (whitespace then slash then EOL).
  return / \/\s*$/.test(line)
}

function isV2CloseTag(line, name) {
  // @<name>-end on its own line (allowing leading whitespace).
  const m = line.match(/^\s*@([a-zA-Z][a-zA-Z0-9_-]*)-end\s*$/)
  return m && (!name || m[1] === name)
}

function isAnyV2CloseTag(line) {
  return /^\s*@[a-zA-Z][a-zA-Z0-9_-]*-end\s*$/.test(line)
}

// Detect an `@on complete -> TARGET` line (v1 transition).
// Captures: indent, target (everything after ->).
const ON_COMPLETE_V1_RE = /^(\s*)@on\s+complete\s*->\s*(.+?)\s*$/

// Detect an `@on-complete TARGET /` line (v2 transition — leave alone).
const ON_COMPLETE_V2_RE = /^(\s*)@on-complete\s+.*\/\s*$/

function migrate(content) {
  const lines = content.split('\n')
  const out = []
  // Stack of open block directives: [{name, indent}].
  const stack = []
  let inFence = false
  let fenceMarker = null
  let inFrontmatter = false

  // Counters for reporting.
  const counts = {
    transitions: 0,
    closeTags: 0,
    inlineToBlock: 0,
    selfCloseAdded: 0,
  }

  // Detect leading YAML frontmatter — only if the very first line is `---`.
  let i = 0
  if (lines.length > 0 && lines[0].trim() === '---') {
    out.push(lines[0])
    i = 1
    inFrontmatter = true
    while (i < lines.length) {
      out.push(lines[i])
      if (lines[i].trim() === '---') {
        i++
        inFrontmatter = false
        break
      }
      i++
    }
  }

  while (i < lines.length) {
    const line = lines[i]

    // Track code fence state. Inside a fence, copy verbatim.
    const fenceMatch = line.match(FENCE_RE)
    if (fenceMatch) {
      const marker = fenceMatch[2]
      if (!inFence) {
        inFence = true
        fenceMarker = marker
      } else if (marker === fenceMarker) {
        inFence = false
        fenceMarker = null
      }
      out.push(line)
      i++
      continue
    }
    if (inFence) {
      out.push(line)
      i++
      continue
    }

    // --- Rule 1: transitions ---
    const transMatch = line.match(ON_COMPLETE_V1_RE)
    if (transMatch && !ON_COMPLETE_V2_RE.test(line)) {
      const [, indent, target] = transMatch
      out.push(`${indent}@on-complete ${target} /`)
      counts.transitions++
      i++
      continue
    }
    if (ON_COMPLETE_V2_RE.test(line)) {
      // Already v2 — leave.
      out.push(line)
      i++
      continue
    }

    // --- Rule 2: block close tags ---
    const bareEnd = line.match(/^(\s*)@end\s*$/)
    const endIf = line.match(/^(\s*)@endif\s*$/)
    const endSwitch = line.match(/^(\s*)@endswitch\s*$/)

    if (bareEnd || endIf || endSwitch) {
      const indent = (bareEnd || endIf || endSwitch)[1]
      let openerName
      if (endIf) {
        openerName = 'if'
      } else if (endSwitch) {
        openerName = 'switch'
      } else {
        // Pop the topmost open block.
        const top = stack.pop()
        if (!top) {
          // No matching opener tracked — emit a best-effort @end (leave unchanged).
          out.push(line)
          i++
          continue
        }
        openerName = top.name
      }
      // For @endif/@endswitch we still want to pop the stack if matching.
      if (endIf || endSwitch) {
        // Find and remove the most recent matching opener.
        for (let s = stack.length - 1; s >= 0; s--) {
          if (stack[s].name === openerName) {
            stack.splice(s, 1)
            break
          }
        }
      }
      out.push(`${indent}@${openerName}-end`)
      counts.closeTags++
      i++
      continue
    }

    // Already-v2 close tag — track and pop.
    const v2Close = line.match(/^\s*@([a-zA-Z][a-zA-Z0-9_-]*)-end\s*$/)
    if (v2Close) {
      const name = v2Close[1]
      for (let s = stack.length - 1; s >= 0; s--) {
        if (stack[s].name === name) {
          stack.splice(s, 1)
          break
        }
      }
      out.push(line)
      i++
      continue
    }

    // --- Directive opener line ---
    const m = line.match(DIRECTIVE_LINE_RE)
    if (m) {
      const [, indent, name, rest] = m
      const trimmedRest = rest.trim()

      // Skip mid-block directives — don't push/pop stack, leave as-is.
      if (MID_BLOCK.has(name)) {
        out.push(line)
        i++
        continue
      }

      // Special: `@on` (followed by `complete -> ...`) handled above.
      if (name === 'on') {
        out.push(line)
        i++
        continue
      }

      // Block opener.
      if (BLOCK_OPENERS.has(name)) {
        // Push onto stack so the matching @end pops correctly.
        stack.push({ name, indent })
        out.push(line)
        i++
        continue
      }

      // Inline directive.
      if (INLINE_DIRECTIVES.has(name)) {
        // Already v2 self-close?
        if (isV2SelfClose(line)) {
          out.push(line)
          i++
          continue
        }

        // Detect continuation lines: indented deeper than opener.
        const openerIndent = indent.length
        const continuations = []
        let j = i + 1
        while (j < lines.length) {
          const nxt = lines[j]
          // Stop on blank line.
          if (nxt.trim() === '') break
          // Stop on a directive line at any indent (continuations are attribute-shaped, not @-prefixed).
          if (/^\s*@/.test(nxt)) break
          // Continuation must be indented deeper than opener.
          const nxtIndentMatch = nxt.match(/^(\s*)/)
          const nxtIndent = nxtIndentMatch[1].length
          if (nxtIndent <= openerIndent) break
          continuations.push(nxt)
          j++
        }

        if (continuations.length > 0) {
          // Idempotence check: if the next line after continuations is already
          // the v2 close tag for this directive, the block is already v2 —
          // leave everything as-is.
          const closeLine = j < lines.length ? lines[j] : null
          if (closeLine && new RegExp(`^\\s*@${name}-end\\s*$`).test(closeLine)) {
            // Already v2 block form — passthrough everything including the close.
            out.push(line)
            for (const c of continuations) out.push(c)
            out.push(closeLine)
            i = j + 1
            continue
          }
          // Case B: convert to v2 block form.
          // Move any inline args from opener onto continuation lines for uniformity.
          out.push(`${indent}@${name}`)
          if (trimmedRest.length > 0) {
            // Split inline args on whitespace, preserving quoted values.
            const inlineAttrs = splitArgs(trimmedRest)
            const contIndent = continuations[0].match(/^(\s*)/)[1]
            for (const a of inlineAttrs) {
              out.push(`${contIndent}${a}`)
            }
          }
          for (const c of continuations) {
            out.push(c)
          }
          out.push(`${indent}@${name}-end`)
          counts.inlineToBlock++
          i = j
          continue
        }

        // Case A: single-line — add ` /` self-close.
        // Preserve any trailing whitespace stripping behavior: ensure exactly one space + slash.
        const cleaned = line.replace(/\s+$/, '')
        out.push(`${cleaned} /`)
        counts.selfCloseAdded++
        i++
        continue
      }

      // Unknown directive — leave as-is.
      out.push(line)
      i++
      continue
    }

    // Non-directive line — passthrough.
    out.push(line)
    i++
  }

  return { content: out.join('\n'), counts }
}

// Split inline opener args into a list of attribute tokens, preserving quoted values.
function splitArgs(s) {
  const result = []
  let buf = ''
  let inQuote = null
  for (let k = 0; k < s.length; k++) {
    const c = s[k]
    if (inQuote) {
      buf += c
      if (c === inQuote) inQuote = null
      continue
    }
    if (c === '"' || c === "'") {
      inQuote = c
      buf += c
      continue
    }
    if (/\s/.test(c)) {
      if (buf.length > 0) {
        result.push(buf)
        buf = ''
      }
      continue
    }
    buf += c
  }
  if (buf.length > 0) result.push(buf)
  return result
}

// --- main ---
const args = process.argv.slice(2)
const inPlace = args.includes('--in-place')
const dryRun = args.includes('--dry-run')
const files = args.filter((a) => !a.startsWith('--'))

if (files.length === 0) {
  process.stderr.write(
    'Usage: node migrate-v1-to-v2.mjs <file>... [--dry-run] [--in-place]\n',
  )
  process.exit(1)
}

for (const file of files) {
  const v1 = readFileSync(file, 'utf8')
  const { content: v2, counts } = migrate(v1)
  const changed =
    counts.transitions + counts.closeTags + counts.inlineToBlock + counts.selfCloseAdded > 0

  if (inPlace) {
    if (v1 !== v2) writeFileSync(file, v2)
    const report = changed
      ? `Migrated ${file}: ${counts.transitions} transitions, ${counts.closeTags} close tags, ${counts.inlineToBlock} inline→block conversions, ${counts.selfCloseAdded} self-closes added\n`
      : `${file}: already v2\n`
    process.stderr.write(report)
  } else {
    process.stdout.write(v2)
    const report = changed
      ? `\n--- Migrated ${file}: ${counts.transitions} transitions, ${counts.closeTags} close tags, ${counts.inlineToBlock} inline→block conversions, ${counts.selfCloseAdded} self-closes added\n`
      : `\n--- ${file}: already v2\n`
    process.stdout.write(report)
  }
}
