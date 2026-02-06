import type { TDBQuotaInsert } from '@TDB/types'

import { Quota } from '@tdsk/domain'
import { OrgIds } from '@TDB/seeds/orgs.seed'

/**
 * Quotas Seed Data
 * Tracks resource usage per org per period
 */

export const QuotaIds = {
  acme202401: `40000000-0000-0000-0000-000000000001`,
  acme202402: `40000000-0000-0000-0000-000000000002`,
  startup202401: `40000000-0000-0000-0000-000000000003`,
  personal202401: `40000000-0000-0000-0000-000000000004`,
} as const

export const quotasSeeds: TDBQuotaInsert[] = [
  new Quota({
    projects: 5,
    members: 12,
    threads: 150,
    endpoints: 25,
    price: 150000,
    retention: 90,
    messages: 3500,
    orgSecrets: 15,
    runtime: 120000,
    organizations: 1,
    period: `2024-01`,
    projectSecrets: 45,
    orgId: OrgIds.acme,
    functionCalls: 50000,
    id: QuotaIds.acme202401,
  }),
  new Quota({
    price: 165000,
    retention: 90,
    projects: 6,
    members: 15,
    threads: 200,
    endpoints: 30,
    orgSecrets: 18,
    messages: 4200,
    runtime: 150000,
    organizations: 1,
    period: `2024-02`,
    orgId: OrgIds.acme,
    projectSecrets: 52,
    functionCalls: 65000,
    id: QuotaIds.acme202402,
  }),
  new Quota({
    members: 5,
    threads: 50,
    projects: 3,
    price: 50000,
    retention: 30,
    endpoints: 10,
    messages: 800,
    orgSecrets: 8,
    runtime: 30000,
    organizations: 1,
    period: `2024-01`,
    projectSecrets: 12,
    functionCalls: 15000,
    orgId: OrgIds.startup,
    id: QuotaIds.startup202401,
  }),
  new Quota({
    price: 0,
    members: 1,
    threads: 10,
    projects: 1,
    retention: 7,
    endpoints: 3,
    messages: 100,
    runtime: 5000,
    orgSecrets: 2,
    organizations: 1,
    period: `2024-01`,
    projectSecrets: 5,
    functionCalls: 1000,
    orgId: OrgIds.personal,
    id: QuotaIds.personal202401,
  }),
]
