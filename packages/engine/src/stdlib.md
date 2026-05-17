@markdownai

<!-- MarkdownAI Standard Library v1.0                                             -->
<!-- Auto-loaded into every @markdownai document — no @import needed              -->
<!-- User-defined macros with the same name override these                         -->
<!--                                                                               -->
<!-- Each macro stores its result in a labeled context variable.                   -->
<!-- Access results with {{ variable_name }} in text or @if conditions.            -->
<!--                                                                               -->
<!-- Parameterized macros: @call macro-name(param=value)                          -->
<!--   or space-separated:  @call macro-name param=value                          -->

## Git Operations

The most frequently used category. These give Claude a snapshot of repository
state in one call rather than constructing the same git commands from scratch
each session.

<!-- git-status → git_status                                                      -->
<!-- Compact view: M=modified, A=added, D=deleted, ??=untracked, R=renamed.      -->
<!-- Produces far less output than 'git status' (no headers, no suggestions).     -->
<!-- Usage:  @call git-status  →  {{ git_status }}                               -->
@define git-status
@query git status --short label=git_status
@end

<!-- git-branch → current_branch                                                  -->
<!-- Name of the currently checked-out branch.                                    -->
<!-- Usage:  @call git-branch  →  {{ current_branch }}                           -->
@define git-branch
@query git branch --show-current label=current_branch
@end

<!-- git-log → git_log                                                            -->
<!-- Last 10 commits in hash + message format. Enough context, minimal tokens.   -->
<!-- Usage:  @call git-log  →  {{ git_log }}                                     -->
@define git-log
@query bash -c "git --no-pager log --oneline -10 2>/dev/null || echo '(no commits)'" label=git_log
@end

<!-- git-diff-stat → diff_stat                                                    -->
<!-- File-level summary of all staged and unstaged changes. Shows only names     -->
<!-- and +/- counts — no line-by-line diff content.                              -->
<!-- Usage:  @call git-diff-stat  →  {{ diff_stat }}                             -->
@define git-diff-stat
@query bash -c "git --no-pager diff --stat HEAD 2>/dev/null || echo '(no changes)'" label=diff_stat
@end

<!-- git-staged → staged_files                                                    -->
<!-- Files in the staging area (added with git add).                             -->
<!-- Usage:  @call git-staged  →  {{ staged_files }}                             -->
@define git-staged
@query bash -c "git diff --name-only --cached 2>/dev/null" label=staged_files
@end

<!-- git-modified → modified_files                                                -->
<!-- Tracked files that have been edited but not yet staged.                     -->
<!-- Usage:  @call git-modified  →  {{ modified_files }}                         -->
@define git-modified
@query bash -c "git diff --name-only 2>/dev/null" label=modified_files
@end

<!-- git-untracked → untracked_files                                              -->
<!-- New files not yet tracked by git (git ls-files respects .gitignore).        -->
<!-- Usage:  @call git-untracked  →  {{ untracked_files }}                       -->
@define git-untracked
@query bash -c "git ls-files --others --exclude-standard 2>/dev/null" label=untracked_files
@end

<!-- git-ahead → commits_ahead                                                    -->
<!-- How many commits this branch has beyond the tracked remote branch.          -->
<!-- Falls back to origin/main then origin/master if no tracking branch set.    -->
<!-- Usage:  @call git-ahead  →  {{ commits_ahead }}                             -->
@define git-ahead
@query bash -c "git rev-list --count HEAD ^$(git rev-parse --abbrev-ref @{upstream} 2>/dev/null || echo origin/main) 2>/dev/null || git rev-list --count HEAD ^origin/master 2>/dev/null || echo 0" label=commits_ahead
@end

<!-- git-last-commit → last_commit                                                -->
<!-- Short hash and subject line of the most recent commit.                      -->
<!-- Usage:  @call git-last-commit  →  {{ last_commit }}                         -->
@define git-last-commit
@query bash -c "git log -1 --format='%h %s' 2>/dev/null || echo '(no commits)'" label=last_commit
@end

## Filesystem Operations

Filesystem macros let Claude inspect project layout without re-deriving
find/ls incantations each session.

