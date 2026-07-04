import type { TMemoryKind } from '@tdsk/domain'

import { orgs } from '@TDB/schemas/orgs'
import { sql, relations } from 'drizzle-orm'
import { agents } from '@TDB/schemas/agents'
import { base } from '@TDB/utils/schema/base'
import { entityId } from '@TDB/utils/schema/entityId'
import { MemoryIdPrefix, MemoryEmbeddingDimensions } from '@tdsk/domain'
import {
  text,
  jsonb,
  index,
  vector,
  integer,
  pgTable,
  varchar,
  timestamp,
} from 'drizzle-orm/pg-core'

/**
 * Memories table
 * Durable org/agent-scoped memory records for the autonomous agent memory system.
 * Retrieved via scored search (recency x importance x relevance) — see the Memory service.
 * Requires the pgvector extension (created by the CLI push path before drizzle push).
 */
export const memories = pgTable(
  `memories`,
  {
    ...base,
    id: entityId(MemoryIdPrefix),

    /** Memory kind: fact | insight | reflection | compaction | roadmap */
    kind: varchar(`kind`, { length: 20 }).default(`fact`).notNull().$type<TMemoryKind>(),

    /** Memory content */
    text: text(`text`).notNull(),

    /** Importance weight 1..10 used by scored retrieval */
    importance: integer(`importance`).default(5).notNull(),

    /** Bumped whenever the row is returned by scored search */
    lastAccessedAt: timestamp(`last_accessed_at`).defaultNow().notNull(),

    /** Embedding vector — NULL rows fall back to lexical relevance */
    embedding: vector(`embedding`, { dimensions: MemoryEmbeddingDimensions }),

    /** Citations and provenance: { threadId, messageId, scheduleId, model } */
    meta: jsonb(`meta`).$type<Record<string, any>>(),

    orgId: varchar(`org_id`, { length: 10 })
      .references(() => orgs.id, { onDelete: `cascade` })
      .notNull(),

    agentId: varchar(`agent_id`, { length: 10 })
      .references(() => agents.id, { onDelete: `cascade` })
      .notNull(),
  },
  (table) => [
    index(`memories_org_id_agent_id_idx`).on(table.orgId, table.agentId),
    index(`memories_embedding_idx`).using(
      `hnsw`,
      table.embedding.op(`vector_cosine_ops`)
    ),
    index(`memories_text_search_idx`).using(
      `gin`,
      sql`to_tsvector('english', ${table.text})`
    ),
  ]
)

export const memoriesRelations = relations(memories, ({ one }) => ({
  org: one(orgs, {
    fields: [memories.orgId],
    references: [orgs.id],
  }),
  agent: one(agents, {
    fields: [memories.agentId],
    references: [agents.id],
  }),
}))
