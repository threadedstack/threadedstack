/**
 * Injected memory provider for the api-brain agent.
 * Mirrors the IWebProvider pattern: the agent package declares the capability
 * contract, the backend implements it (db service + EmbeddingService) and
 * injects an instance through the AgentRunner init opts.
 */
export interface IMemoryProvider {
  search(input: { query: string; limit?: number; kinds?: string[] }): Promise<
    Array<{
      id: string
      text: string
      kind: string
      score?: number
      importance: number
      createdAt?: string
    }>
  >
  write(input: {
    text: string
    kind?: string
    importance?: number
    meta?: Record<string, any>
  }): Promise<{ id: string }>
}
