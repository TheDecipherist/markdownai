---
id: vscode-extension-wave-2
title: "Wave 2: Intelligence"
initiative: vscode-extension
initiative_version: 1
status: planned
depends_on: vscode-extension-wave-1
demo_state: "Type @call and see every stdlib macro with its description and the label it sets. Hover over @call git-status to see 'Sets {{ git_status }} - compact git status output'. Cmd+click any @call to jump to its @define."
created: 2026-05-17
hash:
---

# Wave 2: Intelligence

## Demo-State

Type `@call ` and an IntelliSense popup lists every stdlib macro and every user-defined `@define` in scope, each with a description of what it does and what label it sets. Hover over `@call git-status` and a tooltip shows the macro body and `{{ git_status }}`. Cmd+click (go to definition) on `@call project-manager` jumps to the `@define project-manager` block in `stdlib.md`.

*(This wave is not complete until this can be manually demonstrated.)*

## Features

| # | Feature | Doc | Status | Depends on |
|---|---------|-----|--------|------------|
| 1 | completion-provider | - | planned | - |
| 2 | hover-provider | - | planned | completion-provider |
| 3 | definition-provider | - | planned | hover-provider |
| 4 | reference-panel | - | planned | completion-provider |

## Open Research

- Documentation source: `.mdd/manual/manual.md` is the authoritative source for directive docs - more current than `MDs/markdownai-spec-v1.0.md`. The reference panel, hover docs, and completion descriptions all source from the manual, not the spec. The manual is parsed at extension activation and cached in memory.
- Stdlib macro metadata: the completion and hover providers need to know each stdlib macro's name, description, and label. Source this by parsing `packages/engine/src/stdlib.md` at extension activation - the HTML comments (`<!-- macro-name - label: description -->`) above each `@define` carry exactly this data. Parse once, cache in memory.
- Scope resolution for `@call`: to offer completions and go-to-definition across `@import`ed files, the provider needs to follow the import graph. For Wave 2, scope resolution covers: (a) macros defined in the current file, (b) macros in `@import`ed files (one level), (c) stdlib macros. Recursive imports are future scope.
- Variable origin tracking: `{{ label }}` hover should show which `@call` or `@query label=` set the variable. Track this by scanning the document for all `label=` args and `@call` macro names, building a label-to-origin map.
