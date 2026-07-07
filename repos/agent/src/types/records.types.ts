import type { TRecordQuery } from '@tdsk/domain'

/**
 * A record document surfaced to the agent — the record id plus its JSON `data`.
 */
export type TRecordDoc = {
  id: string
  data: Record<string, unknown>
}

/**
 * Injected records provider for the api-brain agent.
 * Mirrors the IMemoryProvider pattern: the agent package declares the capability
 * contract, the backend implements it (collection/record db service scoped to the
 * agent's project) and injects an instance through the AgentRunner init opts.
 * Backed by one project-scoped collection store, so every method takes a
 * collection name (unique within the project) plus the operation payload.
 */
export interface IRecordsProvider {
  query(collection: string, query: TRecordQuery): Promise<TRecordDoc[]>
  get(collection: string, id: string): Promise<TRecordDoc | null>
  upsert(
    collection: string,
    record: { id?: string; data: Record<string, unknown> }
  ): Promise<{ id: string }>
  delete(collection: string, id: string): Promise<{ deleted: boolean }>
}
