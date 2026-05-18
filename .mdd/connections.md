---
generated: 2026-05-18
doc_count: 79
connection_count: 146
overlap_count: 50
---

## Path Tree

```
├── AI/
│   ├── Concepts  37-ai-concepts  draft
│   ├── Constraints  38-ai-constraints  draft
│   ├── ConsumerMode  34-ai-consumer-mode  draft
│   ├── ContextBudget  36-ai-context-budget  draft
│   ├── Format  39-ai-format  draft
│   └── Prompt  35-ai-prompt  draft
├── DB/
│   ├── Adapters/
│   │   ├── 69-db-adapter-interface  complete
│   │   ├── 70-db-mongodb-adapter  complete
│   │   └── 71-db-sql-adapters  complete
│   ├── Caching  73-db-caching  complete
│   ├── Errors  74-db-error-handling  complete
│   ├── Internals/
│   │   ├── 67-db-queryplan-types  complete
│   │   └── 68-db-executor  complete
│   ├── Query Language/
│   │   ├── 63-db-query-language  complete
│   │   ├── 64-db-where-clause  complete
│   │   ├── 65-db-aggregate-operation  complete
│   │   └── 66-db-raw-escape-hatch  complete
│   └── Security  72-db-security  complete
├── Distribution/
│   └── Claude-Native  77-claude-native  complete
├── Engine/
│   ├── Conditions  47-skill-context-variables  complete
│   └── Security  48-shell-inline  complete
├── Integration/
│   └── MDD/
│       ├── 45-mdd-markdownai-integration  draft
│       └── 46-mdd-token-optimization-analysis  draft
├── Language/
│   ├── Conditionals  12-lang-conditionals  complete
│   ├── Connect  17-lang-connect  complete
│   ├── Env  07-lang-env  complete
│   ├── FileResolution  09-lang-file-resolution  complete
│   ├── Header  05-lang-header  complete
│   ├── Import  11-lang-import  complete
│   ├── Include  10-lang-include  complete
│   ├── Interpolation  06-lang-interpolation  complete
│   ├── Macros  08-lang-macros  complete
│   ├── Note  78-lang-note  complete
│   ├── Phases  21-lang-phases  complete
│   ├── Pipeline  13-lang-pipeline  complete
│   └── Sources/
│       ├── 14-lang-sources-list  complete
│       ├── 15-lang-sources-read  complete
│       ├── 16-lang-sources-utilities  complete
│       ├── 18-lang-sources-db  complete
│       ├── 19-lang-sources-http  complete
│       └── 20-lang-sources-query  complete
├── Security/
│   ├── 22-security-config  complete
│   ├── 23-security-filesystem  complete
│   ├── 24-security-shell  complete
│   ├── 25-security-database  complete
│   ├── 26-security-http  complete
│   └── 27-security-immutable-rules  complete
├── Testing/
│   ├── AI-E2E  40-ai-e2e-accuracy  draft
│   ├── E2E  33-e2e-test-suite  complete
│   └── MCP-E2E/
│       ├── 41-mcp-e2e-protocol  draft
│       ├── 42-mcp-e2e-tools  draft
│       ├── 43-mcp-e2e-security  draft
│       └── 44-mcp-e2e-ai-integration  draft
├── Toolchain/
│   ├── CLI/
│   │   ├── 04-cli-core  complete
│   │   └── 32-cli-complete  complete
│   ├── Cache  28-caching  complete
│   ├── Documentation  76-packages-readmes  complete
│   ├── Engine/
│   │   ├── 03-engine  complete
│   │   └── 75-engine-bug-fixes  complete
│   ├── Hook  31-hook  complete
│   ├── MCP  30-mcp-server  complete
│   ├── Parser  01-parser  complete
│   ├── Renderer  02-renderer  complete
│   └── Stripper  29-stripper  complete
├── VS Code Extension/
│   ├── Foundation/
│   │   ├── 51-package-scaffold  complete
│   │   ├── 52-language-definition  complete
│   │   ├── 53-syntax-highlighting  complete
│   │   ├── 54-snippets  complete
│   │   └── 60-extension-settings  complete
│   ├── Intelligence/
│   │   ├── 55-completion-provider  complete
│   │   ├── 56-hover-provider  complete
│   │   ├── 57-definition-provider  complete
│   │   ├── 58-reference-panel  complete
│   │   └── 79-vscode-preview  complete
│   └── Quality/
│       ├── 59-diagnostics-provider  complete
│       ├── 61-test-suite  complete
│       └── 62-readme-and-marketplace  complete
└── engine/
    ├── conditions  50-match-operator  complete
    └── stdlib  49-stdlib  complete
```

