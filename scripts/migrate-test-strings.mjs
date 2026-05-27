#!/usr/bin/env node
// Migrate v1 directive syntax to v2 inside JS string literals in .test.ts files.
//
// Strategy: scan source for string literals (single/double quoted with `\n` escapes,
// and backtick template literals with real newlines). For each, convert the string's
// content to a multi-line text doc, run the v1→v2 migration logic, then re-encode.
//
// Usage: node migrate-test-strings.mjs <file>... [--dry-run]
//
// We reuse the migration logic from packages/parser/scripts/migrate-v1-to-v2.mjs
// inlined here so that we work on individual string contents (not whole files).

import { readFileSync, writeFileSync } from 'node:fs'

// --- migration logic (lifted from migrate-v1-to-v2.mjs) -----------------------

const BLOCK_OPENERS = new Set([
  'phase', 'if', 'foreach', 'define', 'prompt', 'note', 'section',
  'render-template', 'constraint', 'switch',
  'plugin-meta', 'plugin-detect', 'plugin-layout', 'plugin-conventions',
])

const INLINE_DIRECTIVES = new Set([
  'db', 'event', 'update-frontmatter', 'call', 'check', 'http', 'query',
  'list', 'read', 'tree', 'count', 'touch', 'mkdir', 'copy',
  'append-if-missing', 'connect', 'import', 'include', 'set',
  'markdownai-detect', 'plugin-data', 'hash', 'test', 'date',
  'read-frontmatter', 'env', 'render', 'graph',
  'define-concept', 'invocation-start', 'verbose-trace', 'on-complete',
  'chunk-boundary',
])

const MID_BLOCK = new Set(['elseif', 'else', 'case', 'default'])

const DIRECTIVE_LINE_RE = /^(\s*)@([a-zA-Z][a-zA-Z0-9_-]*)(.*)$/
const FENCE_RE = /^(\s*)(```|~~~)/
const ON_COMPLETE_V1_RE = /^(\s*)@on\s+complete\s*->\s*(.+?)\s*$/
const ON_COMPLETE_V2_RE = /^(\s*)@on-complete\s+.*\/\s*$/

function isV2SelfClose(line) {
  return / \/\s*$/.test(line)
}

function migrate(content) {
  const lines = content.split('\n')
  const out = []
  const stack = []
  let inFence = false
  let fenceMarker = null

  let i = 0
  // Note: do NOT special-case YAML frontmatter in inline string contents;
  // strings rarely start with `---` and we'd misclassify multi-line strings.

  while (i < lines.length) {
    const line = lines[i]

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

    // Transitions
    const transMatch = line.match(ON_COMPLETE_V1_RE)
    if (transMatch && !ON_COMPLETE_V2_RE.test(line)) {
      const [, indent, target] = transMatch
      out.push(`${indent}@on-complete ${target} /`)
      i++
      continue
    }
    if (ON_COMPLETE_V2_RE.test(line)) {
      out.push(line)
      i++
      continue
    }

    // Block close tags
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
        const top = stack.pop()
        if (!top) {
          out.push(line)
          i++
          continue
        }
        openerName = top.name
      }
      if (endIf || endSwitch) {
        for (let s = stack.length - 1; s >= 0; s--) {
          if (stack[s].name === openerName) {
            stack.splice(s, 1)
            break
          }
        }
      }
      out.push(`${indent}@${openerName}-end`)
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

    // Directive opener
    const m = line.match(DIRECTIVE_LINE_RE)
    if (m) {
      const [, indent, name, rest] = m
      const trimmedRest = rest.trim()

      if (MID_BLOCK.has(name)) {
        out.push(line)
        i++
        continue
      }
      if (name === 'on') {
        out.push(line)
        i++
        continue
      }

      if (BLOCK_OPENERS.has(name)) {
        stack.push({ name, indent })
        out.push(line)
        i++
        continue
      }

      if (INLINE_DIRECTIVES.has(name)) {
        if (isV2SelfClose(line)) {
          out.push(line)
          i++
          continue
        }

        const openerIndent = indent.length
        const continuations = []
        let j = i + 1
        while (j < lines.length) {
          const nxt = lines[j]
          if (nxt.trim() === '') break
          if (/^\s*@/.test(nxt)) break
          const nxtIndentMatch = nxt.match(/^(\s*)/)
          const nxtIndent = nxtIndentMatch[1].length
          if (nxtIndent <= openerIndent) break
          continuations.push(nxt)
          j++
        }

        if (continuations.length > 0) {
          const closeLine = j < lines.length ? lines[j] : null
          if (closeLine && new RegExp(`^\\s*@${name}-end\\s*$`).test(closeLine)) {
            out.push(line)
            for (const c of continuations) out.push(c)
            out.push(closeLine)
            i = j + 1
            continue
          }
          out.push(`${indent}@${name}`)
          if (trimmedRest.length > 0) {
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
          i = j
          continue
        }

        const cleaned = line.replace(/\s+$/, '')
        out.push(`${cleaned} /`)
        i++
        continue
      }

      out.push(line)
      i++
      continue
    }

    out.push(line)
    i++
  }

  return out.join('\n')
}

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

// --- JS string-literal scanner ------------------------------------------------

// Walk source and collect (start, end, raw-content, quote-kind) for every
// string literal. We need to handle:
//   - single quoted: '...' (escapes: \n, \', \\, etc.)
//   - double quoted: "..." (same)
//   - template:      `...` (escapes: \n, \`, \\, ${...} expressions)
// We do NOT parse properly — we use a simple scanner that skips comments and
// recognizes the three quote forms. Good enough for .test.ts files.

function scanStrings(src) {
  const strings = []
  let i = 0
  const n = src.length
  while (i < n) {
    const c = src[i]
    // line comment
    if (c === '/' && src[i + 1] === '/') {
      while (i < n && src[i] !== '\n') i++
      continue
    }
    // block comment
    if (c === '/' && src[i + 1] === '*') {
      i += 2
      while (i < n && !(src[i] === '*' && src[i + 1] === '/')) i++
      i += 2
      continue
    }
    if (c === "'" || c === '"' || c === '`') {
      const quote = c
      const start = i
      i++ // past opening quote
      while (i < n) {
        const ch = src[i]
        if (ch === '\\') {
          i += 2
          continue
        }
        if (quote === '`' && ch === '$' && src[i + 1] === '{') {
          // skip template expression — find matching }
          i += 2
          let depth = 1
          while (i < n && depth > 0) {
            if (src[i] === '{') depth++
            else if (src[i] === '}') depth--
            if (depth > 0) i++
          }
          i++ // past closing }
          continue
        }
        if (ch === quote) {
          i++ // past closing quote
          break
        }
        i++
      }
      strings.push({ start, end: i, quote })
      continue
    }
    i++
  }
  return strings
}

