---
generated: 2026-05-16
doc_count: 32
connection_count: 38
overlap_count: 30
---

# Connections

## Path Tree

```
Language/Conditionals
  └── 12-lang-conditionals  (draft)
Language/Connect
  └── 17-lang-connect  (draft)
Language/Env
  └── 07-lang-env  (draft)
Language/FileResolution
  └── 09-lang-file-resolution  (draft)
Language/Header
  └── 05-lang-header  (draft)
Language/Import
  └── 11-lang-import  (draft)
Language/Include
  └── 10-lang-include  (draft)
Language/Interpolation
  └── 06-lang-interpolation  (draft)
Language/Macros
  └── 08-lang-macros  (draft)
Language/Phases
  └── 21-lang-phases  (draft)
Language/Pipeline
  └── 13-lang-pipeline  (draft)
Language/Sources
  ├── 14-lang-sources-list  (draft)
  ├── 15-lang-sources-read  (draft)
  ├── 16-lang-sources-utilities  (draft)
  ├── 18-lang-sources-db  (draft)
  ├── 19-lang-sources-http  (draft)
  └── 20-lang-sources-query  (draft)
Security
  ├── 22-security-config  (complete)
  ├── 23-security-filesystem  (complete)
  ├── 24-security-shell  (complete)
  ├── 25-security-database  (complete)
  ├── 26-security-http  (complete)
  └── 27-security-immutable-rules  (complete)
Toolchain/CLI
  ├── 04-cli-core  (complete)
  └── 32-cli-complete  (draft)
Toolchain/Cache
  └── 28-caching  (draft)
Toolchain/Engine
  └── 03-engine  (complete)
Toolchain/Hook
  └── 31-hook  (draft)
Toolchain/MCP
  └── 30-mcp-server  (draft)
Toolchain/Parser
  └── 01-parser  (complete)
Toolchain/Renderer
  └── 02-renderer  (complete)
Toolchain/Stripper
  └── 29-stripper  (draft)
```

## Dependency Graph

```mermaid
graph LR
  classDef complete fill:#2a9d8f,color:#fff
  classDef in_progress fill:#e9c46a,color:#000
  classDef draft fill:#aaa,color:#fff
  classDef deprecated fill:#999,color:#fff
  12_lang_conditionals["12-lang-conditionals: Language — @if Conditionals "]:::draft
  17_lang_connect["17-lang-connect: Language — @connect Database"]:::draft
  07_lang_env["07-lang-env: Language — @env Environment "]:::draft
  09_lang_file_resolution["09-lang-file-resolution: Language — File Resolution M"]:::draft
  05_lang_header["05-lang-header: Language — Header Declaratio"]:::draft
  11_lang_import["11-lang-import: Language — @import Definitio"]:::draft
  10_lang_include["10-lang-include: Language — @include Content "]:::draft
  06_lang_interpolation["06-lang-interpolation: Language — Inline Interpolat"]:::draft
  08_lang_macros["08-lang-macros: Language — @define and @call"]:::draft
  21_lang_phases["21-lang-phases: Language — @phase, @on compl"]:::draft
  13_lang_pipeline["13-lang-pipeline: Language — Pipe Operator and"]:::draft
  14_lang_sources_list["14-lang-sources-list: Language — @list Source Dire"]:::draft
  15_lang_sources_read["15-lang-sources-read: Language — @read Source Dire"]:::draft
  16_lang_sources_utilities["16-lang-sources-utilities: Language — @tree, @date, @co"]:::draft
  18_lang_sources_db["18-lang-sources-db: Language — @db Database Quer"]:::draft
  19_lang_sources_http["19-lang-sources-http: Language — @http HTTP Reques"]:::draft
  20_lang_sources_query["20-lang-sources-query: Language — @query Shell Comm"]:::draft
  22_security_config["22-security-config: Security — Config File, Runt"]:::complete
  23_security_filesystem["23-security-filesystem: Security — Filesystem Confin"]:::complete
  24_security_shell["24-security-shell: Security — Shell Execution J"]:::complete
  25_security_database["25-security-database: Security — Database Query Ja"]:::complete
  26_security_http["26-security-http: Security — HTTP Request Jail"]:::complete
  27_security_immutable_rules["27-security-immutable-rules: Security — Built-in Immutabl"]:::complete
  04_cli_core["04-cli-core: CLI Core — mai render, valid"]:::complete
  32_cli_complete["32-cli-complete: CLI Complete — All Remaining"]:::draft
  28_caching["28-caching: Caching — @cache Modifier Sy"]:::draft
  03_engine["03-engine: Engine — AST Execution"]:::complete
  31_hook["31-hook: Hook — PreToolUse AI Routing"]:::draft
  30_mcp_server["30-mcp-server: MCP Server — AI Integration"]:::draft
  01_parser["01-parser: Parser — AST Production"]:::complete
  02_renderer["02-renderer: Renderer — Output Format Mod"]:::complete
  29_stripper["29-stripper: Stripper — mai strip Command"]:::draft
  12_lang_conditionals --> 07_lang_env
  12_lang_conditionals --> 06_lang_interpolation
  17_lang_connect --> 07_lang_env
  07_lang_env --> 01_parser
  05_lang_header --> 01_parser
  11_lang_import --> 09_lang_file_resolution
  11_lang_import --> 07_lang_env
  10_lang_include --> 09_lang_file_resolution
  10_lang_include --> 08_lang_macros
  06_lang_interpolation --> 01_parser
  08_lang_macros --> 07_lang_env
  21_lang_phases --> 08_lang_macros
  21_lang_phases --> 10_lang_include
  14_lang_sources_list --> 13_lang_pipeline
  15_lang_sources_read --> 13_lang_pipeline
  18_lang_sources_db --> 17_lang_connect
  18_lang_sources_db --> 13_lang_pipeline
  19_lang_sources_http --> 13_lang_pipeline
  20_lang_sources_query --> 13_lang_pipeline
  23_security_filesystem --> 22_security_config
  24_security_shell --> 22_security_config
  25_security_database --> 22_security_config
  26_security_http --> 22_security_config
  27_security_immutable_rules --> 23_security_filesystem
  27_security_immutable_rules --> 24_security_shell
  27_security_immutable_rules --> 25_security_database
  27_security_immutable_rules --> 26_security_http
  04_cli_core --> 01_parser
  04_cli_core --> 02_renderer
  04_cli_core --> 03_engine
  32_cli_complete --> 28_caching
  32_cli_complete --> 29_stripper
  32_cli_complete --> 30_mcp_server
  03_engine --> 01_parser
  03_engine --> 02_renderer
  31_hook --> 30_mcp_server
  30_mcp_server --> 28_caching
  02_renderer --> 01_parser
```

