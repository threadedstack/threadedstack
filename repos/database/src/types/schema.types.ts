import type { orgs } from '@TDB/schemas/orgs'
import type { users } from '@TDB/schemas/users'
import type { roles } from '@TDB/schemas/roles'
import type { assets } from '@TDB/schemas/assets'
import type { quotas } from '@TDB/schemas/quotas'
import type { agents } from '@TDB/schemas/agents'
import type { skills } from '@TDB/schemas/skills'
import type { skillProposals } from '@TDB/schemas/skillProposals'
import type { taskProposals } from '@TDB/schemas/taskProposals'
import type { escalations } from '@TDB/schemas/escalations'
import type { decisionProposals } from '@TDB/schemas/decisionProposals'
import type { decisionPositions } from '@TDB/schemas/decisionPositions'
import type { verifications } from '@TDB/schemas/verifications'
import type { opsActions } from '@TDB/schemas/opsActions'
import type { apiKeys } from '@TDB/schemas/apiKeys'
import type { secrets } from '@TDB/schemas/secrets'
import type { threads } from '@TDB/schemas/threads'
import type { domains } from '@TDB/schemas/domains'
import type { invoices } from '@TDB/schemas/invoices'
import type { memories } from '@TDB/schemas/memories'
import type { messages } from '@TDB/schemas/messages'
import type { projects } from '@TDB/schemas/projects'
import type { DBError } from '@TDB/utils/error/error'
import type { endpoints } from '@TDB/schemas/endpoints'
import type { schedules } from '@TDB/schemas/schedules'
import type { functions } from '@TDB/schemas/functions'
import type { providers } from '@TDB/schemas/providers'
import type { sandboxes } from '@TDB/schemas/sandboxes'
import type { invitations } from '@TDB/schemas/invitations'
import type { PgTableWithColumns } from 'drizzle-orm/pg-core'
import type { scheduleRuns } from '@TDB/schemas/scheduleRuns'
import type { subscriptions } from '@TDB/schemas/subscriptions'
import type { sandboxSessions } from '@TDB/schemas/sandboxSessions'
import type {
  TAnyObj,
  TKeyLike,
  Base as BaseModel,
  Memory as MemoryModel,
} from '@tdsk/domain'
import type { permissionOverrides } from '@TDB/schemas/permissionOverrides'

type TInferDateProps<T extends TAnyObj = TAnyObj, D extends TKeyLike = TKeyLike> = Omit<
  T,
  D
> & {
  [K in D]?: string | Date
}

type TInferDates<T extends TAnyObj = TAnyObj> = TInferDateProps<
  T,
  `createdAt` | `updatedAt`
>

export type TDBOrgSelect = TInferDates<typeof orgs.$inferSelect>
export type TDBOrgInsert = TInferDates<typeof orgs.$inferInsert>
export type TDBRoleSelect = TInferDates<typeof roles.$inferSelect>
export type TDBRoleInsert = TInferDates<typeof roles.$inferInsert>
export type TDBAgentSelect = TInferDates<typeof agents.$inferSelect>
export type TDBAgentInsert = TInferDates<typeof agents.$inferInsert>
export type TDBSkillSelect = TInferDates<typeof skills.$inferSelect>
export type TDBSkillInsert = TInferDates<typeof skills.$inferInsert>
export type TDBSkillProposalSelect = TInferDates<typeof skillProposals.$inferSelect>
export type TDBSkillProposalInsert = TInferDates<typeof skillProposals.$inferInsert>
export type TDBTaskProposalSelect = TInferDates<typeof taskProposals.$inferSelect>
export type TDBTaskProposalInsert = TInferDates<typeof taskProposals.$inferInsert>
export type TDBEscalationSelect = TInferDates<typeof escalations.$inferSelect>
export type TDBEscalationInsert = TInferDates<typeof escalations.$inferInsert>
export type TDBDecisionProposalSelect = TInferDates<typeof decisionProposals.$inferSelect>
export type TDBDecisionProposalInsert = TInferDates<typeof decisionProposals.$inferInsert>
export type TDBDecisionPositionSelect = TInferDates<typeof decisionPositions.$inferSelect>
export type TDBDecisionPositionInsert = TInferDates<typeof decisionPositions.$inferInsert>
export type TDBVerificationSelect = TInferDates<typeof verifications.$inferSelect>
export type TDBVerificationInsert = TInferDates<typeof verifications.$inferInsert>
export type TDBOpsActionSelect = TInferDates<typeof opsActions.$inferSelect>
export type TDBOpsActionInsert = TInferDates<typeof opsActions.$inferInsert>
export type TDBQuotaSelect = TInferDates<typeof quotas.$inferSelect>
export type TDBQuotaInsert = TInferDates<typeof quotas.$inferInsert>
export type TDBAssetSelect = TInferDates<typeof assets.$inferSelect>
export type TDBAssetInsert = TInferDates<typeof assets.$inferInsert>
export type TDBSecretSelect = TInferDates<typeof secrets.$inferSelect>
export type TDBSecretInsert = TInferDates<typeof secrets.$inferInsert>
export type TDBThreadSelect = TInferDates<typeof threads.$inferSelect>
export type TDBThreadInsert = TInferDates<typeof threads.$inferInsert>
export type TDBProjectSelect = TInferDates<typeof projects.$inferSelect>
export type TDBProjectInsert = TInferDates<typeof projects.$inferInsert>
export type TDBMessageSelect = TInferDates<typeof messages.$inferSelect>
export type TDBMessageInsert = TInferDates<typeof messages.$inferInsert>
export type TDBEndpointSelect = TInferDates<typeof endpoints.$inferSelect>
export type TDBEndpointInsert = TInferDates<typeof endpoints.$inferInsert>
export type TDBProviderSelect = TInferDates<typeof providers.$inferSelect>
export type TDBProviderInsert = TInferDates<typeof providers.$inferInsert>
export type TDBFunctionSelect = TInferDates<typeof functions.$inferSelect>
export type TDBFunctionInsert = TInferDates<typeof functions.$inferInsert>
export type TDBScheduleSelect = TInferDateProps<
  typeof schedules.$inferSelect,
  `createdAt` | `updatedAt` | `lastRunAt` | `nextRunAt`
