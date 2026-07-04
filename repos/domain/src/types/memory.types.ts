/**
 * Memory type definitions for the agent memory system.
 * Memories are durable, org/agent-scoped records retrieved via scored search
 * (recency x importance x relevance) and injected into agent context.
 */

/**
 * Kinds of memory records stored in the memories table.
 */
export enum EMemoryKind {
  fact = `fact`, // Discrete, durable knowledge
  insight = `insight`, // Distilled learning from reflection cycles
  reflection = `reflection`, // Raw reflection output
  compaction = `compaction`, // Persisted context-compaction summary
  roadmap = `roadmap`, // Self-directed goal state (latest row wins)
}

export type TMemoryKind = `${EMemoryKind}`

/**
 * Memory record — stored in DB, scoped to an org + agent.
 */
export type TMemory = {
  id: string
  text: string
  orgId: string
  agentId: string
  kind: TMemoryKind
  importance: number
  createdAt?: string | Date
  updatedAt?: string | Date
  embedding: number[] | null
  lastAccessedAt: string | Date
  meta: Record<string, any> | null
}

/**
 * Options for scored memory retrieval.
 * queryEmbedding enables vector relevance; query alone runs lexical full-text.
 */
export type TMemorySearchOpts = {
  orgId: string
  query?: string
  limit?: number
  agentId: string
  kinds?: TMemoryKind[]
  queryEmbedding?: number[]
}

/**
 * Input for writing a new memory (id/org/agent resolved by the caller).
 */
export type TMemoryWriteInput = {
  text: string
  importance?: number
  kind?: TMemoryKind
  meta?: Record<string, any>
}
