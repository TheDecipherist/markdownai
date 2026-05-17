import type { Command } from 'commander'
import {
  securityShow, securityInit, securityDisable,
  securityShellEnable, securityShellAdd, securityShellRemove, securityShellList,
  securityHttpEnable, securityHttpAddDomain, securityHttpRemoveDomain,
} from './commands/security.js'

export function registerSecurity(program: Command): void {
  const security = program.command('security').description('manage security configuration')

  security.command('show').description('show current security config').action(() => {
    process.stdout.write(JSON.stringify(securityShow().data, null, 2) + '\n')
  })
  security.command('init').description('create default security config').action(() => {
    process.stdout.write(`✓ ${securityInit().message}\n`)
  })
  security.command('disable').description('disable all dynamic directives').action(() => {
    process.stdout.write(`✓ ${securityDisable().message}\n`)
  })

  const shell = security.command('shell').description('manage shell execution security')
  shell.command('enable').action(() => { process.stdout.write(`✓ ${securityShellEnable(true).message}\n`) })
  shell.command('disable').action(() => { process.stdout.write(`✓ ${securityShellEnable(false).message}\n`) })
  shell.command('add <pattern>').action((pattern: string) => { process.stdout.write(`✓ ${securityShellAdd(pattern).message}\n`) })
  shell.command('remove <pattern>').action((pattern: string) => { process.stdout.write(`✓ ${securityShellRemove(pattern).message}\n`) })
  shell.command('list').action(() => {
    const patterns = securityShellList().data as string[]
    if (patterns.length === 0) process.stdout.write('No allow patterns\n')
    else patterns.forEach((p: string) => process.stdout.write(`  ${p}\n`))
  })

  const http = security.command('http').description('manage HTTP security')
  http.command('enable').action(() => { process.stdout.write(`✓ ${securityHttpEnable(true).message}\n`) })
  http.command('disable').action(() => { process.stdout.write(`✓ ${securityHttpEnable(false).message}\n`) })
  http.command('add-domain <domain>').action((domain: string) => { process.stdout.write(`✓ ${securityHttpAddDomain(domain).message}\n`) })
  http.command('remove-domain <domain>').action((domain: string) => { process.stdout.write(`✓ ${securityHttpRemoveDomain(domain).message}\n`) })
}
