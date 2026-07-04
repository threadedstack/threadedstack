import type { TKubeSandboxConfig, TSandboxRuntimeId } from '@tdsk/domain'

import { ESandboxRuntime, SandboxRuntimeConfigs } from '@tdsk/domain'

/**
 * Per-runtime shell env assignments that force a one-shot CLI to run every
 * command in the FOREGROUND.
 *
 * A `prompt`-mode schedule runs the runtime once in a disposable pod that is
 * destroyed the instant the process exits. Claude Code's harness otherwise
 * auto-backgrounds long-running shell commands (e.g. `pnpm install`) and defers
 * to a Monitor / scheduled-wakeup resume that can never fire here — so the turn
 * ends "waiting for a signal", the pod dies, and every downstream commit / push
 * / PR is silently lost. `CLAUDE_CODE_DISABLE_BACKGROUND_TASKS=1` is Claude
 * Code's documented switch that disables `run_in_background`, the Monitor tool's
 * background mode, and auto-backgrounding, forcing synchronous execution within
 * the single turn. Only the one-shot schedule path uses this; interactive
 * sessions can resume, so they keep backgrounding.
 */
const RuntimeForegroundEnv: Partial<Record<TSandboxRuntimeId, Record<string, string>>> = {
  [ESandboxRuntime.claudeCode]: { CLAUDE_CODE_DISABLE_BACKGROUND_TASKS: `1` },
}

/**
 * Shell env-assignment prefix (e.g. `CLAUDE_CODE_DISABLE_BACKGROUND_TASKS=1`)
 * that forces a runtime's one-shot CLI to execute every command synchronously,
 * or an empty string when the runtime needs no such guard. The values are fixed
 * literals (no user input), so they need no shell escaping.
 */
export function foregroundEnvPrefix(runtime?: string): string {
  const env = RuntimeForegroundEnv[runtime as TSandboxRuntimeId]
  if (!env) return ``
  return Object.entries(env)
    .map(([key, value]) => `${key}=${value}`)
    .join(` `)
}

/** Escape single quotes so text can be embedded in a single-quoted shell argument. */
export function escapePromptArg(text: string): string {
  return text.replace(/'/g, `'\\''`)
}

/**
 * Single-pass placeholder substitution for prompt command templates.
 * A function replacer is immune to `$&`/`` $` ``-style replacement patterns
 * in the substituted text (souls, prompts, and previous reports are arbitrary
 * text — prior LLM output realistically contains `$` sequences, and shell
 * escaping itself produces `'\''` adjacent to `$`). A single pass also cannot
 * re-match placeholder text introduced by an earlier substitution (e.g. a soul
 * containing the literal text `{prompt}` must never consume the template's
 * real `{prompt}` placeholder). Placeholders without a provided value are
 * left untouched.
 */
export function substitutePlaceholders(
  template: string,
  values: Partial<Record<`prompt` | `soul`, string>>
): string {
  return template.replace(/\{(prompt|soul)\}/g, (match, key: `prompt` | `soul`) => {
    const value = values[key]
    return value === undefined ? match : value
  })
}

/**
 * Resolve the prompt command template for a sandbox config,
 * validating that a template exists and carries the {prompt} placeholder.
 */
export function resolvePromptTemplate(sandboxConfig: TKubeSandboxConfig): string {
  const template =
    sandboxConfig.promptCommand ||
    SandboxRuntimeConfigs[sandboxConfig.runtime as TSandboxRuntimeId]?.promptCommand

  if (!template)
    throw new Error(`No prompt command template for runtime "${sandboxConfig.runtime}"`)

  if (!template.includes(`{prompt}`))
    throw new Error(
      `Prompt command template for runtime "${sandboxConfig.runtime}" is missing {prompt} placeholder`
    )

  // escapePromptArg escapes single quotes ONLY, so the substitution contract
  // requires every placeholder to sit inside a single-quoted argument. A
  // custom template like `claude -p "{prompt}"` or a bare `{prompt}` would
  // silently let shell metacharacters through — fail closed instead.
  const bare = template.replace(/'\{(prompt|soul)\}'/g, ``)
  if (/\{(prompt|soul)\}/.test(bare))
    throw new Error(
      `Prompt command template for runtime "${sandboxConfig.runtime}" must wrap {prompt}/{soul} in single quotes`
    )

  return template
}
