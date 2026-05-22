---
id: release
title: MarkdownAI Release
type: ops
platform: npm + docker
environments: [production]
deployment_strategy:
  order: sequential
  gate: manual
  on_gate_failure: stop
  rollback_on_failure: false
regions: []
services:
  - slug: markdownai-npm
    image: ~
    port: ~
    health_check: npm view @markdownai/core version
  - slug: markdownai-website
    image: timcarterclausen/markdownai_website:latest
    port: 80
    health_check: curl -sf https://markdownai.dev
    regions: {}
status: active
last_synced: 2026-05-22
tags: [release, npm, publish, version-bump, main, docker, dokploy, docs]
known_issues: []
---

@markdownai v1.0

# MarkdownAI Release

## Overview

Publishes all six `@markdownai/*` npm packages, deploys the docs site to Dokploy, and optionally packages the VS Code extension. All steps run on `main` directly - this is the one workflow that bypasses the feature-branch rule.

**Lockstep versioning.** All six npm packages always release at the same version number, every release, whether or not their code changed. This is intentional - users installing `@markdownai/engine@0.0.23` and `@markdownai/core@0.0.23` should always be compatible, and a stale package at an older version creates confusion about which combination is supported. The `scripts/sync-version.mjs` script enforces this automatically when `npm version` runs.

The VS Code extension (`packages/vscode`) is the only exception - it has its own version and ships separately via the Marketplace.

**Publish order** (dependency-first):
1. `@markdownai/parser` - no internal deps
2. `@markdownai/renderer` - no internal deps
3. `@markdownai/engine` - depends on parser, renderer
4. `@markdownai/mcp` - depends on engine, parser, renderer
5. `@markdownai/core` - depends on engine, mcp, parser, renderer
6. `@markdownai/markdownai` - meta-package, no deps

## Services

| Service | Registry / Host | Health check |
|---------|----------------|-------------|
| @markdownai/core | registry.npmjs.org | `npm view @markdownai/core version` |
| markdownai.dev docs | Dokploy via Docker | `curl -sf https://markdownai.dev` |
| VS Code extension | marketplace.visualstudio.com | Manual - check Marketplace page |

## Credentials

| Credential | Location |
|-----------|----------|
| npm auth token | `~/.npmrc` (set by `npm login`) |
| GitHub SSH key | `~/.ssh/id_ed25519_decipherist` |
| Docker Hub login | `~/.docker/config.json` |
| `DOCKER_HUB_IMAGE` | `.env` |
| `DOKPLOY_WEBHOOK_URL` | `.env` |

All credentials must be pre-configured. This runbook does not set them up.

## Deployment Procedure

### Step 0 - Doc check (user-facing changes)

Ask the user: "Does this release include changes to CLI flags, commands, directives, API surface, or any other user-facing behaviour?"

If yes - verify all of these are updated before proceeding:
- `README.md` - CLI reference table, new commands/flags
- `packages/core/README.md` - CLI commands, flags, usage examples
- `packages/engine/README.md` - EngineOptions, new exports, API changes
- `packages/mcp/README.md` - new tools, setup changes, ServerOptions
- `packages/parser/README.md` - new AST node types, parse options
- `packages/renderer/README.md` - new format types, render options
- `packages/markdownai/README.md` - org index, links to updated packages
- `packages/vscode/README.md` - new directive highlighting, snippets, features
- `docs/index.html` - landing page, feature highlights, quick-start examples
- `docs/user-guide.html` - command reference table, directive docs, new sections

If any doc is missing updates - stop and update it first, then re-run `/mdd runop release`.

If no user-facing changes (internal fix, dependency update, performance patch) - proceed.

---

### Step 1 - Preflight: on main, clean tree

```bash
git checkout main
git pull origin main
git status --porcelain
```

`git status --porcelain` must return empty. If dirty - stop and resolve uncommitted changes.

Also confirm the branch guard won't interfere:
```bash
git branch --show-current
```

Must return `main`.

---

### Step 2 - Confirm bump type and current version

Show current version:
```bash
node -p "require('./package.json').version"
```

Ask user: **"Bump type? patch / minor / major"**

- patch: last digit (0.0.22 → 0.0.23) - bug fixes, internal changes
- minor: middle digit, reset patch (0.0.22 → 0.1.0) - new features, new directives
- major: first digit, reset rest (0.0.22 → 1.0.0) - breaking changes

Use `npm version` which runs the `version` hook (syncs all package.json files):
```bash
npm version <patch|minor|major> --no-git-tag-version
```

The `version` hook in root `package.json` runs `node scripts/sync-version.mjs` and stages `packages/*/package.json` automatically.

Verify the new version propagated to all packages:
```bash
node -p "require('./package.json').version"
grep '"version"' packages/*/package.json | head -10
```

