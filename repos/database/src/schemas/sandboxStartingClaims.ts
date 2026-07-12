import { sql, relations } from 'drizzle-orm'
import { base } from '@TDB/utils/schema/base'
import { sandboxes } from '@TDB/schemas/sandboxes'
import { entityId } from '@TDB/utils/schema/entityId'
import { SandboxStartingClaimIdPrefix } from '@tdsk/domain'
import { index, pgTable, varchar, timestamp, uniqueIndex } from 'drizzle-orm/pg-core'

export const sandboxStartingClaims = pgTable(
  `sandbox_starting_claims`,
  {
    ...base,
    id: entityId(SandboxStartingClaimIdPrefix),
    releasedAt: timestamp(`released_at`, { withTimezone: true }),
    claimedAt: timestamp(`claimed_at`, { withTimezone: true }).notNull(),
    sandboxId: varchar(`sandbox_id`, { length: 10 })
      .references(() => sandboxes.id, { onDelete: `cascade` })
      .notNull(),
  },
  (table) => [
    index(`sandbox_starting_claims_sandbox_id_idx`).on(table.sandboxId),
    // Enforces "one in-flight pod-start per sandbox" at the DB level so two
    // backend replicas racing the same sandbox connect/start request can't both
    // pass the maxInstances check and both call startPod() — the loser's
    // INSERT ... ON CONFLICT DO NOTHING (see SandboxStartingClaim.claimStarting)
    // affects zero rows and is treated as "already starting elsewhere", not an
    // error. Mirrors schedule_runs_running_schedule_idx exactly.
    uniqueIndex(`sandbox_starting_claims_active_idx`)
      .on(table.sandboxId)
      .where(sql`${table.releasedAt} IS NULL`),
  ]
)

export const sandboxStartingClaimsRelations = relations(
  sandboxStartingClaims,
  ({ one }) => ({
    sandbox: one(sandboxes, {
      references: [sandboxes.id],
      fields: [sandboxStartingClaims.sandboxId],
    }),
  })
)
