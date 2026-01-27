import type { TDBQuotaInsert } from '@TDB/types'
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
  {
    id: QuotaIds.acme202401,
    orgId: OrgIds.acme,
    period: `2024-01`,
    price: 150000,
    retention: 90,
    organizations: 1,
    projects: 5,
    members: 12,
    endpoints: 25,
    threads: 150,
    messages: 3500,
    functionCalls: 50000,
    runtime: 120000,
    orgSecrets: 15,
    projectSecrets: 45,
  },
  {
    id: QuotaIds.acme202402,
    orgId: OrgIds.acme,
    period: `2024-02`,
    price: 165000,
    retention: 90,
    organizations: 1,
    projects: 6,
    members: 15,
    endpoints: 30,
    threads: 200,
    messages: 4200,
    functionCalls: 65000,
    runtime: 150000,
    orgSecrets: 18,
    projectSecrets: 52,
  },
  {
    id: QuotaIds.startup202401,
    orgId: OrgIds.startup,
    period: `2024-01`,
    price: 50000,
    retention: 30,
    organizations: 1,
    projects: 3,
    members: 5,
    endpoints: 10,
    threads: 50,
    messages: 800,
    functionCalls: 15000,
    runtime: 30000,
    orgSecrets: 8,
    projectSecrets: 12,
  },
  {
    id: QuotaIds.personal202401,
    orgId: OrgIds.personal,
    period: `2024-01`,
    price: 0,
    retention: 7,
    organizations: 1,
    projects: 1,
    members: 1,
    endpoints: 3,
    threads: 10,
    messages: 100,
    functionCalls: 1000,
    runtime: 5000,
    orgSecrets: 2,
    projectSecrets: 5,
  },
]
