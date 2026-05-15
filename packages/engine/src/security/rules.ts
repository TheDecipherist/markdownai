// Built-in immutable security rules — ships with package, cannot be disabled or overridden

export const SHELL_ALWAYS_BLOCK: string[] = [
  'rm -rf *', 'rm -rf /', 'rm -rf ~', 'rm -rf .*',
  ':(){:|:&};:',
  'dd if=* of=/dev/*',
  'mkfs *', 'format *',
  '> /etc/*',
  'chmod -R 777 *', 'chmod 777 /', 'chown -R * /',
  'wget * | bash', 'curl * | bash', 'curl * | sh',
  'eval *', 'exec *',
  'cat /etc/shadow', 'cat /etc/passwd', 'cat ~/.ssh/*', 'cat ~/.aws/*',
  'env | *', 'printenv | *',
  'sudo rm *', 'sudo bash *',
  'python* -c *', 'ruby* -e *', 'perl* -e *', 'node* -e *', 'php* -r *',
]

export const SHELL_ALWAYS_ALERT: string[] = [
  'sudo *', 'su *', 'passwd *', 'useradd *', 'crontab *',
  'nc *', 'netcat *', 'nmap *', 'ssh *', 'scp *', 'base64 *',
]

export const HTTP_ALWAYS_BLOCK_DOMAINS: string[] = [
  '169.254.169.254',
  'metadata.google.internal',
  'metadata.internal',
  'fd00:ec2::254',
  '100.100.100.200',
]

export const DB_ALWAYS_BLOCK_KEYWORDS: string[] = [
  'DROP DATABASE', 'DROP TABLE', 'TRUNCATE', 'DELETE FROM',
  'UPDATE ', 'ALTER TABLE', 'CREATE USER', 'GRANT ', 'REVOKE ',
]

export const DB_ALWAYS_BLOCK_MONGO: string[] = [
  'db.dropDatabase()',
  '.drop()',
  '.deleteMany(',
  '.remove(',
  '.updateMany(',
  '.insertMany(',
  'db.admin(',
  'shutdown',
]

export const FILESYSTEM_ALWAYS_BLOCK_PATHS: string[] = [
  '~/.ssh/*', '~/.aws/*', '~/.gnupg/*', '~/.config/gcloud/*', '~/.kube/*',
  '/etc/passwd', '/etc/shadow', '/etc/sudoers', '/proc/*', '/sys/*',
]

export const FILESYSTEM_ALWAYS_BLOCK_PATTERNS: string[] = [
  '*.pem', '*.key', '*.p12', '*.pfx', '*.jks',
  'id_rsa', 'id_ed25519', 'id_ecdsa',
  '.env*', '*.env',
  '*credentials*', '*secret*', '*password*', '*.token',
]

export const FILESYSTEM_ALWAYS_ALERT_PATTERNS: string[] = [
  '*.json', 'config.yaml', 'config.yml',
  'settings.py', 'settings.rb', 'appsettings.*',
]

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