// Decode a JS string literal's content (between the quotes) into raw text.
// For template literals, we also need to preserve `${...}` placeholders.
//
// IMPORTANT: For template literals, we do NOT unescape `\$` — keeping `\$`
// in the decoded form preserves the distinction between a literal `${...}`
// (which was `\${...}` in source) and an interpolation `${...}`.
function decodeStringContent(srcSlice, quote) {
  // srcSlice is the FULL literal including quotes.
  const body = srcSlice.slice(1, -1)
  let out = ''
  let i = 0
  while (i < body.length) {
    const c = body[i]
    if (c === '\\') {
      const nxt = body[i + 1]
      if (nxt === 'n') { out += '\n'; i += 2; continue }
      if (nxt === 't') { out += '\t'; i += 2; continue }
      if (nxt === 'r') { out += '\r'; i += 2; continue }
      if (nxt === '\\') { out += '\\\\'; i += 2; continue }
      if (nxt === "'") {
        if (quote === "'") { out += "'" } else { out += "\\'" }
        i += 2; continue
      }
      if (nxt === '"') {
        if (quote === '"') { out += '"' } else { out += '\\"' }
        i += 2; continue
      }
      if (nxt === '`') {
        if (quote === '`') { out += '`' } else { out += '\\`' }
        i += 2; continue
      }
      if (nxt === '$') {
        // Preserve `\$` as literal in the decoded text. Re-encode untouched.
        if (quote === '`') { out += '\\$'; i += 2; continue }
        out += '$'; i += 2; continue
      }
      if (nxt === '0') { out += '\0'; i += 2; continue }
      // unknown escape — keep verbatim
      out += c + (nxt ?? '')
      i += 2
      continue
    }
    out += c
    i++
  }
  return out
}

