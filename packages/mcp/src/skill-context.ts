// Shared skill-context builder used by read_file / resolve_phase / next_phase.
// Mirrors the Claude Code slash-command invocation: `skill_args` is the raw
// $ARGUMENTS string from the slash command; tokens are split on whitespace
// with quoted segments preserved, then exposed to expressions as `argsList`.

export interface SkillArgsInput {
  skillArgs?: string
  skillNamedArgs?: Record<string, string>
  skillSessionId?: string
  skillEffort?: string
  skillDir?: string
}

export interface BuiltSkillContext {
  args: string
  argsList: string[]
  namedArgs: Record<string, string>
  sessionId: string
  effort: string
  skillDir: string
}

export function buildSkillContext(input: SkillArgsInput): BuiltSkillContext {
  const raw = input.skillArgs ?? ''
  const argsList = raw.trim().length > 0
    ? [...raw.matchAll(/"([^"]*)"|'([^']*)'|(\S+)/g)].map(m => m[1] ?? m[2] ?? m[3] ?? '')
    : []
  return {
    args: raw,
    argsList,
    namedArgs: input.skillNamedArgs ?? {},
    sessionId: input.skillSessionId ?? '',
    effort: input.skillEffort ?? '',
    skillDir: input.skillDir ?? '',
  }
}
