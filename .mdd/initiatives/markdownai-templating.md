---
id: markdownai-templating
title: Reusable Partials with Bound Data
status: complete
version: 1
created: 2026-05-28
---

# Reusable Partials with Bound Data

## Overview

MarkdownAI already lets a document include another file (`@include`), generate a brand-new file from a key=value template (`@render-template`), and loop over collections (`@foreach`). What it does not yet have is the pattern most templating systems (Angular, Vue, Mustache partials) consider table stakes: a reusable rendered fragment that the caller binds to an arbitrary data context.

This initiative adds two directives that fill that gap:

- `@template <path> data=<expression> [as=<name>] /` - single-line directive that inlines a partial at the call site, executes every directive inside it the same way a top-level document does, and binds the caller-supplied expression to `{{ data.* }}` (or `{{ <name>.* }}` if `as=` is set) inside the partial. Self-closes with trailing ` /` per the v2 syntax convention.
- `@data <name>` ... `@data-end` - block directive that composes a single object out of any in-scope values (`@db` results, `@set` variables, env fallbacks, literals) using `<key> = <expression>` assignments and `...<expression>` spreads, so the resulting bundle can be passed to one or many `@template` calls.

Together they make it cheap to reuse the same rendered fragment for a list of database rows, a paginated response, or any other collection - including from inside an `@foreach` - while keeping MarkdownAI's existing file-resolution, security, and scope rules unchanged.

## Open Product Questions

- [x] Inside the partial, under what name is the bound data accessible? **Decision: Default name is `data`. Predictable, matches Angular/Vue conventions. An optional `as=<name>` attribute on the `@template` call renames the binding for cases where `data` is taken (nested partials) or where a domain name reads better.**
- [x] Should definitions inside the partial (`@define`, `@connect`) bubble up to the caller like `@include`, or stay local? **Decision: Stay local. Writes are sandboxed so the same partial can be called repeatedly (e.g. in `@foreach`) without name collisions.**
- [x] How is the data object composed from multiple sources? **Decision: New `@data` block directive with `<key> = <expression>` body lines and dot-notation for nested keys. Composes once, can feed multiple template calls.**
- [x] Should `@data` support spreading another object (`...other`)? **Decision: Yes. `...<expression>` body lines do a shallow merge in declaration order; later entries (spread or assignment) override earlier ones. Spread of a non-object value WARNs and skips. Enables baseConfig + variant patterns without rewriting all keys.**

## Waves

| Wave | File | Demo-state | Status |
|------|------|------------|--------|
| Wave 1 | waves/markdownai-templating-wave-1.md | `@template ./row.md data=row /` inside `@foreach` produces per-item output; `@data myReport ... @data-end` composes `@db` + `@set` values with `...spread` and dot-notation; `as=<name>` renames the binding; circular and out-of-jail paths fatal-error. Demonstrated by 81 passing tests across packages/parser and packages/engine. | complete |
