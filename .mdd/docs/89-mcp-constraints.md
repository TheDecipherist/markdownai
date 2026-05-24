---
id: 89-mcp-constraints
title: MCP — get_constraints Tool and Input Validation Layer
edition: "@markdownai/mcp"
depends_on: [30-mcp-server, 01-parser, 38-ai-constraints]
relates: [22-security-config, 37-ai-concepts]
source_files:
  - packages/mcp/src/tools/get_constraints.ts
  - packages/mcp/src/validate.ts
routes: []
models: []
test_files:
  - packages/mcp/src/__tests__/server.test.ts
data_flow: reads-existing
last_synced: 2026-05-24
status: draft
phase: reverse-engineered
mdd_version: 1
tags: [mcp, constraints, validation, tool, security, ai-integration]
path: MCP/Constraints
integration_contracts: []
satisfies_contracts: []
security_read_sites:
  - packages/mcp/src/tools/get_constraints.ts
  - packages/mcp/src/validate.ts
known_issues: []
---

# 89 — MCP — get_constraints Tool and Input Validation

## Purpose

`get_constraints` is a MCP tool that extracts `@constraint` directives from a
MarkdownAI document and returns them sorted by severity. It gives AI consumers
a structured, machine-readable view of the rules embedded in a document without
needing to parse the full AST themselves.

`validate.ts` is the central input validation layer shared by all MCP tools.
It guards against path injection, oversized payloads, and malformed env keys
before any tool logic runs.

## Architecture

**`packages/mcp/src/tools/get_constraints.ts`**

Exports `getConstraints(filePath, cwd)`:
1. Calls `validateMcpInput()` to check the file path for injection patterns
2. Resolves `filePath` relative to `cwd`
3. Reads and parses the file using `@markdownai/parser`'s `parse()` function
4. Recursively walks the AST collecting `ConstraintNode` entries
5. Sorts constraints by severity: `critical → high → medium → low` (unlabelled last)
6. Returns a `GetConstraintsResult` with the constraint list, an `isMarkdownAI` flag,
   and an optional `blocked` indicator if the document's phase is blocked

**`packages/mcp/src/validate.ts`**

Exports `validateMcpInput(fields)` and `validateEnvRecord(record)`:

`validateMcpInput` validates individual fields by name:
- Type checking (must be string where expected)
- Byte size limits per field
- Path injection guards: rejects `../`, `~`, absolute paths starting with `/`
- Env key format: `[A-Z_][A-Z0-9_]*` pattern

`validateEnvRecord` validates a `Record<string, string>` for use as env overrides:
- Each key validated against env key format
- Each value byte-limited

Returns a `McpValidationResult` with per-field errors for clear client feedback.

## Data Model

```typescript
interface ConstraintEntry {
  text: string
  severity: 'critical' | 'high' | 'medium' | 'low' | undefined
  line?: number
}

interface GetConstraintsResult {
  constraints: ConstraintEntry[]
  isMarkdownAI: boolean
  blocked?: boolean
}

interface McpValidationError {
  field: string
  code: string
  message: string
}

interface McpValidationResult {
  valid: boolean
  errors: McpValidationError[]
}
```

## API Endpoints

This is an MCP tool, not an HTTP endpoint. Tool call signature:

```json
{
  "name": "get_constraints",
  "arguments": {
    "filePath": ".mdd/docs/01-parser.md"
  }
}
```

Response:
```json
{
  "constraints": [
    { "text": "Parser must not spawn processes", "severity": "critical" },
    { "text": "No eval() anywhere", "severity": "critical" },
    { "text": "No file > 300 lines", "severity": "high" }
  ],
  "isMarkdownAI": true,
  "blocked": false
}
```

## Business Rules

**Severity ordering:**
Constraints are returned in this order: `critical`, `high`, `medium`, `low`,
`undefined` (no severity label). Within each severity level, document order is
preserved.

**`isMarkdownAI` flag:**
Set to `true` if the parsed file has an `@markdownai` header directive. Allows
AI consumers to distinguish between plain markdown files (which may contain
text resembling constraints) and actual MarkdownAI documents.

**`blocked` indicator:**
Set based on the document's phase state. If the current rendering phase is
blocked (phase gate not passed), `blocked: true` is returned so AI consumers
know to treat the constraints as informational only.

**Validation rules (`validateMcpInput`):**
- File paths must be relative (no `/` prefix, no `../`, no `~`)
- Max path length: 500 bytes
- Env key names: uppercase letters, digits, underscores; must start with letter or underscore
- Max env value length: 4096 bytes
- Any validation failure blocks the tool call with a structured error response

## Data Flow

MCP tool call → `validateMcpInput` (path injection guard) → `resolve(cwd, filePath)`
→ `parse()` (full AST) → recursive AST walk collecting `ConstraintNode`s → sort
by severity → return `GetConstraintsResult`.

## Dependencies

- `30-mcp-server`: `get_constraints` is registered as one of the 9 MCP tools
- `01-parser`: `parse()` and `ConstraintNode` type
- `23-security-filesystem`: `checkFilePath()` used inside the tool for additional
  path validation beyond what `validateMcpInput` provides
- `38-ai-constraints`: defines the `@constraint` directive that this tool reads

## Security

`validateMcpInput` runs before any filesystem access. Path injection patterns
(`../`, leading `/`, `~`) are rejected at the boundary. The tool is read-only
and does not execute any directives in the parsed document.

## Known Issues

(none yet)
