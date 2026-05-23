import type { ParseModule, ParseContext, ASTNode, HashNode } from '../types.js'
import { parseArgs } from '../args.js'

// @hash path="<file>" [algo=sha256] [length=N] [exclude-line=<regex>] [label=<name>]
//
// Compute a content hash of a file. Read-only — data-jail security.
//
// Options:
//   algo=          sha256 (default), sha1, md5
//   length=        truncate hex digest to first N chars (default: full digest)
//   exclude-line=  regex; lines matching this pattern are removed before hashing
//                  (useful for self-referencing hash: fields in frontmatter)
//   label=         store result in {{ label }} for later interpolation
//
// Returns the hex digest. Replaces the existing
//   @query bash -c "grep -v '^hash:' file | sha256sum | cut -c1-8"
// pattern with a single declarative line.
const hash: ParseModule = {
  name: 'hash',
  block: false,
  parse(_rawLine: string, args: string, ctx: ParseContext): ASTNode {
    const parsed = parseArgs(args)
    const path = parsed.named['path'] ?? ''
    const node: HashNode = {
      type: 'hash',
      line: ctx.line,
      path,
      args: parsed.named,
    }
    return node
  },
}

export default hash
