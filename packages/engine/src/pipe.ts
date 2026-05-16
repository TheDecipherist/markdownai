const BUILTINS = new Set(['grep', 'sort', 'head', 'tail', 'wc', 'uniq'])

export function isBuiltin(command: string): boolean {
  const cmd = command.trim().split(/\s+/)[0] ?? ''
  return BUILTINS.has(cmd)
}

export function runBuiltin(command: string, lines: string[]): string[] {
  const parts = command.trim().split(/\s+/)
  const cmd = parts[0] ?? ''
  switch (cmd) {
    case 'grep': return runGrep(parts.slice(1), lines)
    case 'sort': return runSort(parts.slice(1), lines)
    case 'head': return lines.slice(0, parseCount(parts.slice(1), 10))
    case 'tail': return lines.slice(-parseCount(parts.slice(1), 10))
    case 'wc': return [String(lines.length)]
    case 'uniq': return lines.filter((l, i) => i === 0 || l !== lines[i - 1])
    default: throw new Error(`Unknown built-in command: "${cmd}"`)
  }
}

function parseCount(args: string[], def: number): number {
  // Supports: `head 5` and `head -n 5`
  if (args[0] === '-n') return parseN(args[1], def)
  return parseN(args[0], def)
}

function parseN(raw: string | undefined, def: number): number {
  const n = parseInt(raw ?? '', 10)
  return isNaN(n) ? def : n
}

function runGrep(args: string[], lines: string[]): string[] {
  let caseInsensitive = false
  let negate = false
  const patternParts: string[] = []
  for (const arg of args) {
    if (arg === '-i') caseInsensitive = true
    else if (arg === '-v') negate = true
    else if (arg === '-iv' || arg === '-vi') { caseInsensitive = true; negate = true }
    else patternParts.push(arg)
  }
  let re: RegExp
  try {
    re = new RegExp(patternParts.join(' '), caseInsensitive ? 'i' : '')
  } catch {
    throw new Error(`grep: invalid pattern: ${patternParts.join(' ')}`)
  }
  return lines.filter(l => negate ? !re.test(l) : re.test(l))
}

function runSort(flags: string[], lines: string[]): string[] {
  const f = flags.join(' ')
  const sorted = [...lines]
  if (f.includes('n') && f.includes('r')) {
    sorted.sort((a, b) => Number(b.split(/\s+/)[0]) - Number(a.split(/\s+/)[0]))
  } else if (f.includes('n')) {
    sorted.sort((a, b) => Number(a.split(/\s+/)[0]) - Number(b.split(/\s+/)[0]))
  } else if (f.includes('r')) {
    sorted.sort((a, b) => b.localeCompare(a))
  } else {
    sorted.sort((a, b) => a.localeCompare(b))
  }
  return sorted
}