## Dependency Graph

```mermaid
flowchart LR
  n01[01-parser]:::complete
  n02[02-renderer]:::complete
  n03[03-engine]:::complete
  n04[04-cli-core]:::complete
  n05[05-lang-header]:::complete
  n06[06-lang-interpolation]:::complete
  n07[07-lang-env]:::complete
  n08[08-lang-macros]:::complete
  n09[09-lang-file-resolution]:::complete
  n10[10-lang-include]:::complete
  n11[11-lang-import]:::complete
  n12[12-lang-conditionals]:::complete
  n13[13-lang-pipeline]:::complete
  n14[14-lang-sources-list]:::complete
  n15[15-lang-sources-read]:::complete
  n16[16-lang-sources-utilities]:::complete
  n17[17-lang-connect]:::complete
  n18[18-lang-sources-db]:::complete
  n19[19-lang-sources-http]:::complete
  n20[20-lang-sources-query]:::complete
  n21[21-lang-phases]:::complete
  n22[22-security-config]:::complete
  n23[23-security-filesystem]:::complete
  n24[24-security-shell]:::complete
  n25[25-security-database]:::complete
  n26[26-security-http]:::complete
  n27[27-security-immutable-rules]:::complete
  n28[28-caching]:::complete
  n29[29-stripper]:::complete
  n30[30-mcp-server]:::complete
  n31[31-hook]:::complete
  n32[32-cli-complete]:::complete
  n33[33-e2e-test-suite]:::complete
  n34[34-ai-consumer-mode]:::draft
  n35[35-ai-prompt]:::draft
  n36[36-ai-context-budget]:::draft
  n37[37-ai-concepts]:::draft
  n38[38-ai-constraints]:::draft
  n39[39-ai-format]:::draft
  n40[40-ai-e2e-accuracy]:::draft
  n41[41-mcp-e2e-protocol]:::draft
  n42[42-mcp-e2e-tools]:::draft
  n43[43-mcp-e2e-security]:::draft
  n44[44-mcp-e2e-ai-integration]:::draft
  n45[45-mdd-markdownai-integration]:::draft
  n46[46-mdd-token-optimization-analysis]:::draft
  n47[47-skill-context-variables]:::complete
  n48[48-shell-inline]:::complete
  n49[49-stdlib]:::complete
  n50[50-match-operator]:::complete
  n51[51-package-scaffold]:::complete
  n52[52-language-definition]:::complete
  n53[53-syntax-highlighting]:::complete
  n54[54-snippets]:::complete
  n55[55-completion-provider]:::complete
  n56[56-hover-provider]:::complete
  n57[57-definition-provider]:::complete
  n58[58-reference-panel]:::complete
  n59[59-diagnostics-provider]:::complete
  n60[60-extension-settings]:::complete
  n61[61-test-suite]:::complete
  n62[62-readme-and-marketplace]:::complete
  n63[63-db-query-language]:::complete
  n64[64-db-where-clause]:::complete
  n65[65-db-aggregate-operation]:::complete
  n66[66-db-raw-escape-hatch]:::complete
  n67[67-db-queryplan-types]:::complete
  n68[68-db-executor]:::complete
  n69[69-db-adapter-interface]:::complete
  n70[70-db-mongodb-adapter]:::complete
  n71[71-db-sql-adapters]:::complete
  n72[72-db-security]:::complete
  n73[73-db-caching]:::complete
  n74[74-db-error-handling]:::complete
  n75[75-engine-bug-fixes]:::complete
  n79[79-vscode-preview]:::complete
  n76[76-packages-readmes]:::complete
  n77[77-claude-native]:::complete
  n78[78-lang-note]:::complete
  n01 --> n02
  n01 --> n03
  n02 --> n03
  n01 --> n04
  n02 --> n04
  n03 --> n04
  n01 --> n05
  n01 --> n06
  n01 --> n07
  n07 --> n08
  n09 --> n10
  n08 --> n10
  n09 --> n11
  n07 --> n11
  n07 --> n12
  n06 --> n12
  n13 --> n14
  n13 --> n15
  n07 --> n17
  n17 --> n18
  n13 --> n18
  n13 --> n19
  n13 --> n20
  n08 --> n21
  n10 --> n21
  n22 --> n23
  n22 --> n24
  n22 --> n25
  n22 --> n26
  n23 --> n27
  n24 --> n27
  n25 --> n27
  n26 --> n27
  n28 --> n30
  n30 --> n31
  n28 --> n32
  n29 --> n32
  n30 --> n32
  n04 --> n33
  n10 --> n33
  n11 --> n33
  n08 --> n33
  n12 --> n33
  n13 --> n33
  n14 --> n33
  n15 --> n33
  n16 --> n33
  n07 --> n33
  n21 --> n33
  n28 --> n33
  n29 --> n33
  n32 --> n33
  n12 --> n34
  n04 --> n34
  n01 --> n35
  n03 --> n35
  n34 --> n35
  n01 --> n36
  n03 --> n36
  n04 --> n36
  n01 --> n37
  n03 --> n37
  n34 --> n37
  n01 --> n38
  n03 --> n38
  n34 --> n38
  n02 --> n39
  n04 --> n39
  n30 --> n39
  n33 --> n40
  n34 --> n40
  n35 --> n40
  n36 --> n40
  n37 --> n40
  n38 --> n40
  n39 --> n40
  n30 --> n41
  n33 --> n41
  n30 --> n42
  n41 --> n42
  n22 --> n43
  n23 --> n43
  n27 --> n43
  n42 --> n43
  n30 --> n44
  n39 --> n44
  n38 --> n44
  n43 --> n44
  n45 --> n46
  n12 --> n47
  n30 --> n47
  n12 --> n48
  n20 --> n48
  n24 --> n48
  n47 --> n48
  n03 --> n49
  n06 --> n49
  n08 --> n49
  n03 --> n50
  n51 --> n52
  n52 --> n53
  n52 --> n54
  n51 --> n55
  n52 --> n55
  n55 --> n56
  n55 --> n57
  n56 --> n57
  n55 --> n58
  n55 --> n59
  n59 --> n61
  n60 --> n61
  n61 --> n62
  n17 --> n63
  n13 --> n63
  n63 --> n64
  n63 --> n65
  n64 --> n65
  n63 --> n66
  n64 --> n67
  n65 --> n67
  n67 --> n68
  n67 --> n69
  n69 --> n70
  n69 --> n71
  n68 --> n72
  n66 --> n72
  n68 --> n73
  n28 --> n73
  n68 --> n74
  n03 --> n75
  n08 --> n75
  n11 --> n75
  n12 --> n75
  n20 --> n75
  n22 --> n75
  n01 --> n76
  n02 --> n76
  n03 --> n76
  n04 --> n76
  n30 --> n76
  n51 --> n79
  n32 --> n79
  n32 --> n77
  n12 --> n78
  n29 --> n78
  n35 --> n78
  classDef complete fill:#00e5cc,color:#000
  classDef draft fill:#888,color:#fff
  classDef in_progress fill:#ffaa00,color:#000
  classDef deprecated fill:#555,color:#aaa
```

