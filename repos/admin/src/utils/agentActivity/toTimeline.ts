import type {
  TActivityRecord,
  TTimelineEntry,
} from '@TAF/types/agentActivity.types'

type TToTimelineOpts = {
  turns?: TActivityRecord[]
  messages?: TActivityRecord[]
  memories?: TActivityRecord[]
}

/**
 * Merge the three activity sources into one chronological feed.
 *
 * ORDERING: only `resident_transcripts` and `resident_memories` declare an `at`
 * field. `agent_messages` does NOT, so it can only be ordered by the row's
 * `createdAt` — hence the `data.at ?? createdAt` fallback on every source
 * rather than just messages, which keeps one ordering rule for the whole feed.
 *
 * Rows with neither sort LAST rather than throwing or landing at the epoch: a
 * malformed row should be visible at the bottom, never able to break the page.
 */
export const toTimeline = (opts: TToTimelineOpts): TTimelineEntry[] => {
  const { turns, messages, memories } = opts

  const entries: TTimelineEntry[] = [
    ...(turns ?? []).map((row) => ({
      id: row.id,
      kind: `turn` as const,
      at: String(row.data?.at ?? row.createdAt ?? ``),
      title: String(row.data?.event ?? `turn`),
      body: typeof row.data?.output === `string` ? row.data.output : undefined,
    })),
    ...(messages ?? []).map((row) => ({
      id: row.id,
      kind: `message` as const,
      at: String(row.data?.at ?? row.createdAt ?? ``),
      title: String(row.data?.subject ?? `message`),
      body: typeof row.data?.body === `string` ? row.data.body : undefined,
    })),
    ...(memories ?? []).map((row) => ({
      id: row.id,
      kind: `memory` as const,
      at: String(row.data?.at ?? row.createdAt ?? ``),
      title: `memory`,
      body: typeof row.data?.text === `string` ? row.data.text : undefined,
    })),
  ]

  return entries.sort((a, b) => {
    if (!a.at) return 1
    if (!b.at) return -1
    return b.at.localeCompare(a.at)
  })
}
