# MarkdownAI Change Log

Running log of all changes on this branch. Every change appends an entry. After publishing,
this file feeds README, user guide, and website updates so docs stay accurate.

Format per entry:
- **Date** | **Category** | **Title**
- Summary
- Files touched
- Migration notes (if breaking)
- Linked issue/PR

Categories: `feature`, `bug-fix`, `breaking`, `security`, `docs`, `internal`.

---

## 2026-05-23 | branch start

Branch `feat/mdd-integration-fixes` created off main. Goal: address issues discovered while
integrating MarkdownAI into MDD (`~/projects/mdd2`). See
`~/projects/mdd2/markdownai-comments.md` for the full issue list that motivated this branch.

Target version: **v2.0.0** (breaking changes expected; we are still in early days so a clean
major bump is preferred over backward-compat shims).

Scope (Tier 1):
1. Source vs data root split — `@import`/`@include` resolve relative to document; `@list`,
   `@read`, `@tree`, `file.exists/isFile/isDir` resolve relative to a separate data root
   (default: cwd).
2. `{{ }}` interpolation inside `@query` strings, with auto shell-escaping.
3. Absolute paths in `@import`/`@include` allowed if matching configured patterns.
4. `||` operator in `@if`/`@elseif`/`@else` lines (parser fix).
5. `mai render --skill-args "..."` and related skill-context flags.
6. New file-write directives: `@copy`, `@mkdir`, `@append-if-missing`.
7. Security config additions for write directives + source/data root configuration.

Scope (Tier 2, if time):
- `{{ read ... }}` inline form parity with documented behavior.
- `mai validate` auto-loads stdlib.
- `*.json` SECURITY_ALERT suppression on non-credential reads.

---

(entries below this line as fixes land)