## Source File Overlap

- `packages/core/src/commands/init.ts`: 32-cli-complete, 31-hook
- `packages/core/src/commands/strip.ts`: 32-cli-complete, 29-stripper
- `packages/engine/src/cache.ts`: 28-caching, 03-engine
- `packages/engine/src/conditions.ts`: 12-lang-conditionals, 06-lang-interpolation, 03-engine
- `packages/engine/src/context.ts`: 17-lang-connect, 07-lang-env, 03-engine
- `packages/engine/src/engine.ts`: 09-lang-file-resolution, 11-lang-import, 10-lang-include, 21-lang-phases, 14-lang-sources-list, 15-lang-sources-read, 16-lang-sources-utilities, 18-lang-sources-db, 19-lang-sources-http, 03-engine
- `packages/engine/src/macros.ts`: 08-lang-macros, 03-engine
- `packages/engine/src/pipe.ts`: 13-lang-pipeline, 03-engine
- `packages/engine/src/shell.ts`: 20-lang-sources-query, 03-engine
- `packages/parser/src/directives/call.ts`: 08-lang-macros, 01-parser
- `packages/parser/src/directives/connect.ts`: 17-lang-connect, 01-parser
- `packages/parser/src/directives/count.ts`: 16-lang-sources-utilities, 01-parser
- `packages/parser/src/directives/date.ts`: 16-lang-sources-utilities, 01-parser
- `packages/parser/src/directives/db.ts`: 18-lang-sources-db, 01-parser
- `packages/parser/src/directives/define.ts`: 08-lang-macros, 01-parser
- `packages/parser/src/directives/env.ts`: 07-lang-env, 01-parser
- `packages/parser/src/directives/graph.ts`: 21-lang-phases, 01-parser
- `packages/parser/src/directives/header.ts`: 05-lang-header, 01-parser
- `packages/parser/src/directives/http.ts`: 19-lang-sources-http, 01-parser
- `packages/parser/src/directives/if.ts`: 12-lang-conditionals, 01-parser
- `packages/parser/src/directives/import.ts`: 11-lang-import, 01-parser
- `packages/parser/src/directives/include.ts`: 10-lang-include, 01-parser
- `packages/parser/src/directives/list.ts`: 14-lang-sources-list, 01-parser
- `packages/parser/src/directives/phase.ts`: 21-lang-phases, 01-parser
- `packages/parser/src/directives/pipe.ts`: 13-lang-pipeline, 01-parser
- `packages/parser/src/directives/query.ts`: 20-lang-sources-query, 01-parser
- `packages/parser/src/directives/read.ts`: 15-lang-sources-read, 01-parser
- `packages/parser/src/directives/render.ts`: 13-lang-pipeline, 01-parser
- `packages/parser/src/directives/tree.ts`: 16-lang-sources-utilities, 01-parser
- `packages/renderer/src/renderer.ts`: 13-lang-pipeline, 02-renderer

## Warnings

(none)