## Source File Overlap

Files referenced by 2 or more docs:

- `packages/core/src/commands/build.ts` - 32-cli-complete, 34-ai-consumer-mode, 36-ai-context-budget, 39-ai-format
- `packages/core/src/commands/init.ts` - 31-hook, 32-cli-complete, 77-claude-native
- `packages/core/src/commands/render.ts` - 04-cli-core, 34-ai-consumer-mode, 36-ai-context-budget, 39-ai-format, 75-engine-bug-fixes
- `packages/core/src/commands/strip.ts` - 29-stripper, 32-cli-complete
- `packages/engine/src/__tests__/conditions.test.ts` - 47-skill-context-variables, 50-match-operator
- `packages/engine/src/cache.ts` - 03-engine, 28-caching
- `packages/engine/src/conditions.ts` - 03-engine, 06-lang-interpolation, 12-lang-conditionals, 34-ai-consumer-mode, 47-skill-context-variables, 50-match-operator, 75-engine-bug-fixes
- `packages/engine/src/context.ts` - 03-engine, 07-lang-env, 17-lang-connect, 47-skill-context-variables
- `packages/engine/src/db/adapters/mongodb.ts` - 65-db-aggregate-operation, 69-db-adapter-interface, 70-db-mongodb-adapter
- `packages/engine/src/db/adapters/mssql.ts` - 69-db-adapter-interface, 71-db-sql-adapters
- `packages/engine/src/db/adapters/mysql.ts` - 69-db-adapter-interface, 71-db-sql-adapters
- `packages/engine/src/db/adapters/postgres.ts` - 65-db-aggregate-operation, 69-db-adapter-interface, 71-db-sql-adapters
- `packages/engine/src/db/adapters/sqlite.ts` - 69-db-adapter-interface, 71-db-sql-adapters
- `packages/engine/src/db/executor.ts` - 66-db-raw-escape-hatch, 68-db-executor, 72-db-security, 73-db-caching, 74-db-error-handling
- `packages/engine/src/db/query.ts` - 63-db-query-language, 64-db-where-clause, 65-db-aggregate-operation, 67-db-queryplan-types, 68-db-executor, 74-db-error-handling
- `packages/engine/src/engine.ts` - 03-engine, 09-lang-file-resolution, 10-lang-include, 11-lang-import, 14-lang-sources-list, 15-lang-sources-read, 16-lang-sources-utilities, 18-lang-sources-db, 19-lang-sources-http, 21-lang-phases, 47-skill-context-variables, 48-shell-inline, 49-stdlib, 75-engine-bug-fixes, 78-lang-note
- `packages/engine/src/macros.ts` - 03-engine, 08-lang-macros
- `packages/engine/src/pipe.ts` - 03-engine, 13-lang-pipeline
- `packages/engine/src/shell.ts` - 03-engine, 20-lang-sources-query
- `packages/engine/src/stripper.ts` - 29-stripper, 78-lang-note
- `packages/mcp/src/server.ts` - 30-mcp-server, 39-ai-format, 47-skill-context-variables
- `packages/mcp/src/tools/read_file.ts` - 30-mcp-server, 47-skill-context-variables
- `packages/parser/src/directives/call.ts` - 01-parser, 08-lang-macros
- `packages/parser/src/directives/connect.ts` - 01-parser, 17-lang-connect
- `packages/parser/src/directives/count.ts` - 01-parser, 16-lang-sources-utilities
- `packages/parser/src/directives/date.ts` - 01-parser, 16-lang-sources-utilities
- `packages/parser/src/directives/db.ts` - 01-parser, 18-lang-sources-db, 63-db-query-language
- `packages/parser/src/directives/define.ts` - 01-parser, 08-lang-macros
- `packages/parser/src/directives/env.ts` - 01-parser, 07-lang-env
- `packages/parser/src/directives/graph.ts` - 01-parser, 21-lang-phases
- `packages/parser/src/directives/header.ts` - 01-parser, 05-lang-header
- `packages/parser/src/directives/http.ts` - 01-parser, 19-lang-sources-http
- `packages/parser/src/directives/if.ts` - 01-parser, 12-lang-conditionals
- `packages/parser/src/directives/import.ts` - 01-parser, 11-lang-import
- `packages/parser/src/directives/include.ts` - 01-parser, 10-lang-include
- `packages/parser/src/directives/list.ts` - 01-parser, 14-lang-sources-list
- `packages/parser/src/directives/phase.ts` - 01-parser, 21-lang-phases
- `packages/parser/src/directives/pipe.ts` - 01-parser, 13-lang-pipeline
- `packages/parser/src/directives/query.ts` - 01-parser, 20-lang-sources-query
- `packages/parser/src/directives/read.ts` - 01-parser, 15-lang-sources-read
- `packages/parser/src/directives/render.ts` - 01-parser, 13-lang-pipeline
- `packages/parser/src/directives/tree.ts` - 01-parser, 16-lang-sources-utilities
- `packages/parser/src/interpolation.ts` - 06-lang-interpolation, 48-shell-inline
- `packages/parser/src/parser.ts` - 01-parser, 48-shell-inline
- `packages/parser/src/registry.ts` - 01-parser, 78-lang-note
- `packages/parser/src/types.ts` - 01-parser, 78-lang-note
- `packages/renderer/src/renderer.ts` - 02-renderer, 13-lang-pipeline
- `packages/vscode/package.json` - 51-package-scaffold, 52-language-definition, 53-syntax-highlighting, 54-snippets, 79-vscode-preview
- `packages/vscode/src/extension.ts` - 51-package-scaffold, 52-language-definition, 55-completion-provider, 79-vscode-preview

## Warnings

None
