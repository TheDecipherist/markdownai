// Cross-resolve_phase state for a single MarkdownAI flow.
//
// A flow is one user-initiated walk of a MarkdownAI document — entry phase
// through to terminal. Between phase renders, the document's `@set` values
// must persist so a value bound in Phase A is visible in Phase B without
// each phase re-deriving everything from skill_args.
//
// Scope: per (Claude session × document). Switching documents inside the
// same Claude session starts a fresh scope — build.md and audit.md don't
// share state. Re-entering the same document after its previous flow
// terminated (next_phase → null cleared the entry) also gets fresh state.
//
// The MCP loads session state (data + envFiles) into the engine ctx before
// execute(), then captures the post-execute state back into the session.
// When sessionId is empty (no Claude session), persistence is disabled —
// each call is fresh.
//
// Sessions expire after TTL_MS of inactivity. `clearSession` is called
// when a flow reaches a terminal phase (next_phase returns null) so scope
// releases cleanly without waiting for TTL.

export interface SessionState {
  data: Record<string, unknown>
  envFiles: Record<string, string>
  lastTouched: number
}

const sessions = new Map<string, SessionState>()
const TTL_MS = 60 * 60 * 1000

function key(sessionId: string, filePath: string): string {
  return `${sessionId}::${filePath}`
}

function gcExpired(): void {
  const now = Date.now()
  for (const [id, s] of sessions) {
    if (now - s.lastTouched > TTL_MS) sessions.delete(id)
  }
}

export function loadSession(sessionId: string, filePath: string): SessionState | null {
  if (!sessionId) return null
  gcExpired()
  const s = sessions.get(key(sessionId, filePath))
  return s ?? null
}

export function saveSession(
  sessionId: string,
  filePath: string,
  data: Record<string, unknown>,
  envFiles: Record<string, string>,
): void {
  if (!sessionId) return
  sessions.set(key(sessionId, filePath), { data, envFiles, lastTouched: Date.now() })
}

export function clearSession(sessionId: string, filePath: string): void {
  if (!sessionId) return
  sessions.delete(key(sessionId, filePath))
}

/** Test-only: drop all sessions. */
export function resetSessions(): void {
  sessions.clear()
}
