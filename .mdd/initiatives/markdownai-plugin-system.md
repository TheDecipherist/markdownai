---
id: markdownai-plugin-system
title: Plugin System and Introspection
status: complete
version: 3
hash: 59a70fd0
created: 2026-05-25
---

# Plugin System and Introspection

## Overview

MarkdownAI is a substrate. Frameworks built on top (MDD is one example, but the design is framework-agnostic) need a way to register themselves so introspection directives can detect their presence, declare expected directory layout so consumers do not have to guess, and surface framework-specific conventions to tools and users.

Without a registered descriptor, every consumer reinvents detection logic from training data, hand-rolled greps, or hallucination. With one, detection becomes a single directive call that returns ground truth.

This initiative ships as `@markdownai/* 1.2.0`. Changes are purely additive: new core directives, new parser node types for `@plugin-*` blocks, a new MCP tool, and a new loader subsystem. No breaking changes to existing directives, syntax, or APIs.

## Open Product Questions

- [x] Should `@plugin-detect` support arbitrary boolean composition (AND/OR/NOT) of its checks, or is "all must pass" sufficient for v1? **Decision: Full AND/OR/NOT composition supported in v1.**
- [x] Does `@markdownai-detect` skip the project file scan if faster signals (file/dir existence) pass first, before falling back to content scans? **Decision: Yes - file/dir checks run first; content scans only if faster signals pass.**
- [x] Where should plugin authors document their plugin's user-facing usage: inside the plugin file as rendered prose, or in a separate doc? **Decision: Inside the plugin file as rendered prose - plugin file is self-contained.**
- [x] Should `mai init` learn to install or update plugins (e.g., write the canonical MDD plugin on init when MDD is detected)? **Decision: Yes, but out of scope for this initiative. Implement as a follow-on after mdd2 ships the canonical plugin.**

## Waves

| Wave | File | Demo-state | Status |
|------|------|------------|--------|
| Wave 1 | waves/markdownai-plugin-system-wave-1.md | `mai parse mdd.plugin.md` succeeds; loader scans all three search paths, validates each plugin file, rejects any containing executable directives, and exposes a typed JS API returning loaded plugin data | complete |
| Wave 2 | waves/markdownai-plugin-system-wave-2.md | `@markdownai-detect as=info include="layout"` returns matching plugins against a fixture project; `@plugin-data name="mdd"` returns the MDD plugin descriptor directly; `available_directives` MCP tool responds with the full directive catalog | complete |
