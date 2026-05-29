---
id: markdownai-templating-wave-1
title: "Wave 1: @template and @data directives"
initiative: markdownai-templating
initiative_version: 1
status: complete
depends_on: ""
demo_state: "@template ./row.md data=row / rendered inside @foreach row in {{ users }} (closed with @foreach-end) produces one card per user, with values from a parent @db query and a parent @set siteName visible inside the partial; @data myReport ... @data-end composes @db results and @set values into a nested object (including a ...baseConfig spread and a site.theme override), and two @template calls against that composite render cleanly - one with the default data binding and one with as=report; circular-reference and out-of-jail paths produce the same fatal errors as @include."
created: 2026-05-28
hash: 00000000
---

# Wave 1: @template and @data directives

## Demo-State

```
@db users from=mainDb query="SELECT * FROM users" label=users /
@set siteName = "Acme" /

@data baseConfig
  site.name = siteName
  site.theme = "light"
@data-end

@data myReport
  ...baseConfig
  users = users
  site.theme = "dark"
@data-end

@template ./summary.md data=myReport /
@template ./brand.md data=myReport as=report /

@foreach row in {{ users }}
  @template ./user-card.md data=row /
@foreach-end
```

`mai render` against the document above produces: a summary section using `{{ data.site.name }}` / `{{ data.site.theme }}` (showing `Acme` / `dark` - the spread brought in `site.name` and the later assignment overrode `site.theme`); a brand section that references the same composite as `{{ report.site.name }}` (showing the `as=report` rename); one user-card per user with `{{ data.id }}` / `{{ data.name }}` (showing per-iteration binding). The `siteName` set outside `@data` is also visible inside each partial via inherited scope. A test document that references its own path via `@template ./self.md /` fails with the standard circular-reference fatal error; a document that uses `@template ../../../etc/passwd /` fails the parse-time path-traversal check.

*(This wave is not complete until this can be manually demonstrated end-to-end with `mai render`.)*

## Features

| # | Feature | Doc | Status | Depends on |
|---|---------|-----|--------|------------|
| 1 | lang-template-data | .mdd/docs/99-lang-template-data.md | draft | 10-lang-include, 09-lang-file-resolution, 23-security-filesystem |

## Open Research

- Cache key shape for `@template @cache <mode>` when `data=` is bound to a non-deterministic source (e.g. `@http`). Plan: include the JSON-stringified resolved data in the cache key alongside the resolved path. Confirm during implementation.
- Whether `engine-template.ts` can share path-expansion and condition-evaluation helpers with `engine-include.ts` via a tiny shared module, or whether duplicating those few lines is cleaner. Decide during Phase 6.
