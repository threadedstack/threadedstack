import type { TContextSource } from '@tdsk/domain'
import type { TResidentApi } from './types/resident.types'

import { log } from './log'
import { ContextSourceInjectMaxChars } from '@tdsk/domain'

/**
 * Fetch + render the configured `contextSources` for a turn — the in-pod
 * mirror of the backend executor's buildContextSourcesSection: for each
 * `{ collection, query, as, max? }` the records query API runs and the matched
 * documents render under a `## <as>` heading, record id included (so the
 * session can reference records by id in follow-up effects), capped at `max`
 * (or ContextSourceInjectMaxChars). Never throws — a failing source is logged
 * and skipped, so one bad source never drops the turn or its siblings.
 */
export const renderContextSources = async (
  api: TResidentApi,
  sources?: TContextSource[]
): Promise<string> => {
  if (!sources?.length) return ``

  const sections: string[] = []

  for (const source of sources) {
    try {
      const res = await api.queryRecords(source.collection, source.query)
      if (!res.ok) throw new Error(res.error ?? `status ${res.status}`)

      // A data field named `id` wins the spread — data is the document; the
      // record id is a default (byte-identical to the backend renderer).
      const documents = (res.data ?? []).map((record) => ({
        id: record.id,
        ...(record.data as Record<string, unknown>),
      }))
      const body = documents.length ? JSON.stringify(documents, null, 2) : `(no records)`

      const cap = source.max ?? ContextSourceInjectMaxChars
      const section = `## ${source.as}\n${body}\n\n`
      sections.push(section.length > cap ? section.slice(0, cap) : section)
    } catch (err) {
      log.error(
        `renderContextSources failed for source "${source.as}":`,
        (err as Error).message
      )
    }
  }

  return sections.join(``)
}
