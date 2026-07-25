import { isObj } from '@keg-hub/jsutils/isObj'

/** What every match is replaced with. Non-reversible: the bytes are gone. */
const RedactedMarker = `[redacted]`

/**
 * Credential SHAPES, redacted from free-text bodies before they leave the API.
 *
 * Ordered loosest-anchor-last so a prefixed key is matched by its own rule
 * before the generic bearer rule can claim it. Every alternative demands a
 * minimum length so ordinary prose (`sk-`, a bare `xoxb-`) is left alone.
 *
 * Every prefix is `\b`-anchored, which is load-bearing rather than tidiness:
 * without it `sk-` matches inside ordinary agent prose like `task-management`
 * or `disk-usage` and the endpoint silently eats real telemetry.
 */
const SecretPattern = new RegExp(
  [
    // Threaded Stack API keys, minted by `/_/api-keys`.
    `\\btdsk_[A-Za-z0-9_-]{8,}`,
    // OpenAI-style keys; Anthropic's `sk-ant-...` shares the same `sk-` prefix.
    `\\bsk-[A-Za-z0-9_-]{8,}`,
    // GitHub personal access tokens, classic then fine-grained.
    `\\bghp_[A-Za-z0-9]{16,}`,
    `\\bgithub_pat_[A-Za-z0-9_]{20,}`,
    // AWS access key id — the prefix is always followed by 16 uppercase alnums.
    `\\bAKIA[0-9A-Z]{16}`,
    // Slack bot/app/user/refresh tokens.
    `\\bxox[baprs]-[A-Za-z0-9-]{8,}`,
    // Any bearer credential. The label is CAPTURED and put back by the replacer
    // rather than skipped with a `(?<=[Bb]earer\s+)` lookbehind: a variable-length
    // lookbehind is re-evaluated backwards at every position, which is quadratic
    // on a long whitespace run. Measured on this exact pattern, a 20k-space
    // string — precisely the cap `appendTranscript` tail-caps turns to — cost
    // 646ms, so a single 100-row page could stall the event loop for a minute.
    // The forward match only engages where the literal label appears.
    `([Bb]earer\\s+)[A-Za-z0-9._~+/-]{8,}=*`,
  ].join(`|`),
  `g`
)

/**
 * Keep the `Bearer ` label and drop only the token, so telemetry still shows
 * that a call was authenticated without showing what with. Every other
 * alternative captures nothing and is replaced whole.
 */
const replaceSecret = (_match: string, bearerLabel?: string) =>
  bearerLabel ? `${bearerLabel}${RedactedMarker}` : RedactedMarker

/**
 * Strip secret-shaped substrings out of a JSON document, returning a COPY.
 *
 * DEFENSE IN DEPTH, NOT A GUARANTEE. This matches known credential shapes only,
 * so a novel, rotated-format, or org-specific secret still passes through
 * untouched. It is not a substitute for keeping credentials out of the document
 * in the first place; it narrows an accident, it does not close the class.
 *
 * It exists because the autonomous agents whose telemetry the activity
 * endpoints expose demonstrably handle credentials — they author secrets, drive
 * external connectors, and run `claude -p` under a token — so a credential that
 * lands in a turn's `input`/`output` or a message `body` would otherwise be
 * readable by every project member with read access.
 *
 * The logger's `safeReplacer` is deliberately NOT reused here. It redacts by
 * KEY NAME and blanks any string that merely CONTAINS `token`/`auth`/`secret`,
 * which is correct for a log line but would erase the very telemetry these
 * endpoints exist to serve, and it covers none of the prefixes above.
 *
 * The input is always a Postgres `jsonb` document, so the walk only has to
 * handle JSON values: objects, arrays, strings, and other primitives. The
 * source object is never written to — the record instances come from the DB
 * layer and are shared, so redacting in place would corrupt them for every
 * later reader in the same process.
 */
export const redactSecrets = <T>(value: T): T => {
  if (typeof value === `string`)
    return value.replace(SecretPattern, replaceSecret) as unknown as T

  if (Array.isArray(value)) return value.map(redactSecrets) as unknown as T

  if (!isObj(value)) return value

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, val]) => [
      key,
      redactSecrets(val),
    ])
  ) as unknown as T
}
