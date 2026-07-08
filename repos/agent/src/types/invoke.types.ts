/**
 * Injected invoke provider for the api-brain agent (generalization ②).
 * Mirrors the IRecordsProvider pattern: the agent package declares the capability
 * contract, the backend implements it (bridged to the effect core `invokeAction`)
 * and injects an instance through the AgentRunner init opts. `invoke` runs a
 * project-scoped, allowlisted Function by name and returns its result — the same
 * dispatch core the deferred `tdsk-actions` block routes through.
 */
export interface IInvokeProvider {
  invoke(
    functionName: string,
    args: Record<string, unknown>
  ): Promise<{ ok: boolean; data?: unknown; error?: string }>
}
