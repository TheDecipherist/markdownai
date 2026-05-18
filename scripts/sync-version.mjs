import { readFileSync, writeFileSync, readdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const rootPkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf-8'))
const { version } = rootPkg

const pkgDirs = readdirSync(join(root, 'packages'), { withFileTypes: true })
  .filter(d => d.isDirectory())
  .map(d => join(root, 'packages', d.name, 'package.json'))

let updated = 0
for (const file of pkgDirs) {
  let pkg
  try {
    pkg = JSON.parse(readFileSync(file, 'utf-8'))
  } catch {
    continue
  }
  if (pkg.version === version) continue
  pkg.version = version
  writeFileSync(file, JSON.stringify(pkg, null, 2) + '\n')
  console.log(`  ${pkg.name} -> ${version}`)
  updated++
}

if (updated === 0) {
  console.log(`  all packages already at ${version}`)
} else {
  console.log(`\nsynced ${updated} package(s) to ${version}`)
}
