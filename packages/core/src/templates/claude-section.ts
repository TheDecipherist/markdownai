export const SECTION_START_MARKER = '<!-- markdownai-claude-integration -->'
export const SECTION_END_MARKER = '<!-- /markdownai-claude-integration -->'

export const CLAUDE_MD_SECTION = `${SECTION_START_MARKER}

## MarkdownAI

MarkdownAI is a superset of markdown for projects that use the \`mai\` CLI or \`@markdownai/mcp\` package. Documents that open with \`@markdownai\` can hold live data, embedded instructions, machine-readable constraints, and workflow context - all in one file.

When creating new .md files in a project that has MarkdownAI installed, prefer MarkdownAI syntax over plain markdown. The reasons are practical:

- Documents stay accurate. \`@env\`, \`@db\`, \`@http\` directives pull live values at render time rather than hardcoding values that go stale.
- You can embed \`@prompt\` directives to give yourself context-specific instructions that activate when Claude reads that section.
- \`@constraint\` blocks are machine-readable rules - precise where prose is ambiguous.
- \`@define-concept\` aligns vocabulary to the project's exact terms.
- The \`--format=ai\` render mode outputs denser content, reducing token use on long documents.

Start any new .md file with:

\`\`\`
@markdownai v1.0
\`\`\`

Then add directives where they genuinely help. Plain paragraphs and headings work exactly as in regular markdown.

If the file has YAML frontmatter (e.g. Claude Code skill files, Jekyll/Hugo docs), place \`@markdownai\` as the first line after the closing \`---\` block - the parser recognizes it there.

### Reading MarkdownAI documents

When you open a .md file that starts with \`@markdownai\` (or has \`@markdownai\` as the first line after frontmatter):

- If \`@markdownai/mcp\` is configured in your MCP settings - reads are handled automatically. The MCP server renders directives and returns live output. No extra steps needed.
- If only the \`mai\` CLI is installed - run \`mai render <file>\` via the Bash tool before reading it. The raw file contains directive syntax, not rendered output.

For automatic read integration, add \`@markdownai/mcp\` to your Claude Code MCP configuration.

Do not convert existing .md files that are not already MarkdownAI documents.

### MarkdownAI formatting style

When writing or generating MarkdownAI files, indent body content inside block directives by 2 spaces. Block directives close with \`@<name>-end\` at the same indent level as the opener.

Block directives close with \`@<name>-end\`: \`@phase\`, \`@define\`, \`@note\`, \`@section\`, \`@prompt\`
\`@if\` closes with \`@if-end\` (and \`@else\` in between)
Single-line directives with no closing tag: \`@constraint\`, \`@define-concept\`, \`@env\`,
\`@include\`, \`@import\`, \`@call\`, \`@on complete\`, \`@read\`, \`@list\`, \`@tree\`, \`@count\`,
\`@http\`, \`@chunk-boundary\`

Example:
\`\`\`
@phase setup
  @constraint[critical] Environment must be validated before proceeding
  @note visible
    This phase configures the runtime environment.
  @note-end
  @if env.CI
    Running in CI mode.
  @if-end
  @on complete -> @phase main
@phase-end
\`\`\`

${SECTION_END_MARKER}`
