import type { InterpolationSpan, ShellInlineSpan } from './types.js'

export function scanInterpolations(text: string): InterpolationSpan[] {
  const spans: InterpolationSpan[] = []
  let i = 0

  while (i < text.length) {
    // Skip triple-backtick fenced code blocks
    if (text[i] === '`' && text[i + 1] === '`' && text[i + 2] === '`') {
      const end = text.indexOf('```', i + 3)
      i = end !== -1 ? end + 3 : text.length
      continue
    }

    // Skip inline backtick code spans
    if (text[i] === '`') {
      const end = text.indexOf('`', i + 1)
      i = end !== -1 ? end + 1 : text.length
      continue
    }

    // Check for escaped \{{
    if (text[i] === '\\' && text.slice(i, i + 3) === '\\{{') {
      const end = text.indexOf('}}', i + 3)
      if (end !== -1) {
        const expression = text.slice(i + 3, end).trim()
        spans.push({ start: i, end: end + 2, expression, escaped: true })
        i = end + 2
        continue
      }
    }

    // Check for {{ expression }}
    if (text[i] === '{' && text[i + 1] === '{') {
      const end = text.indexOf('}}', i + 2)
      if (end !== -1) {
        const expression = text.slice(i + 2, end).trim()
        spans.push({ start: i, end: end + 2, expression, escaped: false })
        i = end + 2
        continue
      }
    }

    i++
  }

  return spans
}

export function scanShellInlines(text: string): ShellInlineSpan[] {
  const spans: ShellInlineSpan[] = []
  let i = 0
  while (i < text.length) {
    if (text[i] === '!' && text[i + 1] === '`') {
      const end = text.indexOf('`', i + 2)
      if (end !== -1) {
        spans.push({ start: i, end: end + 1, command: text.slice(i + 2, end) })
        i = end + 1
        continue
      }
    }
    if (text[i] === '`') {
      const end = text.indexOf('`', i + 1)
      i = end !== -1 ? end + 1 : text.length
      continue
    }
    i++
  }
  return spans
}
