import type {
  TActivityRecord,
  TTimelineEntry,
} from '@TAF/types/agentActivity.types'

type TToTimelineOpts = {
  turns?: TActivityRecord[]
  messages?: TActivityRecord[]
  memories?: TActivityRecord[]
}

/** First non-empty line of a string field, capped, for the collapsed preview. */
const firstLine = (value: unknown): string | undefined => {
  if (typeof value !== `string`) return undefined
  const line = value.trim().split(/\r?\n/).find((l) => l.trim().length) ?? ``
  return line ? line.slice(0, 200) : undefined
}

/**
 * Merge the three activity sources into one chronological feed.
 *
 * ORDERING: only `resident_transcripts` and `resident_memories` declare an `at`
 * field. `agent_messages` does NOT, so it can only be ordered by the row's
 * `createdAt` — hence the `data.at ?? createdAt` fallback on every source
 * rather than just messages, which keeps one ordering rule for the whole feed.
 *
 * Each entry carries a collapsed `summary` (the first line of the log content)
 * and the full `body`/`input` for expansion, so the feed reads like a log you
 * can scan and then drill into.
 *
 * Rows with neither `at` nor `createdAt` sort LAST rather than throwing or
 * landing at the epoch: a malformed row should be visible at the bottom, never
 * able to break the page.
 */
export const toTimeline = (opts: TToTimelineOpts): TTimelineEntry[] => {
  const { turns, messages, memories } = opts

  const entries: TTimelineEntry[] = [
    ...(turns ?? []).map((row) => ({
      id: row.id,
      kind: `turn` as const,
      at: String(row.data?.at ?? row.createdAt ?? ``),
      title: String(row.data?.event ?? `turn`),
      summary: firstLine(row.data?.output) ?? firstLine(row.data?.input),
      body: typeof row.data?.output === `string` ? row.data.output : undefined,
      input: typeof row.data?.input === `string` ? row.data.input : undefined,
    })),
    ...(messages ?? []).map((row) => ({
      id: row.id,
      kind: `message` as const,
      at: String(row.data?.at ?? row.createdAt ?? ``),
      title: String(row.data?.subject ?? `message`),
      summary: firstLine(row.data?.body),
      body: typeof row.data?.body === `string` ? row.data.body : undefined,
      meta: row.data?.from ? `from ${row.data.from}` : undefined,
    })),
    ...(memories ?? []).map((row) => ({
      id: row.id,
      kind: `memory` as const,
      at: String(row.data?.at ?? row.createdAt ?? ``),
      title: firstLine(row.data?.text) ?? `memory`,
      body: typeof row.data?.text === `string` ? row.data.text : undefined,
      meta:
        row.data?.importance != null ? `importance ${row.data.importance}` : undefined,
    })),
  ]

  return entries.sort((a, b) => {
    if (!a.at) return 1
    if (!b.at) return -1
    return b.at.localeCompare(a.at)
  })
}
