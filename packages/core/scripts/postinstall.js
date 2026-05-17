#!/usr/bin/env node
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { homedir } from 'node:os';
import { createInterface } from 'node:readline';

const SECTION_START_MARKER = '<!-- markdownai-claude-integration -->';

const SECTION_CONTENT = `<!-- markdownai-claude-integration -->

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

### Reading MarkdownAI documents

When you open a .md file that starts with \`@markdownai\`:

- If \`@markdownai/mcp\` is configured in your MCP settings - reads are handled automatically. The MCP server renders directives and returns live output. No extra steps needed.
- If only the \`mai\` CLI is installed - run \`mai render <file>\` via the Bash tool before reading it. The raw file contains directive syntax, not rendered output.

For automatic read integration, add \`@markdownai/mcp\` to your Claude Code MCP configuration.

Do not convert existing .md files that are not already MarkdownAI documents.

<!-- /markdownai-claude-integration -->`;

const claudeMdPath = join(homedir(), '.claude', 'CLAUDE.md');

if (existsSync(claudeMdPath)) {
  const existing = readFileSync(claudeMdPath, 'utf8');
  if (existing.includes(SECTION_START_MARKER)) {
    process.exit(0);
  }
}

if (!process.stdin.isTTY) {
  console.log('Run `mai init --global-claude-md` to add MarkdownAI instructions to your Claude profile.');
  process.exit(0);
}

const rl = createInterface({ input: process.stdin, output: process.stdout });

rl.question('Add MarkdownAI instructions to ~/.claude/CLAUDE.md? (y/N) ', (answer) => {
  rl.close();
  if (answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes') {
    mkdirSync(dirname(claudeMdPath), { recursive: true });
    if (existsSync(claudeMdPath)) {
      const current = readFileSync(claudeMdPath, 'utf8');
      writeFileSync(claudeMdPath, current + '\n\n' + SECTION_CONTENT + '\n', 'utf8');
    } else {
      writeFileSync(claudeMdPath, SECTION_CONTENT + '\n', 'utf8');
    }
    console.log('✓ MarkdownAI instructions added to ~/.claude/CLAUDE.md');
  }
  process.exit(0);
});
