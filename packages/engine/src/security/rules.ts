// Built-in immutable security rules — ships with package, cannot be disabled or overridden
import { homedir } from 'node:os'

const home = homedir()

// Shell command patterns — matched against raw command strings (which may contain literal ~)
export const SHELL_ALWAYS_BLOCK: readonly string[] = Object.freeze([
  'rm -rf *', 'rm -rf /', 'rm -rf ~', 'rm -rf .*',
  `:(){:|:&};:`,
  'dd if=* of=/dev/*',
  'mkfs *', 'format *',
  '> /etc/*',
  'chmod -R 777 *', 'chmod 777 /', 'chown -R * /',
  'wget * | bash', 'curl * | bash', 'curl * | sh',
  'eval', 'eval *', 'exec *',
  'cat /etc/shadow', 'cat /etc/passwd',
  'cat ~/.ssh/*', 'cat ~/.aws/*',
  `cat ${home}/.ssh/*`, `cat ${home}/.aws/*`,
  `rm -rf ${home}`,
  'env | *', 'printenv | *',
  'sudo rm *', 'sudo bash *',
  'python* -c *', 'ruby* -e *', 'perl* -e *', 'node* -e *', 'php* -r *',
])

export const SHELL_ALWAYS_ALERT: readonly string[] = Object.freeze([
  'sudo *', 'su *', 'passwd *', 'useradd *', 'crontab *',
  'nc *', 'netcat *', 'nmap *', 'ssh *', 'scp *', 'base64 *',
])

// HTTP domains — 169.254.* covers AWS EC2 (169.254.169.254), ECS task (169.254.170.2), and all link-local metadata
export const HTTP_ALWAYS_BLOCK_DOMAINS: readonly string[] = Object.freeze([
  '169.254.*',
  'metadata.google.internal',
  'metadata.internal',
  'fd00:ec2::254',
  '100.100.100.200',
])

export const DB_ALWAYS_BLOCK_KEYWORDS: readonly string[] = Object.freeze([
  'DROP DATABASE', 'DROP TABLE', 'TRUNCATE', 'DELETE FROM',
  'UPDATE ', 'ALTER TABLE', 'CREATE USER', 'GRANT ', 'REVOKE ',
])

export const DB_ALWAYS_BLOCK_MONGO: readonly string[] = Object.freeze([
  'db.dropDatabase()',
  '.drop()',
  '.deleteMany(',
  '.remove(',
  '.updateMany(',
  '.insertMany(',
  'db.admin(',
  'shutdown',
])

// Filesystem paths — always matched against absolute resolved paths; ~ expanded at module load
//
// Built-in safe roots: paths under these trees are explicitly permitted to
// MarkdownAI's tools even when the caller hasn't configured an allowlist.
// These are the canonical system directories for MarkdownAI itself and for
// frameworks built on top (MDD). Within them, the always-block patterns
// (e.g. `.env*`, `*.pem`) still apply — the allowlist grants entry to the
// tree, not unconditional read access to every file inside.
//
// `<cwd>/.mdd` is also allow-listed. When a flow file at
// ~/.claude/mdd2/flows/X.md does `@include .mdd/.startup.md`, the relative
// path resolves against the flow file's directory (the source jail), not
// against the project root. The .mdd/ directory in the project is what
// the flow author actually wants. This allowlist entry lets the engine
// resolve those reads against the project's .mdd/ tree even though it
// sits outside the source jail.
//
// Resolution timing: ${cwd} is captured at module load. mai-serve's cwd
// at startup IS the project root (Claude Code spawns it that way), so
// this resolves correctly per session.
const cwdAtLoad = process.cwd()
export const FILESYSTEM_ALWAYS_ALLOW_PATHS: readonly string[] = Object.freeze([
  `${home}/.claude/mdd2/**`,
  `${home}/.claude/mdd2/*`,
  `${home}/.claude/mdd2`,
  `${home}/.claude/markdownai/**`,
  `${home}/.claude/markdownai/*`,
  `${home}/.claude/markdownai`,
  `${home}/.markdownai/**`,
  `${home}/.markdownai/*`,
  `${home}/.markdownai`,
  `${home}/.claude/commands/**`,
  `${home}/.claude/commands/*`,
  `${cwdAtLoad}/.mdd/**`,
  `${cwdAtLoad}/.mdd/*`,
  `${cwdAtLoad}/.mdd`,
])

export const FILESYSTEM_ALWAYS_BLOCK_PATHS: readonly string[] = Object.freeze([
  `${home}/.ssh/*`, `${home}/.aws/*`, `${home}/.gnupg/*`,
  `${home}/.config/gcloud/*`, `${home}/.kube/*`,
  '/etc/passwd', '/etc/shadow', '/etc/sudoers', '/proc/*', '/sys/*',
])

export const FILESYSTEM_ALWAYS_BLOCK_PATTERNS: readonly string[] = Object.freeze([
  '*.pem', '*.key', '*.p12', '*.pfx', '*.jks',
  'id_rsa', 'id_ed25519', 'id_ecdsa',
  '.env*', '*.env',
  '*credentials*', '*secret*', '*password*', '*.token',
])

export const FILESYSTEM_ALWAYS_ALERT_PATTERNS: readonly string[] = Object.freeze([
  // Sensitive config files (credentials live in always_block list; these are
  // commonly-sensitive but not always-secret, hence alert rather than block).
  // *.json removed in v2.0 — it was too broad and produced noise on every
  // package.json / tsconfig.json / settings.json read.
  'config.yaml', 'config.yml',
  'settings.py', 'settings.rb', 'appsettings.*',
])

export function matchGlob(pattern: string, value: string): boolean {
  // * matches within a segment (no /), ** matches across segments
  const re = pattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*\*/g, '\x00')
    .replace(/\*/g, '[^/]*')
    .replace(/\x00/g, '.*')
    .replace(/\?/g, '[^/]')
  return new RegExp(`^${re}$`).test(value)
}

export function matchShellPattern(pattern: string, command: string): boolean {
  // Shell patterns: * matches anything including spaces and /
  const re = pattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*/g, '.*')
  return new RegExp(`^${re}$`).test(command)
}