// Re-encode raw text into a JS string literal body for the given quote.
// For template literals, the decoded form already contains `\$`, `\``, etc
// as escape sequences (we round-trip them). For single/double quotes, we
// process escapes normally.
function encodeStringContent(raw, quote) {
  if (quote === '`') {
    // For template literals, the decoded text is already in template-literal
    // body form (escapes preserved). The only transform needed is converting
    // any newline characters introduced by the migration back to `\n`.
    let out = ''
    for (let i = 0; i < raw.length; i++) {
      const ch = raw[i]
      // Skip over already-escaped sequences: backslash + next char goes through.
      if (ch === '\\' && i + 1 < raw.length) {
        out += ch + raw[i + 1]
        i++
        continue
      }
      if (ch === '\n') { out += '\\n'; continue }
      if (ch === '\r') { out += '\\r'; continue }
      if (ch === '\t') { out += '\\t'; continue }
      if (ch === '`') { out += '\\`'; continue }
      out += ch
    }
    return out
  }
  // Single/double quote: process escapes from raw chars.
  let out = ''
  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i]
    // Skip over already-escaped sequences in the decoded text.
    if (ch === '\\' && i + 1 < raw.length) {
      out += ch + raw[i + 1]
      i++
      continue
    }
    if (ch === '\n') { out += '\\n'; continue }
    if (ch === '\r') { out += '\\r'; continue }
    if (ch === '\t') { out += '\\t'; continue }
    if (ch === quote) {
      if (quote === "'") { out += "\\'" }
      else if (quote === '"') { out += '\\"' }
      continue
    }
    out += ch
  }
  return out
}

// Test whether a string content has any v1 directive syntax worth migrating.
function looksLikeDirective(content) {
  // Quick filter: must contain at least one `@<name>` pattern.
  return /@(?:end\b|endif\b|endswitch\b|on\s+complete\b|[a-zA-Z][a-zA-Z0-9_-]*)/.test(content)
}

// Migrate a single string's content. For template literals, we need to split
// around ${...} expressions so we don't touch them. For other quotes, we work
// on the decoded text directly.
function migrateStringContent(content, quote) {
  if (quote !== '`') {
    if (!looksLikeDirective(content)) return content
    // Decoded content is a multi-line text doc — migrate directly.
    return migrate(content)
  }
  // Template literal: split on ${...}, migrate non-expression parts.
  // Note we do NOT enter the expression bodies. `\${` (escaped dollar) is
  // literal text, not a placeholder — those are part of the text.
  const parts = []
  let i = 0
  const n = content.length
  while (i < n) {
    // Find next genuine `${` placeholder (not preceded by `\`).
    let j = i
    while (j < n) {
      if (content[j] === '\\' && content[j + 1] === '$') {
        // skip escaped dollar (with its backslash)
        j += 2
        continue
      }
      if (content[j] === '$' && content[j + 1] === '{') break
      j++
    }
    if (j > i) parts.push({ kind: 'text', text: content.slice(i, j) })
    if (j >= n) break
    // Now we're at a genuine `${`.
    let k = j + 2
    let depth = 1
    while (k < n && depth > 0) {
      if (content[k] === '{') depth++
      else if (content[k] === '}') depth--
      if (depth > 0) k++
    }
    parts.push({ kind: 'expr', text: content.slice(j, k + 1) })
    i = k + 1
  }
  // For correctness, migrate the JOIN of all text parts together,
  // so that block stacks line up across expression interpolations.
  // But ${...} represents arbitrary content — we replace it with a
  // sentinel. To avoid disturbing line structure for in-value
  // interpolations like attr="${val}", we DO NOT pad with newlines —
  // the sentinel sits exactly where the expression was. If the
  // expression was actually a whole prefix line like `${DOC}` (where
  // DOC = '@markdownai\n'), the migrator may not recognize directives
  // that follow on the same line. We accept that limitation: tests
  // affected need manual touch-ups, or they use the multi-line form.
  const SENTINEL_PREFIX = '__MAIEXPR'
  const SENTINEL_SUFFIX = 'XPRIAM__'
  let exprIdx = 0
  const exprs = []
  let combined = ''
  // Heuristic: if a text part ends with a newline and the next is an
  // expression at the start of the line (and the following text starts
  // at the line start, i.e. starts with `@` or whitespace then `@`),
  // we can safely treat the expression as a line-prefix that ends in
  // a newline — pad with `\n` only after the sentinel. Conversely, if
  // an expression appears mid-line (preceded by non-newline chars and
  // followed by non-newline chars), don't pad.
  for (let pi = 0; pi < parts.length; pi++) {
    const p = parts[pi]
    if (p.kind === 'text') {
      combined += p.text
    } else {
      const tok = `${SENTINEL_PREFIX}${exprIdx}${SENTINEL_SUFFIX}`
      exprs.push(p.text)
      // Look at what's immediately before/after in surrounding text.
      const prev = combined.length > 0 ? combined[combined.length - 1] : ''
      const next = pi + 1 < parts.length && parts[pi + 1].kind === 'text' && parts[pi + 1].text.length > 0
        ? parts[pi + 1].text[0]
        : ''
      const prevIsNewline = prev === '\n' || prev === ''
      const nextIsNewline = next === '\n' || next === ''
      // Pad with leading newline if we're starting at line start (prev is newline).
      // Pad with trailing newline if next char isn't already a newline AND there's
      // text after that starts a directive line.
      // Pragmatic rule: only pad when the expression appears in a "line-prefix"
      // position (prev is newline OR start of string), AND the following text
      // starts with `@` (a directive). In that case, treat the expression as
      // representing a complete line so the directive starts on its own line.
      const nextText = pi + 1 < parts.length && parts[pi + 1].kind === 'text' ? parts[pi + 1].text : ''
      if (prevIsNewline && /^@/.test(nextText)) {
        combined += `${tok}\n`
      } else if (prevIsNewline && /^\s*\n@/.test(nextText)) {
        // already a newline ahead
        combined += tok
      } else {
        combined += tok
      }
      exprIdx++
    }
  }
  if (!looksLikeDirective(combined)) return content
  const migrated = migrate(combined)
  // Re-insert expressions. Try padded form first, then bare.
  let out = migrated
  for (let k = 0; k < exprs.length; k++) {
    const tok = `${SENTINEL_PREFIX}${k}${SENTINEL_SUFFIX}`
    if (out.includes(`${tok}\n`)) {
      out = out.replace(`${tok}\n`, exprs[k])
    } else {
      out = out.replace(tok, exprs[k])
    }
  }
  return out
}

