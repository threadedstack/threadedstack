import type { TApp } from '@TBE/types'
import type { Schedule } from '@tdsk/domain'

import { logger } from '@TBE/utils/logger'
import { StrategyInjectMaxChars } from '@tdsk/domain'

/** Max backlog items surfaced in the injected Company Strategy context. */
const StrategyBacklogTopN = 5

/**
 * Build the injected Company Strategy context for a cycle that consumes the
 * executive faculty: reads the org's single company_strategies row and renders a
 * `## Company Strategy` block with the North Star, segments, positioning, the
 * frozen Active Initiative (or an awaiting-next note when none), and the top
 * backlog items. Capped at StrategyInjectMaxChars.
 *
 * Dormant + defensive (mirrors buildRunOutcomeContext): returns '' when the org
 * has no strategy row — so it is safe in prod BEFORE the table is pushed or a
 * strategy is seeded — and never throws. A failure only degrades context
 * (logged) and returns an empty string.
 */
export async function buildCompanyStrategyContext(
  app: TApp,
  schedule: Schedule
): Promise<string> {
  try {
    const { db } = app.locals
    const { data: strategy } = await db.services.companyStrategy.getByOrg(schedule.orgId)
    if (!strategy) return ``

    const lines: string[] = [`## Company Strategy`]

    if (strategy.northStar) lines.push(`North Star: ${strategy.northStar}`)
    if (strategy.segments?.length) lines.push(`Segments: ${strategy.segments.join(`, `)}`)
    if (strategy.positioning) lines.push(`Positioning: ${strategy.positioning}`)

    const active = strategy.activeInitiative
    lines.push(
      active
        ? `Active Initiative: ${active.title} — ${active.definitionOfDone} [${active.status}]`
        : `Active Initiative: none — awaiting next initiative`
    )

    const backlog = strategy.backlog ?? []
    if (backlog.length) {
      const top = backlog.slice(0, StrategyBacklogTopN)
      lines.push(`Backlog (top ${top.length}):`)
      for (const item of top) lines.push(`- [${item.priority}] ${item.title}`)
    }

    const out = `${lines.join(`\n`)}\n\n`
    return out.length > StrategyInjectMaxChars
      ? out.slice(0, StrategyInjectMaxChars)
      : out
  } catch (err) {
    logger.error(
      `[Executor] buildCompanyStrategyContext failed for schedule ${schedule.id}:`,
      (err as Error).message
    )
    return ``
  }
}