<!-- fs-ls → dir_listing                                                          -->
<!-- Contents of the current directory with permissions, sizes, and dates.       -->
<!-- Usage:  @call fs-ls  →  {{ dir_listing }}                                   -->
@define fs-ls
@query bash -c "ls -la 2>/dev/null" label=dir_listing
@end

<!-- fs-find(pattern) → found_files                                               -->
<!-- Files matching a glob pattern, excluding node_modules and .git.             -->
<!-- Output is capped at 100 lines to avoid flooding context.                    -->
<!-- Usage:  @call fs-find pattern=*.ts  →  {{ found_files }}                   -->
@define fs-find(pattern)
@query bash -c "find . -name '{{ pattern }}' -not -path '*/node_modules/*' -not -path '*/.git/*' 2>/dev/null | head -100" label=found_files
@end

<!-- fs-large-files → large_files                                                 -->
<!-- Source files exceeding 300 lines, sorted by size descending.               -->
<!-- Covers TypeScript, JavaScript, Python, Go, and Rust.                        -->
<!-- Usage:  @call fs-large-files  →  {{ large_files }}                          -->
@define fs-large-files
@query bash -c "find . -type f \( -name '*.ts' -o -name '*.js' -o -name '*.py' -o -name '*.go' -o -name '*.rs' \) -not -path '*/node_modules/*' -not -path '*/dist/*' -not -path '*/.git/*' -exec wc -l {} \; 2>/dev/null | awk '\$1>300' | sort -rn | head -20" label=large_files
@end

<!-- fs-recent → recent_files                                                     -->
<!-- Files modified in the last 7 days, excluding noise directories.             -->
<!-- Usage:  @call fs-recent  →  {{ recent_files }}                              -->
@define fs-recent
@query bash -c "find . -type f -mtime -7 -not -path '*/node_modules/*' -not -path '*/.git/*' -not -path '*/dist/*' -not -path '*/__pycache__/*' 2>/dev/null | head -50" label=recent_files
@end

<!-- fs-tree → dir_tree                                                           -->
<!-- Directory structure 2 levels deep, excluding common noise directories.     -->
<!-- Usage:  @call fs-tree  →  {{ dir_tree }}                                    -->
@define fs-tree
@query bash -c "find . -maxdepth 2 -not -path '*/node_modules*' -not -path '*/.git*' -not -path '*/dist*' -not -path '*/__pycache__*' -not -path '*/target*' | sort | sed 's|[^/]*/|  |g' | head -80" label=dir_tree
@end

<!-- fs-count(ext) → file_count                                                   -->
<!-- Number of files with a given extension, excluding node_modules and .git.   -->
<!-- Usage:  @call fs-count ext=ts  →  {{ file_count }}                          -->
@define fs-count(ext)
@query bash -c "find . -name '*.{{ ext }}' -not -path '*/node_modules/*' -not -path '*/.git/*' 2>/dev/null | wc -l | tr -d ' '" label=file_count
@end

<!-- fs-size → dir_sizes                                                          -->
<!-- Disk usage of common build output and source directories.                   -->
<!-- Usage:  @call fs-size  →  {{ dir_sizes }}                                   -->
@define fs-size
@query bash -c "du -sh src dist build out .next .nuxt target 2>/dev/null" label=dir_sizes
@end

## Project Detection

Project detection macros help Claude understand the tech stack in one pass
at the start of a session, rather than reading through config files manually.

<!-- project-manager → pkg_manager                                                -->
<!-- Package manager detected from lock files: npm, pnpm, yarn, bun,            -->
<!-- cargo, go, or pip.                                                           -->
<!-- Usage:  @call project-manager  →  {{ pkg_manager }}                         -->
@define project-manager
@query bash -c "if [ -f pnpm-lock.yaml ]; then echo pnpm; elif [ -f bun.lockb ]; then echo bun; elif [ -f yarn.lock ]; then echo yarn; elif [ -f package-lock.json ]; then echo npm; elif [ -f Cargo.toml ]; then echo cargo; elif [ -f go.mod ]; then echo go; elif [ -f Pipfile ] || [ -f pyproject.toml ] || [ -f requirements.txt ]; then echo pip; else echo unknown; fi" label=pkg_manager
@end