// Detect `[ 'line', 'line', ... ].join('\n'|'\\n')` patterns: each string
// inside the array is treated as one virtual line of a doc. Returns an array
// of { arrStart, arrEnd, elements: [{start, end, quote}] }.
function findArrayJoinGroups(src) {
  const groups = []
  // Match an opening `[` then collect string elements separated by `,` until
  // a `]` followed by `.join(` is seen. Anything else inside the brackets
  // disqualifies the group (e.g. variable references, expressions).
  let i = 0
  const n = src.length
  while (i < n) {
    // skip comments and strings (so brackets inside strings don't fool us)
    const c = src[i]
    if (c === '/' && src[i + 1] === '/') {
      while (i < n && src[i] !== '\n') i++
      continue
    }
    if (c === '/' && src[i + 1] === '*') {
      i += 2
      while (i < n && !(src[i] === '*' && src[i + 1] === '/')) i++
      i += 2
      continue
    }
    if (c === "'" || c === '"' || c === '`') {
      // skip whole string
      const quote = c
      i++
      while (i < n) {
        const ch = src[i]
        if (ch === '\\') { i += 2; continue }
        if (quote === '`' && ch === '$' && src[i + 1] === '{') {
          i += 2
          let depth = 1
          while (i < n && depth > 0) {
            if (src[i] === '{') depth++
            else if (src[i] === '}') depth--
            if (depth > 0) i++
          }
          i++
          continue
        }
        if (ch === quote) { i++; break }
        i++
      }
      continue
    }
    if (c === '[') {
      const arrStart = i
      i++
      const elements = []
      let valid = true
      while (i < n) {
        // skip whitespace and commas
        while (i < n && /[\s,]/.test(src[i])) i++
        if (i >= n) { valid = false; break }
        if (src[i] === ']') break
        // expect a string literal or a bare identifier/expression
        if (src[i] === "'" || src[i] === '"' || src[i] === '`') {
          const quote = src[i]
          const elStart = i
          i++
          while (i < n) {
            const ch = src[i]
            if (ch === '\\') { i += 2; continue }
            if (quote === '`' && ch === '$' && src[i + 1] === '{') {
              i += 2
              let depth = 1
              while (i < n && depth > 0) {
                if (src[i] === '{') depth++
                else if (src[i] === '}') depth--
                if (depth > 0) i++
              }
              i++
              continue
            }
            if (ch === quote) { i++; break }
            i++
          }
          elements.push({ start: elStart, end: i, quote })
          continue
        }
        // Try to parse a bare identifier or simple expression (no spaces,
        // no closing-square-bracket). This handles entries like `DOC` or
        // `someFunc()`. We treat them as opaque (kind: 'expr'). Bail out
        // if we hit a comma or `]` (those terminate the element).
        if (/[a-zA-Z_$]/.test(src[i])) {
          const elStart = i
          let depth = 0
          while (i < n) {
            const ch = src[i]
            if (ch === '(' || ch === '[' || ch === '{') depth++
            else if (ch === ')' || ch === ']' || ch === '}') {
              if (depth === 0) break
              depth--
            } else if (ch === ',' && depth === 0) break
            else if ((ch === "'" || ch === '"' || ch === '`') && depth === 0) {
              // skip an inline string
              const q = ch
              i++
              while (i < n) {
                if (src[i] === '\\') { i += 2; continue }
                if (src[i] === q) { i++; break }
                i++
              }
              continue
            }
            i++
          }
          elements.push({ start: elStart, end: i, quote: null /* expr */ })
          continue
        }
        // Unknown — bail.
        valid = false
        break
      }
      if (!valid || src[i] !== ']') {
        i++
        continue
      }
      const arrEndBracket = i // points to ']'
      i++ // past ]
      // skip whitespace
      let k = i
      while (k < n && /\s/.test(src[k])) k++
      // expect `.join(`
      if (src.slice(k, k + 6) === '.join(') {
        // Skip into the join arg and verify it's '\n' or '\\n' (newline).
        // Either ''\n'' (template), '"\n"' (double), "'\n'" (single), or
        // the escape `\\n` in source.
        let argStart = k + 6
        let argEnd = argStart
        let depth = 1
        while (argEnd < n && depth > 0) {
          if (src[argEnd] === '(') depth++
          else if (src[argEnd] === ')') depth--
          if (depth > 0) argEnd++
        }
        const arg = src.slice(argStart, argEnd).trim()
        // Match '\n', "\n", `\n` (single newline join)
        if (arg === "'\\n'" || arg === '"\\n"' || arg === '`\\n`') {
          groups.push({ arrStart, arrEnd: argEnd + 1, elements })
        }
      }
      continue
    }
    i++
  }
  return groups
}

