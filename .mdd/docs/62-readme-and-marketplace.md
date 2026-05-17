---
id: 62-readme-and-marketplace
title: README and Marketplace Metadata
edition: VS Code Extension
depends_on: [61-test-suite]
source_files:
  - packages/vscode/README.md
routes: []
models: []
test_files: []
data_flow: greenfield
last_synced: 2026-05-17
status: complete
phase: all
mdd_version: v1.6.6
initiative: vscode-extension
wave: vscode-extension-wave-3
wave_status: active
tags: [readme, documentation, marketplace, vscode, extension, metadata]
path: VS Code Extension/Quality
integration_contracts: []
satisfies_contracts: []
known_issues: []
---

# 62 - README and Marketplace Metadata

## Purpose

Provides the extension README shown in the VS Code Marketplace and editor Extensions panel, plus adds publisher metadata to `package.json` needed for `vsce package`. Covers all Wave 1-3 features: syntax highlighting, snippets, autocomplete, hover docs, go-to-definition, reference panel, diagnostics, and settings.

## Architecture

Two parts:

1. `packages/vscode/README.md` - the extension documentation. VS Code displays this in the Extensions panel sidebar when the extension is installed. The marketplace uses it as the extension's product page.
2. `package.json` additions - `keywords`, `repository`, `bugs`, `homepage` fields that surface in the marketplace search and extension detail page.

Actual marketplace publishing (via `vsce publish`) is a separate ops runbook. This feature only covers the content and metadata, not the publish step.

## Data Model

No storage.

## API Endpoints

None.

## Business Rules

README must cover:
- What MarkdownAI is (one paragraph)
- Activation: opens automatically on `.md` files with `@markdownai` first line
- Feature list: syntax highlighting, snippets, autocomplete, hover docs, go-to-definition, reference panel, diagnostics
- Settings table: all three `markdownai.*` settings with defaults
- Requirements: VS Code 1.85+, extension activates on workspace open

## Data Flow

Greenfield.

## Dependencies

- `61-test-suite` - README states that `npm test` passes (89 tests).

## Security

Documentation only. No security surface.

## Known Issues

(none)