>
export type TDBScheduleInsert = TInferDateProps<
  typeof schedules.$inferInsert,
  `createdAt` | `updatedAt` | `lastRunAt` | `nextRunAt`
>
export type TDBScheduleRunSelect = TInferDateProps<
  typeof scheduleRuns.$inferSelect,
  `createdAt` | `updatedAt` | `startedAt` | `completedAt`
>
export type TDBScheduleRunInsert = TInferDateProps<
  typeof scheduleRuns.$inferInsert,
  `createdAt` | `updatedAt` | `startedAt` | `completedAt`
>
export type TDBMemorySelect = TInferDateProps<
  typeof memories.$inferSelect,
  `createdAt` | `updatedAt` | `lastAccessedAt`
>
export type TDBMemoryInsert = TInferDateProps<
  typeof memories.$inferInsert,
  `createdAt` | `updatedAt` | `lastAccessedAt`
>
/** Memory model with the computed retrieval score attached by searchScored */
export type TDBMemoryScored = MemoryModel & { score: number }
export type TDBSandboxSelect = TInferDates<typeof sandboxes.$inferSelect>
export type TDBSandboxInsert = TInferDates<typeof sandboxes.$inferInsert>
export type TDBSandboxSessionSelect = TInferDateProps<
  typeof sandboxSessions.$inferSelect,
  `createdAt` | `updatedAt` | `startedAt` | `completedAt`
>
export type TDBSandboxSessionInsert = TInferDateProps<
  typeof sandboxSessions.$inferInsert,
  `createdAt` | `updatedAt` | `startedAt` | `completedAt`
>
export type TDBInvoiceSelect = TInferDates<typeof invoices.$inferSelect>
export type TDBInvoiceInsert = TInferDates<typeof invoices.$inferInsert>
export type TDBPermissionOverrideSelect = TInferDateProps<
  typeof permissionOverrides.$inferSelect,
  `createdAt` | `updatedAt` | `expiresAt`
>
export type TDBPermissionOverrideInsert = TInferDateProps<
  typeof permissionOverrides.$inferInsert,
  `createdAt` | `updatedAt` | `expiresAt`
>
export type TDBSubscriptionSelect = TInferDates<typeof subscriptions.$inferSelect>
export type TDBSubscriptionInsert = TInferDates<typeof subscriptions.$inferInsert>

export type TDBUserSelect = TInferDateProps<
  typeof users.$inferSelect,
  `createdAt` | `updatedAt` | `banExpires`
>
export type TDBUserInsert = TInferDateProps<
  typeof users.$inferInsert,
  `createdAt` | `updatedAt` | `banExpires`
>

export type TDBInvitationSelect = TInferDateProps<
  typeof invitations.$inferSelect,
  `createdAt` | `updatedAt` | `expiresAt` | `acceptedAt` | `revokedAt`
>
export type TDBInvitationInsert = TInferDateProps<
  typeof invitations.$inferInsert,
  `createdAt` | `updatedAt` | `expiresAt` | `acceptedAt` | `revokedAt`
>

export type TDBApiKeySelect = TInferDateProps<
  typeof apiKeys.$inferSelect,
  `createdAt` | `updatedAt` | `expiresAt` | `lastUsedAt`