// Transform a whole .test.ts file.
function transformFile(src) {
  // Pass 1: array-join groups. Treat each group's element strings as
  // sequential lines of a single virtual doc, run migration, then write back.
  const groups = findArrayJoinGroups(src)
  let result = src
  const SENTINEL_PREFIX = '__MAIARREXP'
  const SENTINEL_SUFFIX = 'PXERRAIM__'
  // Process groups in reverse to preserve positions.
  for (let g = groups.length - 1; g >= 0; g--) {
    const { elements } = groups[g]
    // Decode each element to its content line. For expression elements
    // (quote === null), use a sentinel for their virtual content.
    const lines = elements.map((e, idx) => {
      if (e.quote === null) {
        // expression — opaque
        const expr = result.slice(e.start, e.end)
        return { ...e, content: `${SENTINEL_PREFIX}${idx}${SENTINEL_SUFFIX}`, lit: expr, isExpr: true }
      }
      const lit = result.slice(e.start, e.end)
      return { ...e, content: decodeStringContent(lit, e.quote), lit, isExpr: false }
    })
    const joined = lines.map((l) => l.content).join('\n')
    if (!looksLikeDirective(joined)) continue
    const migrated = migrate(joined)
    if (migrated === joined) continue
    const newLines = migrated.split('\n')
    if (newLines.length !== lines.length) continue
    // Replace each element with new content.
    for (let k = lines.length - 1; k >= 0; k--) {
      const el = lines[k]
      const newContent = newLines[k]
      if (el.isExpr) continue // never rewrite expressions
      if (newContent === el.content) continue
      const newLit = el.quote + encodeStringContent(newContent, el.quote) + el.quote
      result = result.slice(0, el.start) + newLit + result.slice(el.end)
    }
  }

  // Pass 2: standalone strings (template literals with real newlines,
  // single-line escaped strings).
  const strings = scanStrings(result)
  for (let s = strings.length - 1; s >= 0; s--) {
    const { start, end, quote } = strings[s]
    const literal = result.slice(start, end)
    const content = decodeStringContent(literal, quote)
    const migrated = migrateStringContent(content, quote)
    if (migrated === content) continue
    const newLiteral = quote + encodeStringContent(migrated, quote) + quote
    result = result.slice(0, start) + newLiteral + result.slice(end)
  }
  return result
}

// --- main ---------------------------------------------------------------------

const args = process.argv.slice(2)
const dryRun = args.includes('--dry-run')
const files = args.filter((a) => !a.startsWith('--'))

if (files.length === 0) {
  process.stderr.write('Usage: node migrate-test-strings.mjs <file>... [--dry-run]\n')
  process.exit(1)
}

for (const file of files) {
  const v1 = readFileSync(file, 'utf8')
  const v2 = transformFile(v1)
  if (v1 === v2) {
    process.stderr.write(`${file}: no changes\n`)
    continue
  }
  if (dryRun) {
    process.stderr.write(`${file}: would change\n`)
  } else {
    writeFileSync(file, v2)
    process.stderr.write(`${file}: migrated\n`)
  }
}
