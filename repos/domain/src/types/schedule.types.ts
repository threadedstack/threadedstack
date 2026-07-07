import type { TRecordQuery } from './collection.types'

export enum EScheduleType {
  prompt = `prompt`,
  shell = `shell`,
}

/**
 * A declarative context source on a schedule. When the executor assembles a
 * cycle's prompt context, it runs `record.query(schedule project, collection,
 * query)` for each source and injects the results under a `## <as>` heading,
 * capped at `max` (or ContextSourceInjectMaxChars). This is the generic,
 * config-driven replacement for the hard-coded buildXContext builders — a
 * schedule WITHOUT contextSources runs no extra query and is byte-unchanged.
 */
export type TContextSource = {
  /** Name of the project-scoped collection to query. */
  collection: string
  /** The small, injection-safe record query to run. */
  query: TRecordQuery
  /** Heading the rendered records are injected under (`## <as>`). */
  as: string
  /** Per-source char cap; defaults to ContextSourceInjectMaxChars. */
  max?: number
}

export type TScheduleRunStatus = `running` | `success` | `error` | `timeout`

export type TScheduleRun = {
  id: string
  orgId: string
  error?: string
  projectId: string
  stdoutKey?: string
  stderrKey?: string
  scheduleId: string
  durationMs?: number
  instanceId?: string
  startedAt: string | Date
  createdAt?: string | Date
  updatedAt?: string | Date
  status: TScheduleRunStatus
  completedAt?: string | Date
}