>

export type TDBApiKeyInsert = TInferDateProps<
  typeof apiKeys.$inferInsert,
  `createdAt` | `updatedAt` | `expiresAt` | `lastUsedAt`
>

export type TDBDomainsSelect = TInferDateProps<
  typeof domains.$inferSelect,
  `createdAt` | `updatedAt` | `verifiedAt` | `sslExpiresAt`
>

export type TDBDomainsInsert = TInferDateProps<
  typeof domains.$inferInsert,
  `createdAt` | `updatedAt` | `verifiedAt` | `sslExpiresAt`
>

export type TDBEntitySelect =
  | TDBOrgSelect
  | TDBUserSelect
  | TDBRoleSelect
  | TDBAssetSelect
  | TDBAgentSelect
  | TDBQuotaSelect
  | TDBSkillSelect
  | TDBSkillProposalSelect
  | TDBTaskProposalSelect
  | TDBEscalationSelect
  | TDBDecisionProposalSelect
  | TDBDecisionPositionSelect
  | TDBVerificationSelect
  | TDBOpsActionSelect
  | TDBApiKeySelect
  | TDBSecretSelect
  | TDBThreadSelect
  | TDBDomainsSelect
  | TDBInvoiceSelect
  | TDBMemorySelect
  | TDBProjectSelect
  | TDBMessageSelect
  | TDBSandboxSelect
  | TDBEndpointSelect
  | TDBProviderSelect
  | TDBScheduleSelect
  | TDBFunctionSelect
  | TDBInvitationSelect
  | TDBScheduleRunSelect
  | TDBSubscriptionSelect
  | TDBSandboxSessionSelect
  | TDBPermissionOverrideSelect

export type TDBEntityInsert =
  | TDBOrgInsert
  | TDBUserInsert
  | TDBRoleInsert
  | TDBAssetInsert
  | TDBQuotaInsert
  | TDBAgentInsert
  | TDBSkillInsert
  | TDBSkillProposalInsert
  | TDBTaskProposalInsert
  | TDBEscalationInsert
  | TDBDecisionProposalInsert
  | TDBDecisionPositionInsert
  | TDBVerificationInsert
  | TDBOpsActionInsert
  | TDBApiKeyInsert
  | TDBSecretInsert
  | TDBThreadInsert
  | TDBDomainsInsert
  | TDBInvoiceInsert
  | TDBMemoryInsert
  | TDBProjectInsert
  | TDBMessageInsert
  | TDBSandboxInsert
  | TDBEndpointInsert
  | TDBProviderInsert
  | TDBScheduleInsert
  | TDBFunctionInsert
  | TDBInvitationInsert
  | TDBScheduleRunInsert
  | TDBSubscriptionInsert
  | TDBSandboxSessionInsert
  | TDBPermissionOverrideInsert

export type TDBUpdate<T extends TDBEntityInsert = TDBEntityInsert> = Omit<
  Partial<T>,
  `id`
> & {
  id: string
}

export type TTableSchema = PgTableWithColumns<any> & {
  id: any
}

export type TDBOrderDirection = `asc` | `desc`

export type TDBWithObj = {
  with?: TDBWithRecord
  columns?: Record<string, boolean>
}

export type TDBWithOpt = boolean | TDBWithObj
export type TDBWithRecord = Record<string, TDBWithOpt>

export type TDBQueryOpts<T extends Record<string, any> = Record<string, any>> = {
  /**
   * Where clause conditions
   * - Single value: exact match (uses eq)
   * - Array of values: match any (uses inArray)
   * - undefined/null: no filter for that field
   */
  where?: {
    [K in keyof T]?: T[K] | T[K][] | null
  }
  limit?: number
  offset?: number
  with?: TDBWithRecord
  orderBy?: {
    column: string
    direction?: TDBOrderDirection
  }
}

export type TDBApiResType<T> = {
  data?: T
  status?: number
  error?: Error | DBError
}

export type TDBApiRes<M extends BaseModel | BaseModel[]> = TDBApiResType<M>

export interface IDBApi<M extends BaseModel, I extends TDBEntityInsert> {
  create: (data: I, opts?: TDBQueryOpts) => Promise<TDBApiRes<M>>
  list: (opts?: TDBQueryOpts) => Promise<TDBApiRes<M[]>>
  get: (id: string, opts?: TDBQueryOpts) => Promise<TDBApiRes<M>>
  update: (data: TDBUpdate<I>, opts?: TDBQueryOpts) => Promise<TDBApiRes<M>>
  upsert: (data: I, opts?: TDBQueryOpts) => Promise<TDBApiRes<M>>
  delete: (id: string, opts?: TDBQueryOpts) => Promise<TDBApiRes<M>>
}