All packages must show the new version.

---

### Step 3 - Build all packages

```bash
npm run build
```

All packages must compile without errors. The e2e workspace missing-build-script warning is expected and not a failure.

Run tests:
```bash
npm test --workspaces --if-present
```

All tests must pass.

---

### Step 4 - Commit version bump on main

Stage everything:
```bash
git add package.json packages/*/package.json
git commit -m "chore(release): bump to <NEW_VERSION>"
```

Verify:
```bash
git log --oneline -1
git branch --show-current
```

Must show the version bump commit on `main`.

---

### Step 5 - Push main to GitHub

```bash
git push origin main
```

Verify push exited 0:
```bash
git log --oneline origin/main -1
```

Must match local HEAD.

---

### Step 6 - Deploy docs site (if docs/ changed)

Check whether docs/ or any package README changed in this release:
```bash
git diff HEAD~1 --name-only | grep -E "^docs/|README\.md|packages/.*/README\.md"
```

If no output - skip to Step 7.

If docs files changed:

1. Load env:
   ```bash
   source .env
   ```

2. Build image:
   ```bash
   docker build -t $DOCKER_HUB_IMAGE . # Dockerfile is at repo root, not in docs/
   ```

3. Test locally:
   ```bash
   docker run -d -p 8080:80 --name mai-test $DOCKER_HUB_IMAGE
   sleep 5
   curl -sf http://localhost:8080 > /dev/null && echo "OK" || echo "FAIL"
   docker stop mai-test && docker rm mai-test
   ```

   If curl returns FAIL - **stop**. Fix the container issue before pushing.

4. Push image:
   ```bash
   docker push $DOCKER_HUB_IMAGE
   ```

5. Trigger Dokploy redeploy:
   ```bash
   curl -s -X POST "$DOKPLOY_WEBHOOK_URL"
   ```

6. Verify live (allow 30s for container restart):
   ```bash
   sleep 30 && curl -sf https://markdownai.dev > /dev/null && echo "Site live" || echo "Check Dokploy logs"
   ```

---

### Step 7 - Publish npm packages

Publish all six packages in dependency order. Do not skip a package because "nothing changed in it" - every package ships at the new version on every release. Each publish runs `prepublishOnly` (e2e tests) automatically.

```bash
npm publish --workspace=packages/parser --access public
npm publish --workspace=packages/renderer --access public
npm publish --workspace=packages/engine --access public
npm publish --workspace=packages/mcp --access public
npm publish --workspace=packages/core --access public
npm publish --workspace=packages/markdownai --access public
```

After each publish, verify it landed in the registry:
```bash
npm view @markdownai/parser version
npm view @markdownai/renderer version
npm view @markdownai/engine version
npm view @markdownai/mcp version
npm view @markdownai/core version
npm view @markdownai/markdownai version
```

Allow up to 60s for registry propagation. All must return the new version.

---

### Step 8 - VS Code extension (if src/vscode changed)

Check whether VS Code extension source changed:
```bash
git diff HEAD~2 --name-only | grep "^packages/vscode/"
```

If no output - skip. The extension has its own version and is published separately.

If vscode source changed:
```bash
npm run release:vscode
```

This builds the extension and produces a `.vsix` file. The script prints the Marketplace upload URL. Upload the `.vsix` manually at that URL.

Do not increment the root version for VS Code-only changes - the extension version in `packages/vscode/package.json` is managed independently.

---

### Step 9 - Global install update

Update the global `mai` install on this machine:
```bash
npm install -g @markdownai/core
```

Verify:
```bash
mai --version
```

Must return the new version.

---

## Rollback Plan

### npm packages published but something is wrong

Unpublish within 72 hours (npm policy limit):
```bash
npm unpublish @markdownai/core@<BAD_VERSION>
# repeat for each package that needs rollback
```

Then revert the version bump:
```bash
git revert HEAD --no-edit
git push origin main
```

Reinstall the previous version:
```bash
npm install -g @markdownai/core@<PREV_VERSION>
```

### Docs site failed to start after deploy

The npm release and docs site are independent. If the site fails, the packages are still published.

Fix the container issue on a branch, merge to main, then re-run Step 6 only:
```bash
source .env
docker build -t $DOCKER_HUB_IMAGE . # Dockerfile is at repo root, not in docs/
# test locally, then:
docker push $DOCKER_HUB_IMAGE
curl -s -X POST "$DOKPLOY_WEBHOOK_URL"
```

### Publish failed mid-sequence (auth error, build error)

Fix the issue on a feature branch, merge to main, then re-run publishing only for the packages that failed. Skip packages already at the new version:
```bash
npm view @markdownai/<package> version   # check which ones need re-publish
```

Do not bump the version again - publish the same version number.
