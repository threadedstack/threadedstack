/**
 * THE claude CLI invocation contract — isolated here so a flag fix is a
 * one-line change (verified against the real in-pod CLI in R4).
 *
 * Reference: the steward sandbox's one-shot promptCommand is
 * `claude -p --dangerously-skip-permissions --append-system-prompt '{soul}' '{prompt}'`.
 * The resident replaces the shell template with a direct argv spawn (no shell,
 * no escaping) and adds session continuity:
 *
 *   first turn:  claude -p --output-format json --dangerously-skip-permissions <prompt>
 *   resumed:     claude -p --resume <sessionId> --output-format json --dangerously-skip-permissions <prompt>
 *
 * `--output-format json` makes the CLI print ONE JSON envelope on stdout:
 * `{ "type": "result", "result": "<assistant text>", "session_id": "<id>", "is_error": bool, ... }`
 * — `session_id` is how the runtime learns/keeps the session to `--resume`.
 * Seeding (soul + directives + checkpoint summary) rides the first turn's
 * prompt text instead of --append-system-prompt so it survives --resume
 * without re-passing flags every turn.
 */

/** The CLI binary (resolved from the pod PATH). */
export const ClaudeCliBin = `claude`

/**
 * Env applied to every claude child. The resident's turns must run every shell
 * command in the foreground — a backgrounded command's completion belongs to no
 * turn and its output is lost (same guard as the one-shot schedule executor).
 */
export const ClaudeCliEnv: Record<string, string> = {
  CLAUDE_CODE_DISABLE_BACKGROUND_TASKS: `1`,
}

/** Build the argv for one turn (prompt as a positional arg — no shell involved). */
export const buildTurnArgs = (prompt: string, resumeSessionId?: string): string[] => {
  const args = [`-p`]
  if (resumeSessionId) args.push(`--resume`, resumeSessionId)
  args.push(`--output-format`, `json`, `--dangerously-skip-permissions`, prompt)
  return args
}

export type TClaudeJsonOutput = {
  /** The assistant's result text (falls back to raw stdout when unparseable). */
  resultText: string
  sessionId?: string
  isError?: boolean
}

const tryParse = (text: string): Record<string, unknown> | undefined => {
  try {
    const parsed = JSON.parse(text)
    return parsed && typeof parsed === `object` && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : undefined
  } catch {
    return undefined
  }
}

/**
 * Parse the CLI's `--output-format json` envelope out of captured stdout.
 * Tolerates leading noise by falling back to the last non-empty line; a fully
 * unparseable stream degrades to the raw text (the pump still scans it).
 */
export const parseClaudeJsonOutput = (stdout: string): TClaudeJsonOutput => {
  const raw = stdout ?? ``
  const trimmed = raw.trim()
  if (!trimmed) return { resultText: `` }

  let envelope = tryParse(trimmed)
  if (!envelope) {
    const lines = trimmed.split(`\n`).filter((line) => line.trim().length)
    envelope = tryParse(lines[lines.length - 1] ?? ``)
  }
  if (!envelope) return { resultText: raw }

  return {
    resultText: typeof envelope.result === `string` ? envelope.result : raw,
    sessionId:
      typeof envelope.session_id === `string` && envelope.session_id.length
        ? envelope.session_id
        : undefined,
    isError: envelope.is_error === true,
  }
}
