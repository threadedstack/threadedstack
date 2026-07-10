/**
 * The generic effect surface (generalization ②). An "action" is "invoke Function
 * `function` with `args`". Agents emit actions two ways — a deferred
 * ```tdsk-actions``` block and a live `invoke` tool — both dispatched through one
 * core to a consumer-defined Function.
 */

/** A single effect: invoke a project-scoped Function by name with args. */
export type TAgentAction = {
  /** Name of the project-scoped Function to invoke. */
  function: string
  /** Arguments passed to the Function as its `context.args`. */
  args: Record<string, unknown>
}

/**
 * Opt-in effect-surface config carried on a schedule (and agent defaults). The
 * allowlist is the set of Function names the effect surface may invoke; an
 * empty/absent config disables the surface for that schedule (keeps it inert).
 */
export type TActionsConfig = {
  /** Names of project-scoped Functions the effect surface may invoke. */
  functions: string[]
  /**
   * Endpoint refs (id or name) that Functions invoked by this surface may reach
   * via `context.connect`. Fail-closed: absent/empty means NO external reach.
   * Authoring a Function does NOT confer access to any project endpoint — the
   * grant is explicit and lives here, alongside the Function allowlist.
   */
  connectEndpoints?: string[]
}