<!-- project-language → main_language                                             -->
<!-- Primary language detected from tsconfig.json, Cargo.toml, go.mod, etc.    -->
<!-- Usage:  @call project-language  →  {{ main_language }}                      -->
@define project-language
@query bash -c "if [ -f tsconfig.json ]; then echo TypeScript; elif [ -f Cargo.toml ]; then echo Rust; elif [ -f go.mod ]; then echo Go; elif [ -f pyproject.toml ] || [ -f setup.py ] || [ -f requirements.txt ]; then echo Python; elif ls *.js src/*.js 2>/dev/null | head -1 | grep -q .; then echo JavaScript; else echo unknown; fi" label=main_language
@end

<!-- project-name → project_name                                                  -->
<!-- Project name from package.json, Cargo.toml, go.mod, or the directory name. -->
<!-- Usage:  @call project-name  →  {{ project_name }}                           -->
@define project-name
@query bash -c "node -e \"try{process.stdout.write(require('./package.json').name)}catch{}\" 2>/dev/null || grep '^name' Cargo.toml 2>/dev/null | head -1 | sed 's/.*= //;s/\"//g' | tr -d ' ' || grep '^module' go.mod 2>/dev/null | awk '{print \$2}' || basename \$(pwd)" label=project_name
@end

<!-- project-version → project_version                                            -->
<!-- Version string from package.json or Cargo.toml.                            -->
<!-- Usage:  @call project-version  →  {{ project_version }}                     -->
@define project-version
@query bash -c "node -e \"try{process.stdout.write(require('./package.json').version)}catch{}\" 2>/dev/null || grep '^version' Cargo.toml 2>/dev/null | head -1 | sed 's/.*= //;s/\"//g' | tr -d ' ' || echo unknown" label=project_version
@end

<!-- project-test-cmd → test_cmd                                                  -->
<!-- The command to run tests, detected from package.json scripts, pytest,       -->
<!-- Cargo.toml, or go.mod.                                                       -->
<!-- Usage:  @call project-test-cmd  →  {{ test_cmd }}                           -->
@define project-test-cmd
@query bash -c "node -e \"try{const s=require('./package.json').scripts||{};const k=Object.keys(s).find(k=>k==='test'||k.startsWith('test:'));if(k)process.stdout.write('npm run '+k)}catch{}\" 2>/dev/null || ([ -f Cargo.toml ] && echo 'cargo test') || ([ -f go.mod ] && echo 'go test ./...') || ([ -f pytest.ini ] || [ -f pyproject.toml ] && echo pytest) || echo unknown" label=test_cmd
@end

## Code Analysis

Code analysis macros surface the most common quality signals — TODOs, type
safety gaps, console noise — without Claude constructing grep commands each time.

<!-- code-todos → todos                                                           -->
<!-- All TODO, FIXME, HACK, and XXX comments in source, with file:line.         -->
<!-- Capped at 30 results. Covers TypeScript, JavaScript, Python, Go, Rust.     -->
<!-- Usage:  @call code-todos  →  {{ todos }}                                    -->
@define code-todos
@query bash -c "grep -rn --include='*.ts' --include='*.js' --include='*.py' --include='*.go' --include='*.rs' 'TODO\|FIXME\|HACK\|XXX' . 2>/dev/null | grep -v node_modules | grep -v dist | head -30" label=todos
@end

<!-- code-console-logs → console_logs                                             -->
<!-- console.log calls in non-test source files. These should use a logger.     -->
<!-- Capped at 30 results.                                                        -->
<!-- Usage:  @call code-console-logs  →  {{ console_logs }}                      -->
@define code-console-logs
@query bash -c "grep -rn 'console\\.log' --include='*.ts' --include='*.js' . 2>/dev/null | grep -v node_modules | grep -v dist | grep -v '\\.test\\.' | grep -v '\\.spec\\.' | head -30" label=console_logs
@end

