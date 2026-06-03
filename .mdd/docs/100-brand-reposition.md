---
id: 100-brand-reposition
title: Brand Reposition - MarkdownAI as AI Workflow Engine
edition: MarkdownAI
depends_on: []
relates: [77-claude-native]
source_files:
  - docs/index.html
  - docs/user-guide.html
  - docs/llms.txt
  - docs/robots.txt
  - nginx.conf
  - README.md
  - packages/core/README.md
  - packages/engine/README.md
  - packages/markdownai/README.md
  - packages/mcp/README.md
  - packages/parser/README.md
  - packages/renderer/README.md
  - packages/vscode/README.md
  - docs/sitemap.xml
routes: []
models: []
test_files: []
data_flow: greenfield
last_synced: 2026-06-02
status: complete
phase: all
mdd_version: 11
tags: [seo, positioning, ai-workflow-engine, llm-discovery, schema-markup, website, content]
path: Distribution/Website
integration_contracts: []
satisfies_contracts: []
security_read_sites: []
known_issues: []
sister_projects: []
---

# 100 - Brand Reposition: MarkdownAI as AI Workflow Engine

## Purpose

The markdownai.dev landing page still carries the old "documentation that cannot lie" tagline, while real-world usage, Reddit community descriptions, and Google's AI overviews consistently describe MarkdownAI as a workflow engine. This reposition aligns the site copy, metadata, structured data, and LLM discovery infrastructure with what the product actually is today -- a phase-aware AI workflow engine for Claude and AI agents.

## Architecture

Static HTML/CSS/JS site served from `docs/` via nginx. No build tool -- all changes are direct edits to HTML files. Deployment via Docker image `timcarterclausen/markdownai_website:latest`, triggered by Dokploy webhook.

Changes span ten areas in one atomic delivery:

1. **Copy/positioning** -- title, taglines, hero, section headings, meta tags throughout `docs/index.html` and `docs/user-guide.html`
2. **New content sections** -- "Why MarkdownAI" block and five keyword-targeted anchor sections in `docs/index.html`
3. **Schema markup** -- update existing SoftwareApplication JSON-LD, add FAQPage (7 Q&A pairs) and HowTo schemas
4. **Semantic HTML** -- skip-nav link, `aria-label` on nav, verify `<main>` wrapper, section `aria-labelledby` attributes
5. **E-E-A-T signals** -- author byline with structured markup, publication dates, external citation links
6. **LLM discovery** -- create `docs/llms.txt`, create `docs/robots.txt` allowing AI crawlers
7. **Cross-platform footer links** -- community nav in footer
8. **Chunk extractability** -- each H2/H3 section independently answerable without context from surrounding sections
9. **Nginx serving** -- add `text/plain` to `gzip_types` in `nginx.conf` so `llms.txt` and `robots.txt` are compressed; `try_files` already serves any file in the doc root so no extra location block is needed
10. **README updates** -- update root `README.md` and all `packages/*/README.md` to use "AI workflow engine" positioning; old tagline confirmed present in `README.md` and `packages/markdownai/README.md`; all packages updated for consistent framing
11. **Sitemap** -- create `docs/sitemap.xml` covering all public pages (`/`, `/user-guide.html`); reference it from `robots.txt` via `Sitemap:` directive; add `Sitemap: https://markdownai.dev/sitemap.xml` to the robots.txt footer

## Data Model

No database. Static files only.

## API Endpoints

None. Static site.

## Business Rules

**DO NOT change:**
- All directive reference tables (accurate and valuable)
- All code examples
- All CLI reference tables
- Security and architecture sections
- Package names, npm install commands, version numbers
- The Jinja comparison section body (only intro paragraph changes)
- Any test fixture files that reference "documentation that cannot lie" as expected output

**Tagline replacement rule:** Every instance of "documentation that cannot lie" in HTML files and READMEs must be replaced. Run `grep -r "documentation that cannot lie" docs/ README.md packages/` after changes to verify zero remaining instances (excluding any test fixture files).

**Sitemap rule:** `docs/sitemap.xml` must be valid XML with `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`. Include `<url>` entries for `/` and `/user-guide.html` with `<lastmod>` set to today's date and `<changefreq>monthly</changefreq>`. The `Sitemap:` directive in `robots.txt` must point to `https://markdownai.dev/sitemap.xml`. Verify with `curl -I http://localhost/sitemap.xml` returning `200 OK` with `Content-Type: application/xml` after Docker build.

**Nginx serving rule:** `llms.txt` and `robots.txt` are served by the existing `try_files $uri $uri/ =404` rule -- no extra location block needed. Add `text/plain` to `gzip_types` so these files get compressed. Verify by curling locally after Docker build: `curl -I http://localhost/llms.txt` must return `200 OK` with `Content-Type: text/plain`.

**Schema count target:** After changes, `document.querySelectorAll('script[type="application/ld+json"]').length` must equal 3.

**Anchor preservation rule:** When changing heading text, do not break existing anchor IDs that navigation links point to.

**Single H1 rule:** The page must have exactly one H1 after changes.

## Data Flow

Greenfield -- no existing code data flows analyzed. This is content-only work.

## Dependencies

None. No other features depend on or are depended on by this doc.

## Security

No security concerns. Static HTML content changes only. No user input, no external calls, no data storage.

## Known Issues

(none yet)

## Bugs

(none yet -- populated by /mdd bug when issues are reported)
