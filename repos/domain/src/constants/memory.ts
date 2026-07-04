/**
 * Constants for the agent memory system.
 * Retrieval score = MemoryRecencyDecay^hours_since_access * importance * relevance
 */

/** Hourly recency decay factor applied to memory scores */
export const MemoryRecencyDecay = 0.995

/** Default number of memories returned by scored search */
export const MemorySearchTopK = 8

/** Maximum characters allowed in a single memory text */
export const MemoryMaxTextChars = 4000

/** Importance bounds (1..10) for memory records */
export const MemoryMaxImportance = 10
export const MemoryMinImportance = 1

/** Fixed pgvector embedding dimension for memory rows */
export const MemoryEmbeddingDimensions = 1536

/** Fence label for the structured-output memory block parsed from runtime stdout */
export const MemoriesBlockFence = `tdsk-memories`

/** Maximum characters of memory context injected into agent prompts */
export const MemoryInjectMaxChars = 6000