<!-- code-any-types → any_count                                                   -->
<!-- Count of TypeScript `any` usages. Includes `: any`, `as any`, `<any>`.    -->
<!-- Zero is the target in strict mode projects.                                 -->
<!-- Usage:  @call code-any-types  →  {{ any_count }}                            -->
@define code-any-types
@query bash -c "grep -r ': any\b\|as any\b\|<any>' --include='*.ts' . 2>/dev/null | grep -v node_modules | grep -v dist | grep -v '\\.d\\.ts' | wc -l | tr -d ' '" label=any_count
@end

<!-- code-test-files → test_files                                                 -->
<!-- All test and spec files found in the project.                               -->
<!-- Usage:  @call code-test-files  →  {{ test_files }}                          -->
@define code-test-files
@query bash -c "find . -type f \( -name '*.test.ts' -o -name '*.spec.ts' -o -name '*.test.js' -o -name '*.spec.js' -o -name 'test_*.py' -o -name '*_test.go' \) -not -path '*/node_modules/*' 2>/dev/null" label=test_files
@end

<!-- code-grep(pattern) → grep_results                                            -->
<!-- Search for a pattern across all source files, with file:line results.      -->
<!-- Output capped at 30 lines. Use for finding function definitions, usages,   -->
<!-- or any code pattern without constructing the grep command manually.         -->
<!-- Usage:  @call code-grep pattern="processPayment"  →  {{ grep_results }}    -->
@define code-grep(pattern)
@query bash -c "grep -rn '{{ pattern }}' --include='*.ts' --include='*.js' --include='*.py' --include='*.go' --include='*.rs' . 2>/dev/null | grep -v node_modules | grep -v dist | head -30" label=grep_results
@end

## Environment Checks

Environment macros answer the operational questions every session opens with:
what runtime, what OS, is the server already running.

<!-- env-node → node_version                                                      -->
<!-- Installed Node.js version string.                                           -->
<!-- Usage:  @call env-node  →  {{ node_version }}                               -->
@define env-node
@query bash -c "node --version 2>/dev/null || echo 'not installed'" label=node_version
@end

<!-- env-os → os_type                                                             -->
<!-- Operating system type: wsl, macos, linux, or windows.                      -->
<!-- Usage:  @call env-os  →  {{ os_type }}                                      -->
@define env-os
@query bash -c "if grep -qi microsoft /proc/version 2>/dev/null; then echo wsl; elif uname -s 2>/dev/null | grep -qi darwin; then echo macos; elif uname -s 2>/dev/null | grep -qi linux; then echo linux; else echo windows; fi" label=os_type
@end

<!-- env-port(port) → port_in_use                                                 -->
<!-- Whether a TCP port is currently bound. Returns 'true' or 'false'.          -->
<!-- Tries ss first, falls back to lsof.                                         -->
<!-- Usage:  @call env-port port=3000  →  {{ port_in_use }}                      -->
@define env-port(port)
@query bash -c "ss -ltn 2>/dev/null | grep -q ':{{ port }} ' && echo true || lsof -i :{{ port }} 2>/dev/null | grep -q LISTEN && echo true || echo false" label=port_in_use
@end

<!-- env-has(cmd) → cmd_available                                                 -->
<!-- Whether a CLI command is installed and on PATH. Returns 'true' or 'false'. -->
<!-- Usage:  @call env-has cmd=docker  →  {{ cmd_available }}                    -->
@define env-has(cmd)
@query bash -c "which {{ cmd }} >/dev/null 2>&1 && echo true || echo false" label=cmd_available
@end

<!-- env-ci → in_ci                                                               -->
<!-- Whether this is running inside a CI environment. Returns 'true' or 'false'.-->
<!-- Checks CI, GITHUB_ACTIONS, GITLAB_CI, CIRCLECI, and TRAVIS.               -->
<!-- Usage:  @call env-ci  →  {{ in_ci }}                                        -->
@define env-ci
@query bash -c "printenv CI GITHUB_ACTIONS GITLAB_CI CIRCLECI TRAVIS 2>/dev/null | grep -q . && echo true || echo false" label=in_ci
@end

<!-- env-git-author → git_author                                                  -->
<!-- Configured git user name and email for the current repo or global config.  -->
<!-- Usage:  @call env-git-author  →  {{ git_author }}                           -->
@define env-git-author
@query bash -c "git log -1 --format='%an <%ae>' 2>/dev/null || echo unknown" label=git_author
@end
