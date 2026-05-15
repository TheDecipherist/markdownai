import type { InterpolationSpan } from './types.js'

export function scanInterpolations(text: string): InterpolationSpan[] {
  const spans: InterpolationSpan[] = []
  let i = 0

  while (i < text.length) {
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
