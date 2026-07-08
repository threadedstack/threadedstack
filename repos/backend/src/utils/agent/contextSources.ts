import type { TApp } from '@TBE/types'
import type { Schedule } from '@tdsk/domain'

import { logger } from '@TBE/utils/logger'
import { ContextSourceInjectMaxChars } from '@tdsk/domain'

/**
 * Build the declarative `contextSources` section for a cycle's assembled prompt
 * context. For each `{ collection, query, as, max? }` source on the schedule it
 * runs `record.query(schedule project, collection, query)` and renders the
 * matched documents under a `## <as>` heading, capped at `max` (or
 * ContextSourceInjectMaxChars). This is the generic, config-driven replacement
 * for the hard-coded buildXContext builders.
 *
 * Purely additive + inert (mirrors buildRunOutcomeContext): a schedule WITHOUT
 * contextSources returns '' and runs NO query, so its assembled context is
 * byte-identical to before. Never throws — a failing source is logged and
 * skipped (its section is omitted), so one bad source never fails the run or
 * drops the others.
 */
export async function buildContextSourcesSection(
  app: TApp,
  schedule: Schedule
): Promise<string> {
  const sources = schedule.contextSources
  if (!sources?.length) return ``

  const { db } = app.locals
  const sections: string[] = []

  for (const source of sources) {
    try {
      const { data: records } = await db.services.record.query(
        schedule.projectId,
        source.collection,
        source.query
      )
      // Render the record id alongside the document so consumers (e.g. board
      // prompts) can reference records by id in follow-up effects (postPosition
      // resolves proposals via records.get by record id). A data field named
      // `id` wins the spread — data is the document; the record id is a default.
      const documents = (records ?? []).map((record) => ({
        id: record.id,
        ...(record.data as Record<string, unknown>),
      }))
      const body = documents.length ? JSON.stringify(documents, null, 2) : `(no records)`

      const cap = source.max ?? ContextSourceInjectMaxChars
      const section = `## ${source.as}\n${body}\n\n`
      sections.push(section.length > cap ? section.slice(0, cap) : section)
    } catch (err) {
      logger.error(
        `[Executor] buildContextSourcesSection failed for schedule ${schedule.id} source "${source.as}":`,
        (err as Error).message
      )
    }
  }

  return sections.join(``)
}
