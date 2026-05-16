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
  └── 12-lang-conditionals  (complete)
Language/Connect
  └── 17-lang-connect  (complete)
Language/Env
  └── 07-lang-env  (complete)
Language/FileResolution
  └── 09-lang-file-resolution  (complete)
Language/Header
  └── 05-lang-header  (complete)
Language/Import
  └── 11-lang-import  (complete)
Language/Include
  └── 10-lang-include  (complete)
Language/Interpolation
  └── 06-lang-interpolation  (complete)
Language/Macros
  └── 08-lang-macros  (complete)
Language/Phases
  └── 21-lang-phases  (complete)
Language/Pipeline
  └── 13-lang-pipeline  (complete)
Language/Sources
  ├── 14-lang-sources-list  (complete)
  ├── 15-lang-sources-read  (complete)
  ├── 16-lang-sources-utilities  (complete)
  ├── 18-lang-sources-db  (complete)
  ├── 19-lang-sources-http  (complete)
  └── 20-lang-sources-query  (complete)
Security
  ├── 22-security-config  (complete)
  ├── 23-security-filesystem  (complete)
  ├── 24-security-shell  (complete)
  ├── 25-security-database  (complete)
  ├── 26-security-http  (complete)
  └── 27-security-immutable-rules  (complete)
Toolchain/CLI
  ├── 04-cli-core  (complete)
  └── 32-cli-complete  (complete)
Toolchain/Cache
  └── 28-caching  (complete)
Toolchain/Engine
  └── 03-engine  (complete)
Toolchain/Hook
  └── 31-hook  (complete)
Toolchain/MCP
  └── 30-mcp-server  (complete)
Toolchain/Parser
  └── 01-parser  (complete)
Toolchain/Renderer
  └── 02-renderer  (complete)
Toolchain/Stripper
  └── 29-stripper  (complete)
```

## Dependency Graph

```mermaid
graph LR
  classDef complete fill:#2a9d8f,color:#fff
  classDef in_progress fill:#e9c46a,color:#000
  classDef draft fill:#aaa,color:#fff
  classDef deprecated fill:#999,color:#fff
  12_lang_conditionals["12-lang-conditionals: Language — @if Conditionals an"]:::complete
  17_lang_connect["17-lang-connect: Language — @connect Database R"]:::complete
  07_lang_env["07-lang-env: Language — @env Environment Va"]:::complete
  09_lang_file_resolution["09-lang-file-resolution: Language — File Resolution Mod"]:::complete
  05_lang_header["05-lang-header: Language — Header Declaration "]:::complete
  11_lang_import["11-lang-import: Language — @import Definition "]:::complete
  10_lang_include["10-lang-include: Language — @include Content In"]:::complete
  06_lang_interpolation["06-lang-interpolation: Language — Inline Interpolatio"]:::complete
  08_lang_macros["08-lang-macros: Language — @define and @call M"]:::complete
  21_lang_phases["21-lang-phases: Language — @phase, @on complet"]:::complete
  13_lang_pipeline["13-lang-pipeline: Language — Pipe Operator and @"]:::complete
  14_lang_sources_list["14-lang-sources-list: Language — @list Source Direct"]:::complete
  15_lang_sources_read["15-lang-sources-read: Language — @read Source Direct"]:::complete
  16_lang_sources_utilities["16-lang-sources-utilities: Language — @tree, @date, @coun"]:::complete
  18_lang_sources_db["18-lang-sources-db: Language — @db Database Query "]:::complete
  19_lang_sources_http["19-lang-sources-http: Language — @http HTTP Request "]:::complete
  20_lang_sources_query["20-lang-sources-query: Language — @query Shell Comman"]:::complete
  22_security_config["22-security-config: Security — Config File, Runtim"]:::complete
  23_security_filesystem["23-security-filesystem: Security — Filesystem Confinem"]:::complete
  24_security_shell["24-security-shell: Security — Shell Execution Jai"]:::complete
  25_security_database["25-security-database: Security — Database Query Jail"]:::complete
  26_security_http["26-security-http: Security — HTTP Request Jail ("]:::complete
  27_security_immutable_rules["27-security-immutable-rules: Security — Built-in Immutable "]:::complete
  04_cli_core["04-cli-core: CLI Core — mai render, validat"]:::complete
  32_cli_complete["32-cli-complete: CLI Complete — All Remaining m"]:::complete
  28_caching["28-caching: Caching — @cache Modifier Syst"]:::complete
  03_engine["03-engine: Engine — AST Execution"]:::complete
  31_hook["31-hook: Hook — PreToolUse AI Routing"]:::complete
  30_mcp_server["30-mcp-server: MCP Server — AI Integration"]:::complete
  01_parser["01-parser: Parser — AST Production"]:::complete
  02_renderer["02-renderer: Renderer — Output Format Modul"]:::complete
  29_stripper["29-stripper: Stripper — mai strip Command"]:::complete
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
