import type { TMemorySearchOpts } from '@tdsk/domain'
import type {
  TDBApiRes,
  TServiceOpts,
  TDBMemorySelect,
  TDBMemoryInsert,
  TDBMemoryScored,
} from '@TDB/types'

import { Base } from '@TDB/services/base'
import { memories } from '@TDB/schemas/memories'
import { sql, eq, and, desc, inArray, cosineDistance } from 'drizzle-orm'
import {
  EMemoryKind,
  MemorySearchTopK,
  MemoryRecencyDecay,
  Memory as MemoryModel,
} from '@tdsk/domain'

export class Memory extends Base<
  typeof memories,
  TDBMemorySelect,
  TDBMemoryInsert,
  MemoryModel
> {
  constructor(opts: TServiceOpts) {
    super({ ...opts, table: memories })
  }

  model = (data: TDBMemorySelect) => new MemoryModel(data as Partial<MemoryModel>)

  /**
   * Scored memory retrieval:
   *   score = recencyDecay^hours_since_access * importance * relevance
   * Relevance is vector similarity when a query embedding is provided (rows
   * without embeddings fall back to lexical relevance, or a flat 0.1), lexical
   * ts_rank (normalized to 0..1) when only a query string is provided, and 1
   * otherwise (pure recency * importance). Returned rows get lastAccessedAt bumped.
   */
  async searchScored(opts: TMemorySearchOpts): Promise<TDBApiRes<TDBMemoryScored[]>> {
    const { orgId, agentId, query, queryEmbedding, kinds } = opts
    const limit = opts.limit ?? MemorySearchTopK

    try {
      const recency = sql`pow(${MemoryRecencyDecay}, extract(epoch from (now() - greatest(${memories.lastAccessedAt}, ${memories.createdAt}))) / 3600)`

      const lexicalRank = query
        ? sql`ts_rank(to_tsvector('english', ${memories.text}), websearch_to_tsquery('english', ${query}))`
        : undefined
      // ts_rank is unbounded — normalize into 0..1 via rank / (rank + 1)
      const lexical = lexicalRank
        ? sql`(${lexicalRank} / (${lexicalRank} + 1))`
        : undefined

      const relevance = queryEmbedding
        ? sql`case when ${memories.embedding} is not null then (1 - (${cosineDistance(memories.embedding, queryEmbedding)})) else ${lexical ?? sql`0.1`} end`
        : (lexical ?? sql`1`)

      const score = sql<number>`(${recency} * ${memories.importance} * ${relevance})`

      const conditions = [eq(memories.orgId, orgId), eq(memories.agentId, agentId)]
      kinds?.length && conditions.push(inArray(memories.kind, kinds))
      // Pure-lexical mode excludes rows the query does not match at all —
      // in vector mode null-embedding rows must survive to use the fallback relevance
      query &&
        !queryEmbedding &&
        conditions.push(
          sql`to_tsvector('english', ${memories.text}) @@ websearch_to_tsquery('english', ${query})`
        )

      const rows = await this.db
        .select({ memory: memories, score })
        .from(memories)
        .where(and(...conditions))
        .orderBy(desc(score))
        .limit(limit)

      const ids = rows.map((row) => row.memory.id)
      ids.length &&
        (await this.db
          .update(memories)
          .set({ lastAccessedAt: new Date() })
          .where(inArray(memories.id, ids)))

      return {
        data: rows.map(
          (row) =>
            Object.assign(this.model(row.memory as TDBMemorySelect), {
              score: Number(row.score),
            }) as TDBMemoryScored
        ),
      }
    } catch (error: any) {
      return { error }
    }
  }

  /**
   * Latest roadmap memory for an agent — roadmap history is append-only,
   * so the newest kind=roadmap row is the current roadmap.
   */
  async getRoadmap(orgId: string, agentId: string): Promise<TDBApiRes<MemoryModel>> {
    try {
      const [row] = await this.db
        .select()
        .from(memories)
        .where(
          and(
            eq(memories.orgId, orgId),
            eq(memories.agentId, agentId),
            eq(memories.kind, EMemoryKind.roadmap)
          )
        )
        .orderBy(desc(memories.createdAt))
        .limit(1)

      return row ? { data: this.model(row as TDBMemorySelect) } : {}
    } catch (error: any) {
      return { error }
    }
  }

  /**
   * Writes a new roadmap row — history is preserved, getRoadmap returns the latest.
   */
  async upsertRoadmap(
    orgId: string,
    agentId: string,
    text: string,
    meta?: Record<string, any>
  ): Promise<TDBApiRes<MemoryModel>> {
    return this.create({
      orgId,
      agentId,
      text,
      meta,
      kind: EMemoryKind.roadmap,
    } as TDBMemoryInsert)
  }
}
